import type { SwipeDirection } from '@/lib/gestures';
import type { SpaceTransitionHandoff } from '@/shared/types';

import { updateSwipeDebugInfo } from './floating-swipe-debug';

type GestureSettings = {
  gesturesEnabled: boolean;
  gestureSensitivity: number;
};

type GestureControllerDeps = {
  getShadowRoot: () => ShadowRoot | null;
  getHostElement: () => HTMLElement | null;
  ensureHost: () => void;
  onNavigateSpace: (
    direction: SwipeDirection,
    options: {
      mode: 'handoff' | 'flick';
      transition?: SpaceTransitionHandoff;
      perfId?: string;
      t0?: number;
    }
  ) => void;
  onPageTransition?: () => void;
};

type SwipeDebugContext = {
  deltaX: number;
  deltaY: number;
  scrollable: boolean;
  scrollLeft: number;
  currentDelta: number;
  isInsideFloatingUI: boolean;
  pathLength: number;
  targetInfo: string;
  processingTime: number;
};

const SCROLL_PROXY_ID = 'arcline-swipe-scroll-proxy';
const SCROLL_PROXY_INNER_ID = 'arcline-swipe-scroll-proxy-inner';
const INTENT_LOCK_THRESHOLD = 0;
const INTENT_LOCK_THRESHOLD_PX = 5;
const NOISE_THRESHOLD = 0.2;
const RELEASE_TIMEOUT_MS = 70;
const RELEASE_VELOCITY_EPS = 0.02;
const FLICK_RELEASE_WINDOW_MS = 90;
const FLICK_VELOCITY_WIDTHS_PER_SEC = 0.9;
const STOPPED_RELEASE_WINDOW_MS = 50;
const RELEASE_IDLE_MS = 100;
const SCROLLEND_IDLE_MS = 180;
const VELOCITY_EMA_ALPHA = 0.4;
const FLICK_ANIMATION_MS = 100;
const RESET_ANIMATION_MS = 140;
const HANDOFF_ANIMATION_MS = 160;
const COOLDOWN_MS = 220;

// Early flick detection: commit immediately when high velocity is detected
const EARLY_FLICK_VELOCITY_THRESHOLD = 1.5; // widths per second
const EARLY_FLICK_MIN_PROGRESS = 0.15; // minimum 15% progress before committing

const SUPPORTS_SCROLLEND =
  typeof document !== 'undefined' &&
  typeof document.documentElement !== 'undefined' &&
  'onscrollend' in document.documentElement;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function isPageHorizontallyScrollable(): boolean {
  const scrollWidth = document.documentElement.scrollWidth;
  const clientWidth = document.documentElement.clientWidth;
  return scrollWidth > clientWidth + 5;
}

function buildSwipeDebugContext(
  e: WheelEvent,
  startTime: number,
  shadowRoot: ShadowRoot | null
): SwipeDebugContext {
  const scrollable = isPageHorizontallyScrollable();
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
  const path = e.composedPath();
  const isInsideFloatingUI = Boolean(shadowRoot && path.includes(shadowRoot.host));
  const pathLength = path.length;
  const targetInfo = `target=${(e.target as HTMLElement)?.tagName || 'unknown'}, host=${shadowRoot?.host?.tagName || 'none'}`;

  return {
    deltaX: e.deltaX,
    deltaY: e.deltaY,
    scrollable,
    scrollLeft,
    currentDelta: 0,
    isInsideFloatingUI,
    pathLength,
    targetInfo,
    processingTime: performance.now() - startTime,
  };
}

function reportSwipeDebug(
  context: SwipeDebugContext,
  reason: string,
  prevented: boolean,
  currentDeltaOverride?: number
) {
  updateSwipeDebugInfo({
    deltaX: context.deltaX,
    deltaY: context.deltaY,
    prevented,
    reason,
    scrollable: context.scrollable,
    scrollLeft: context.scrollLeft,
    currentDelta: currentDeltaOverride ?? context.currentDelta,
    processingTime: context.processingTime,
    isInsideFloatingUI: context.isInsideFloatingUI,
    pathLength: context.pathLength,
    targetInfo: context.targetInfo,
  });
}

