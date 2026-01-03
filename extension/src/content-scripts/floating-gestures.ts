import { SwipeDetector, type SwipeDirection } from '@/lib/gestures';

import { updateSwipeDebugInfo } from './floating-swipe-debug';

type GestureSettings = {
  gesturesEnabled: boolean;
  gestureSensitivity: number;
};

type GestureControllerDeps = {
  getShadowRoot: () => ShadowRoot | null;
  getHostElement: () => HTMLElement | null;
  ensureHost: () => void;
  onNavigateSpace: (direction: SwipeDirection) => void;
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

const FEEDBACK_ID = 'arcline-swipe-feedback';

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

function updateFloatingUISlidePosition(shadowRoot: ShadowRoot | null, totalDelta: number) {
  if (!shadowRoot) return;
  const floatingContainer = shadowRoot.querySelector(
    '#arcline-floating-ui-container'
  ) as HTMLDivElement | null;
  if (!floatingContainer) return;

  const translateX = -totalDelta * 0.8;
  floatingContainer.style.transition = 'none';
  floatingContainer.style.transform = `translateX(${translateX}px)`;

  // Dispatch swipe progress event (normalized to -1 to 1)
  // Assume threshold is ~100px for full swipe
  const progress = Math.max(-1, Math.min(1, totalDelta / 100));
  window.dispatchEvent(
    new CustomEvent('arcline-swipe-progress', {
      detail: { progress },
    })
  );
}

function resetFloatingUISlidePosition(shadowRoot: ShadowRoot | null) {
  if (!shadowRoot) return;
  const floatingContainer = shadowRoot.querySelector(
    '#arcline-floating-ui-container'
  ) as HTMLDivElement | null;
  if (!floatingContainer) return;

  floatingContainer.style.transition = 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
  floatingContainer.style.transform = 'translateX(0)';

  // Reset swipe progress
  window.dispatchEvent(
    new CustomEvent('arcline-swipe-progress', {
      detail: { progress: 0 },
    })
  );
}

function ensureFeedbackStyles(shadowRoot: ShadowRoot | null) {
  if (!shadowRoot) return;
  if (shadowRoot.querySelector('#arcline-feedback-styles')) return;

  const style = document.createElement('style');
  style.id = 'arcline-feedback-styles';
  style.textContent = `
    .arcline-feedback {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 2147483647;
      opacity: 0;
      transition: opacity 0.2s ease-out, transform 0.2s ease-out;
      background: rgba(0, 0, 0, 0.85);
      border-radius: 16px;
      padding: 20px 32px;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .arcline-feedback.show {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.0);
    }
    .arcline-feedback.enter {
      transform: translate(-50%, -50%) scale(0.85);
    }
    .arcline-feedback svg {
      width: 40px;
      height: 40px;
      stroke: currentColor;
      stroke-width: 2.5;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      flex-shrink: 0;
    }
    .arcline-feedback-label {
      font-size: 16px;
      font-weight: 600;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      white-space: nowrap;
    }
  `;
  shadowRoot.append(style);
}

function showFeedback(
  shadowRoot: ShadowRoot | null,
  ensureHost: () => void,
  direction: SwipeDirection
) {
  ensureHost();
  if (!shadowRoot) return;
  ensureFeedbackStyles(shadowRoot);

  let el = shadowRoot.getElementById(FEEDBACK_ID) as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = FEEDBACK_ID;
    el.className = 'arcline-feedback enter';
    shadowRoot.append(el);
  }

  const leftIcon = `<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>`;
  const rightIcon = `<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>`;
  const leftLabel = 'Previous Space';
  const rightLabel = 'Next Space';

  el.innerHTML = `
    ${direction === 'left' ? leftIcon : rightIcon}
    <div class="arcline-feedback-label">${direction === 'left' ? leftLabel : rightLabel}</div>
  `;

  el.classList.remove('show');
  el.classList.add('enter');
  void el.offsetWidth;
  el.classList.add('show');
  el.classList.remove('enter');

  setTimeout(() => {
    el?.classList.remove('show');
  }, 800);
}

export function createFloatingGestureController(deps: GestureControllerDeps) {
  const swipeDetector = new SwipeDetector();
  let gesturesEnabled = true;
  let gestureHandler: ((e: WheelEvent) => void) | null = null;
  let swipeResetTimer: ReturnType<typeof setTimeout> | null = null;
  let attachedHost: HTMLElement | null = null;

  const handleHorizontalSwipe = (
    e: WheelEvent,
    context: SwipeDebugContext,
    shadowRoot: ShadowRoot | null
  ) => {
    const nextDelta = context.currentDelta + e.deltaX;
    updateFloatingUISlidePosition(shadowRoot, nextDelta);

    if (swipeResetTimer) {
      clearTimeout(swipeResetTimer);
    }
    swipeResetTimer = setTimeout(() => {
      resetFloatingUISlidePosition(shadowRoot);
      swipeResetTimer = null;
    }, 300);

    const direction = swipeDetector.process(e);
    reportSwipeDebug(
      context,
      direction ? `space-nav-${direction}` : 'accumulating',
      true,
      nextDelta
    );

    if (!direction) return;

    if (swipeResetTimer) {
      clearTimeout(swipeResetTimer);
      swipeResetTimer = null;
    }
    resetFloatingUISlidePosition(shadowRoot);

    deps.onNavigateSpace(direction);
    showFeedback(shadowRoot, deps.ensureHost, direction);
  };

  const logHorizontalSwipeInside = (context: SwipeDebugContext, shadowRoot: ShadowRoot | null) => {
    if (
      context.isInsideFloatingUI &&
      Math.abs(context.deltaX) >= 3 &&
      Math.abs(context.deltaY) <= Math.abs(context.deltaX)
    ) {
      console.log('[Arcline Debug] 🔍 Horizontal swipe inside Floating UI detected:', {
        deltaX: context.deltaX,
        deltaY: context.deltaY,
        isInsideFloatingUI: context.isInsideFloatingUI,
        pathLength: context.pathLength,
        targetInfo: context.targetInfo,
        shadowRootHost: shadowRoot?.host,
        willPreventDefault: true,
      });
    }
  };

  const handleOutsideFloatingUI = (context: SwipeDebugContext) => {
    if (!context.isInsideFloatingUI) {
      reportSwipeDebug(context, 'floating-ui-closed', false);
      return true;
    }
    return false;
  };

  const handleGesturesDisabled = (context: SwipeDebugContext, shadowRoot: ShadowRoot | null) => {
    if (!gesturesEnabled) {
      resetFloatingUISlidePosition(shadowRoot);
      reportSwipeDebug(context, 'gestures-disabled', false);
      return true;
    }
    return false;
  };

  const handleVerticalDominant = (context: SwipeDebugContext, shadowRoot: ShadowRoot | null) => {
    const isVerticalDominant = Math.abs(context.deltaY) > Math.abs(context.deltaX);
    if (isVerticalDominant) {
      resetFloatingUISlidePosition(shadowRoot);
      reportSwipeDebug(context, 'vertical-dominant', false);
      return true;
    }
    return false;
  };

  const handleNoiseThreshold = (context: SwipeDebugContext) => {
    if (Math.abs(context.deltaX) < 3) {
      reportSwipeDebug(context, 'noise-threshold', true);
      return true;
    }
    return false;
  };

  const setup = () => {
    if (gestureHandler) return;
    gestureHandler = (e: WheelEvent) => {
      const startTime = performance.now();
      const shadowRoot = deps.getShadowRoot();
      const context = buildSwipeDebugContext(e, startTime, shadowRoot);
      context.currentDelta = swipeDetector.getCurrentDelta();

      logHorizontalSwipeInside(context, shadowRoot);

      if (handleOutsideFloatingUI(context)) return;
      if (handleGesturesDisabled(context, shadowRoot)) return;
      if (handleVerticalDominant(context, shadowRoot)) return;

      e.preventDefault();
      e.stopPropagation();

      if (handleNoiseThreshold(context)) return;

      handleHorizontalSwipe(e, context, shadowRoot);
    };

    window.addEventListener('wheel', gestureHandler, { passive: false, capture: true });

    const hostElement = deps.getHostElement();
    if (hostElement) {
      attachedHost = hostElement;
      hostElement.addEventListener('wheel', gestureHandler, { passive: false, capture: true });
      console.log('[Arcline] Added wheel listener to hostElement for earlier event interception');
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
  };

  const updateSettings = (settings: GestureSettings) => {
    swipeDetector.updateConfig({ threshold: settings.gestureSensitivity });
    gesturesEnabled = settings.gesturesEnabled;
  };

  return { setup, teardown, updateSettings };
}