function getTransitionTarget(shadowRoot: ShadowRoot | null) {
  if (!shadowRoot) return null;
  return shadowRoot.querySelector('[data-arcline-space-transition]') as HTMLElement | null;
}

function getTransitionWidth(target: HTMLElement | null): number {
  if (!target) return 0;
  return target.getBoundingClientRect().width || 0;
}

function dispatchSwipeProgress(progress: number) {
  window.dispatchEvent(
    new CustomEvent('arcline-swipe-progress', {
      detail: { progress: -progress },
    })
  );
}

function applyTransitionOffset(
  target: HTMLElement,
  offsetPx: number,
  options: { animate: boolean; durationMs?: number }
) {
  if (options.animate) {
    const duration = options.durationMs ?? 200;
    target.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0.0, 0.2, 1)`;
  } else {
    target.style.transition = 'none';
  }

  target.style.transform = `translateX(${offsetPx}px)`;
}

type GestureIntent = 'horizontal' | 'vertical' | null;

type GesturePhase = 'idle' | 'tracking' | 'locked' | 'committing' | 'cooldown';

type PendingCommit = {
  target: HTMLElement;
  width: number;
  context: SwipeDebugContext;
  direction: SwipeDirection;
};

export function __lockIntent(
  deltaX: number,
  deltaY: number,
  accumulatedX: number,
  accumulatedY: number,
  threshold = INTENT_LOCK_THRESHOLD
): GestureIntent {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  const totalAbsX = Math.abs(accumulatedX);
  const totalAbsY = Math.abs(accumulatedY);

  if (totalAbsX < INTENT_LOCK_THRESHOLD_PX && totalAbsY < INTENT_LOCK_THRESHOLD_PX) {
    return null;
  }

  if (absX < NOISE_THRESHOLD && absY < NOISE_THRESHOLD) {
    return null;
  }
  if (totalAbsX > totalAbsY + threshold) {
    return 'horizontal';
  }
  if (totalAbsY > totalAbsX + threshold) {
    return 'vertical';
  }
  return null;
}

export function __shouldCommitSwipe(
  progress: number,
  velocity: number
): 'handoff' | 'flick' | 'cancel' {
  if (Math.abs(velocity) > RELEASE_VELOCITY_EPS) {
    return 'flick';
  }
  if (progress >= 0.5) {
    return 'handoff';
  }
  return 'cancel';
}

export function createFloatingGestureController(deps: GestureControllerDeps) {
  let gesturesEnabled = true;
  let intent: GestureIntent = null;
  let phase: GesturePhase = 'idle';
  let totalDeltaX = 0;
  let totalDeltaY = 0;
  let lastVelocityX = 0;
  let lastEventTime = 0;
  let lastMovementTime = 0;
  let gestureHandler: ((e: WheelEvent) => void) | null = null;
  let swipeResetTimer: ReturnType<typeof setTimeout> | null = null;
  let cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollEndFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let attachedHost: HTMLElement | null = null;
  let deltaScale = 1;
  let scrollProxy: HTMLDivElement | null = null;
  let scrollProxyCenter = 0;
  let ignoreScrollEnd = false;
  let pendingCommit: PendingCommit | null = null;

  const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
    if (timer) {
      clearTimeout(timer);
    }
  };

  const clearPendingCommit = () => {
    pendingCommit = null;
    clearTimer(scrollEndFallbackTimer);
    scrollEndFallbackTimer = null;
  };

  const getScrollProxyCenter = (proxy: HTMLDivElement) => {
    const center = (proxy.scrollWidth - proxy.clientWidth) / 2;
    scrollProxyCenter = Number.isFinite(center) ? Math.max(0, center) : 0;
    return scrollProxyCenter;
  };

  const ensureScrollProxy = (shadowRoot: ShadowRoot | null) => {
    if (!shadowRoot || !SUPPORTS_SCROLLEND) return null;
    let proxy = shadowRoot.getElementById(SCROLL_PROXY_ID) as HTMLDivElement | null;
    if (!proxy) {
      proxy = document.createElement('div');
      proxy.id = SCROLL_PROXY_ID;
      proxy.style.position = 'absolute';
      proxy.style.inset = '0';
      proxy.style.overflowX = 'auto';
      proxy.style.overflowY = 'hidden';
      proxy.style.pointerEvents = 'none';
      proxy.style.zIndex = '0';
      proxy.style.scrollbarWidth = 'none';
      proxy.style.setProperty('-ms-overflow-style', 'none');
      proxy.style.overscrollBehavior = 'contain';

      const inner = document.createElement('div');
      inner.id = SCROLL_PROXY_INNER_ID;
      inner.style.width = '300%';
      inner.style.height = '1px';
      proxy.append(inner);

      proxy.addEventListener('scrollend', () => {
        if (ignoreScrollEnd || phase === 'committing' || phase === 'cooldown') {
          return;
        }
        if (!pendingCommit) return;
        const timeSinceMove = performance.now() - lastMovementTime;
        if (timeSinceMove < SCROLLEND_IDLE_MS) {
          return;
        }
        const { target, width, context, direction } = pendingCommit;
        clearPendingCommit();
        commitGesture(target, width, context, direction);
      });

      shadowRoot.append(proxy);
    }

    scrollProxy = proxy;
    getScrollProxyCenter(proxy);
    return proxy;
  };

  const updateScrollProxy = (shadowRoot: ShadowRoot | null, offsetPx: number) => {
    const proxy = ensureScrollProxy(shadowRoot);
    if (!proxy) return;
    const center = getScrollProxyCenter(proxy);
    const maxScroll = Math.max(0, proxy.scrollWidth - proxy.clientWidth);
    const nextScrollLeft = clamp(center + offsetPx, 0, maxScroll);
    if (proxy.scrollLeft !== nextScrollLeft) {
      proxy.scrollLeft = nextScrollLeft;
    }
  };

  const resetScrollProxy = () => {
    if (!scrollProxy) return;
    const center = getScrollProxyCenter(scrollProxy);
    ignoreScrollEnd = true;
    scrollProxy.scrollLeft = center;
    window.setTimeout(() => {
      ignoreScrollEnd = false;
    }, 0);
  };

  const resetGesture = () => {
    intent = null;
    totalDeltaX = 0;
    totalDeltaY = 0;
    lastVelocityX = 0;
    lastEventTime = 0;
    lastMovementTime = 0;
    dispatchSwipeProgress(0);
    clearPendingCommit();
    resetScrollProxy();
  };

  const enterCooldown = () => {
    phase = 'cooldown';
    clearTimer(cooldownTimer);
    cooldownTimer = setTimeout(() => {
      phase = 'idle';
    }, COOLDOWN_MS);
  };

  const scheduleRelease = (
    target: HTMLElement,
    width: number,
    context: SwipeDebugContext,
    direction: SwipeDirection
  ) => {
    clearTimer(swipeResetTimer);
    swipeResetTimer = setTimeout(() => {
      swipeResetTimer = null;
      commitGesture(target, width, context, direction);
    }, RELEASE_TIMEOUT_MS);
  };

  const scheduleScrollEndFallback = (
    target: HTMLElement,
    width: number,
    context: SwipeDebugContext,
    direction: SwipeDirection
  ) => {
    pendingCommit = { target, width, context, direction };
    clearTimer(scrollEndFallbackTimer);
    scrollEndFallbackTimer = setTimeout(() => {
      if (!pendingCommit) return;
      const nextCommit = pendingCommit;
      clearPendingCommit();
      commitGesture(nextCommit.target, nextCommit.width, nextCommit.context, nextCommit.direction);
    }, SCROLLEND_IDLE_MS);
  };

  const resolveCommitDecision = (width: number, timeSinceMove: number) => {
    const progress = clamp(Math.abs(totalDeltaX) / width, 0, 1);
    const velocityWidthsPerSec = width > 0 ? (Math.abs(lastVelocityX) * 1000) / width : 0;
    const stopped = timeSinceMove >= STOPPED_RELEASE_WINDOW_MS;
    const isFlick =
      !stopped &&
      timeSinceMove <= FLICK_RELEASE_WINDOW_MS &&
      velocityWidthsPerSec >= FLICK_VELOCITY_WIDTHS_PER_SEC;
    const decision = __shouldCommitSwipe(progress, isFlick ? lastVelocityX : 0);
    return { decision, progress };
  };

  const commitCancel = (target: HTMLElement, context: SwipeDebugContext) => {
    reportSwipeDebug(context, 'cancel', true, totalDeltaX);
    phase = 'committing';
    applyTransitionOffset(target, 0, { animate: true, durationMs: RESET_ANIMATION_MS });
    enterCooldown();
    resetGesture();
  };

  const commitFlick = (
    target: HTMLElement,
    width: number,
    context: SwipeDebugContext,
    uiDirection: SwipeDirection,
    spaceDirection: SwipeDirection
  ) => {
    const perfId = `flick-${Math.random().toString(36).slice(2, 6)}`;
    const t0 = Date.now();
    console.log(
      `[Arcline][Perf][${perfId}] T0: Flick Committed at ${new Date(t0).toISOString().split('T')[1]} (${t0})`
    );

    reportSwipeDebug(context, 'commit-flick', true, totalDeltaX);
    phase = 'committing';

    // Show page transition mask while animating
    deps.onPageTransition?.();

    const endOffset = uiDirection === 'left' ? -width : width;
    applyTransitionOffset(target, endOffset, {
      animate: true,
      durationMs: FLICK_ANIMATION_MS,
    });

    // Wait for animation to complete, then trigger navigation
    window.setTimeout(() => {
      // Navigate AFTER animation completes for smooth visual experience
      deps.onNavigateSpace(spaceDirection, { mode: 'flick', perfId, t0 });

      applyTransitionOffset(target, 0, { animate: false });
      dispatchSwipeProgress(0);
      resetGesture();
      enterCooldown();
    }, FLICK_ANIMATION_MS);
  };

  const commitHandoff = (
    target: HTMLElement,
    context: SwipeDebugContext,
    uiDirection: SwipeDirection,
    spaceDirection: SwipeDirection,
    progress: number
  ) => {
    reportSwipeDebug(context, 'commit-handoff', true, totalDeltaX);
    phase = 'committing';
    const transition: SpaceTransitionHandoff = {
      mode: 'handoff',
      direction: uiDirection,
      progress,
      timestamp: Date.now(),
    };

    const perfId = `handoff-${Math.random().toString(36).slice(2, 6)}`;
    const t0 = Date.now();
    console.log(
      `[Arcline][Perf][${perfId}] T0: Handoff Committed at ${new Date(t0).toISOString().split('T')[1]} (${t0})`
    );

    deps.onPageTransition?.();
    deps.onNavigateSpace(spaceDirection, { mode: 'handoff', transition, perfId, t0 });
    enterCooldown();
    window.setTimeout(() => {
      applyTransitionOffset(target, 0, { animate: false });
      dispatchSwipeProgress(0);
      resetGesture();
    }, COOLDOWN_MS);
  };

  const commitGesture = (
    target: HTMLElement,
    width: number,
    context: SwipeDebugContext,
    uiDirection: SwipeDirection,
    options?: { forceRelease?: boolean }
  ) => {
    if (phase === 'committing' || phase === 'cooldown') {
      return;
    }

    const now = performance.now();
    const timeSinceMove = now - lastMovementTime;
    if (!options?.forceRelease && timeSinceMove < RELEASE_IDLE_MS) {
      clearTimer(swipeResetTimer);
      swipeResetTimer = setTimeout(() => {
        swipeResetTimer = null;
        commitGesture(target, width, context, uiDirection);
      }, RELEASE_IDLE_MS - timeSinceMove);
      return;
    }

    clearPendingCommit();

    const { decision, progress } = resolveCommitDecision(width, timeSinceMove);
    const spaceDirection: SwipeDirection = uiDirection === 'left' ? 'right' : 'left';

    if (decision === 'cancel') {
      commitCancel(target, context);
      return;
    }

    if (decision === 'flick') {
      commitFlick(target, width, context, uiDirection, spaceDirection);
      return;
    }

    commitHandoff(target, context, uiDirection, spaceDirection, progress);
  };

  const handleHorizontalSwipe = (
    e: WheelEvent,
    context: SwipeDebugContext,
    shadowRoot: ShadowRoot | null,
    target: HTMLElement
  ) => {
    const now = performance.now();
    const dt = Math.max(now - lastEventTime, 1);
    lastEventTime = now;

    const scaledDeltaX = -e.deltaX * deltaScale;
    totalDeltaX += scaledDeltaX;

    // Smooth velocity using EMA
    const instantVelocityX = scaledDeltaX / dt;
    lastVelocityX =
      lastVelocityX * (1 - VELOCITY_EMA_ALPHA) + instantVelocityX * VELOCITY_EMA_ALPHA;

    if (Math.abs(scaledDeltaX) >= NOISE_THRESHOLD) {
      lastMovementTime = now;
    }

    const width = getTransitionWidth(target);
    if (!width) {
      reportSwipeDebug(context, 'no-width', true, totalDeltaX);
      return;
    }

    const progress = clamp(totalDeltaX / width, -1, 1);
    const direction: SwipeDirection = progress < 0 ? 'left' : 'right';
    const offset = progress * width;

    applyTransitionOffset(target, offset, { animate: false });
    dispatchSwipeProgress(progress);

    // Early flick detection: commit immediately when high velocity is detected
    // This bypasses the scrollend delay caused by momentum scrolling
    const velocityWidthsPerSec = width > 0 ? (Math.abs(lastVelocityX) * 1000) / width : 0;
    if (
      velocityWidthsPerSec >= EARLY_FLICK_VELOCITY_THRESHOLD &&
      Math.abs(progress) >= EARLY_FLICK_MIN_PROGRESS &&
      phase === 'locked'
    ) {
      clearPendingCommit();
      const spaceDirection: SwipeDirection = direction === 'left' ? 'right' : 'left';
      commitFlick(target, width, context, direction, spaceDirection);
      reportSwipeDebug(context, 'early-flick-commit', true, totalDeltaX);
      return;
    }

    if (SUPPORTS_SCROLLEND) {
      updateScrollProxy(shadowRoot, offset);
      scheduleScrollEndFallback(target, width, context, direction);
    } else {
      scheduleRelease(target, width, context, direction);
    }

    reportSwipeDebug(context, 'tracking-horizontal', true, totalDeltaX);
    if (!shadowRoot) return;
  };

  const getSkipReason = (context: SwipeDebugContext, target: HTMLElement | null) => {
    if (!target) return 'no-target';
    if (!context.isInsideFloatingUI) return 'floating-ui-closed';
    if (!gesturesEnabled) return 'gestures-disabled';
    return null;
  };

  const resolveIntent = (
    deltaX: number,
    deltaY: number,
    context: SwipeDebugContext,
    prevented: boolean
  ) => {
    if (intent) {
      return intent;
    }

    totalDeltaX += deltaX;
    totalDeltaY += deltaY;

    const locked = __lockIntent(deltaX, deltaY, totalDeltaX, totalDeltaY);
    if (!locked) {
      reportSwipeDebug(context, 'intent-pending', prevented);
      return null;
    }

    intent = locked;
    phase = 'locked';

    // If locked to horizontal, we've already accumulated some deltaX.
    // Ensure we don't double count if we reuse it later.
    // Actually totalDeltaX is used for progress calculation, so it's fine.

    return intent;
  };

  const handleVerticalIntent = (context: SwipeDebugContext) => {
    clearTimer(swipeResetTimer);
    swipeResetTimer = setTimeout(() => {
      swipeResetTimer = null;
      resetGesture();
      phase = 'idle';
    }, RELEASE_TIMEOUT_MS);
    clearPendingCommit();
    reportSwipeDebug(context, 'locked-vertical', false, totalDeltaX);
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complex gesture logic required
  const handleWheel = (e: WheelEvent) => {
    // Optimization: Early return for common cases to avoid heavy debug context generation
    if (!gesturesEnabled) return;

    const shadowRoot = deps.getShadowRoot();
    if (!shadowRoot) return;

    const target = getTransitionTarget(shadowRoot);
    if (!target) return; // 'no-target'

    // Only build debug context (expensive due to composedPath) if we might actually process the swipe
    const startTime = performance.now();
    const context = buildSwipeDebugContext(e, startTime, shadowRoot);
    context.currentDelta = totalDeltaX;

    const skipReason = getSkipReason(context, target);
    if (skipReason) {
      reportSwipeDebug(context, skipReason, false);
      return;
    }
    const resolvedTarget = target as HTMLElement;

    const scaledDeltaX = -e.deltaX * deltaScale;
    const scaledDeltaY = e.deltaY * deltaScale;

    if (phase === 'committing' || phase === 'cooldown') {
      const isVerticalDominant = Math.abs(scaledDeltaY) > Math.abs(scaledDeltaX);
      if (isVerticalDominant) {
        reportSwipeDebug(context, 'cooldown-allow-vertical', false, totalDeltaX);
      } else {
        e.preventDefault();
        e.stopPropagation();
        reportSwipeDebug(context, 'cooldown-prevent', true, totalDeltaX);
      }
      return;
    }

    if (intent === 'vertical') {
      handleVerticalIntent(context);
      return;
    }

    const isVerticalDominant = Math.abs(scaledDeltaY) > Math.abs(scaledDeltaX);
    if (!intent && isVerticalDominant) {
      handleVerticalIntent(context);
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const lockedIntent = resolveIntent(scaledDeltaX, scaledDeltaY, context, true);
    if (!lockedIntent) {
      return;
    }

    handleHorizontalSwipe(e, context, shadowRoot, resolvedTarget);
  };

  const setup = () => {
    if (gestureHandler) return;
    gestureHandler = handleWheel;

    window.addEventListener('wheel', gestureHandler, { passive: false, capture: true });

    const hostElement = deps.getHostElement();
    if (hostElement) {
      attachedHost = hostElement;
      hostElement.addEventListener('wheel', gestureHandler, { passive: false, capture: true });
      console.debug('[Arcline] Added wheel listener to hostElement for earlier event interception');
    }
  };

  const teardown = () => {
    if (gestureHandler) {
      window.removeEventListener('wheel', gestureHandler, { capture: true });
      if (attachedHost) {
        attachedHost.removeEventListener('wheel', gestureHandler, { capture: true });
        attachedHost = null;
      }
      gestureHandler = null;
    }

    clearTimer(swipeResetTimer);
    clearTimer(cooldownTimer);
    clearTimer(scrollEndFallbackTimer);
    scrollEndFallbackTimer = null;
    resetGesture();
    phase = 'idle';
  };

  const updateSettings = (settings: GestureSettings) => {
    gesturesEnabled = settings.gesturesEnabled;
    deltaScale = clamp(settings.gestureSensitivity / 100, 0.6, 1.6);
  };

  const triggerFlickTransition = (direction: SwipeDirection, onComplete?: () => void) => {
    const target = getTransitionTarget(deps.getShadowRoot());
    const width = getTransitionWidth(target);
    if (!target || !width || phase !== 'idle') {
      return false;
    }

    phase = 'committing';
    deps.onPageTransition?.();
    const endOffset = direction === 'left' ? -width : width;
    applyTransitionOffset(target, endOffset, {
      animate: true,
      durationMs: FLICK_ANIMATION_MS,
    });

    window.setTimeout(() => {
      applyTransitionOffset(target, 0, { animate: false });
      dispatchSwipeProgress(0);
      resetGesture();
      enterCooldown();
      onComplete?.();
    }, FLICK_ANIMATION_MS);

    return true;
  };

  const playHandoffTransition = (transition: SpaceTransitionHandoff): boolean => {
    const target = getTransitionTarget(deps.getShadowRoot());
    const width = getTransitionWidth(target);
    if (!target || !width) {
      return false;
    }

    const progress = clamp(transition.progress, 0, 1);
    const startOffset =
      transition.direction === 'left' ? -(1 - progress) * width : (1 - progress) * width;

    applyTransitionOffset(target, startOffset, { animate: false });
    dispatchSwipeProgress(0);

    window.setTimeout(() => {
      applyTransitionOffset(target, 0, {
        animate: true,
        durationMs: HANDOFF_ANIMATION_MS,
      });
    }, 0);

    return true;
  };

  return {
    setup,
    teardown,
    updateSettings,
    triggerFlickTransition,
    playHandoffTransition,
  };
}
