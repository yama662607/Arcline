/// <reference types="chrome" />

import '@/dev/reactPreamble';

import { SwipeDetector } from '@/lib/gestures';
import { hasChromeRuntime, requestSettings, requestUiMode, type UiMode } from './shared-utils';
import {
  EdgeDetectionState,
  getEdgeDetectionConfig,
  subscribeEdgeDetectionConfig,
} from './edge-detection-config';

const HOST_ID = 'arcline-floating-root';
const BOOTSTRAP_MARK = 'data-arcline-floating-bootstrap';
const HOTZONE_WIDTH_PX = 8;
const SAMPLE_STALE_THRESHOLD_MS = 250;
let hostElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let bootstrapHotzone: HTMLDivElement | null = null;
let mountPromise: Promise<typeof import('../floating/mount') | null> | null = null;
let floatingInstance: Awaited<
  ReturnType<typeof import('../floating/mount')['mountFloatingUi']>
> | null = null;
let currentMode: UiMode | null = null;
let edgeDetectionHandler: ((e: PointerEvent) => void) | null = null;
let pointerMoveHandler: ((e: PointerEvent) => void) | null = null;
let pointerRawUpdateHandler: ((e: Event) => void) | null = null;
let pointerLeaveHandler: ((e: PointerEvent) => void) | null = null;
let gestureHandler: ((e: WheelEvent) => void) | null = null;
const swipeDetector = new SwipeDetector(); // Uses default config with cooldown
let gesturesEnabled = true;
let swipeResetTimer: ReturnType<typeof setTimeout> | null = null;
let swipeDebugEnabled = false;
let swipeDebugWindow: HTMLDivElement | null = null;
let isFloatingUIOpen = false; // Track if Floating UI is currently open
let swipeEventHistory: Array<{
  time: number;
  deltaX: number;
  deltaY: number;
  prevented: boolean;
  reason: string;
  scrollable: boolean;
  scrollLeft: number;
  currentDelta: number;
  processingTime: number;
  isInsideFloatingUI?: boolean;
  pathLength?: number;
  targetInfo?: string;
}> = [];
let swipeEventCount = 0;
let swipePreventCount = 0;
let logStartTime = Date.now();
let edgeDetectionState: EdgeDetectionState = EdgeDetectionState.IDLE;
let lastVelocityX = 0;
let lastVelocityY = 0;
let lastPointerEventTime = 0;
let lastPointerScreenX: number | null = null;
let lastPointerClientX: number | null = null;
let lastPointerClientY: number | null = null;
let config = getEdgeDetectionConfig();
let lastInferenceTime = 0;
subscribeEdgeDetectionConfig((next) => {
  config = next;
});

interface DebugInfo {
  clientX: number;
  clientY: number;
  lastX: number | null;
  inHotzone: boolean;
  movingLeft: boolean;
  startedOutside: boolean;
  hotzoneIntersects: boolean;
  shouldTrigger: boolean;
  rafPending: boolean;
  targetTag: string | null;
  targetId: string | null;
  targetClass: string | null;
  screenX?: number;
  windowScreenX?: number;
  distanceFromWindowEdge?: number;
  velocityX?: number;
  velocityY?: number;
  state?: EdgeDetectionState;
  lastEventType?: string;
  coalescedEventsCount?: number;
}

let updateDebugInfoFn: ((info: DebugInfo) => void) | null = null;
let debugFrameId: number | null = null;
let pendingDebugInfo: DebugInfo | null = null;

declare global {
  interface Window {
    __arclineFloatingReady?: boolean;
  }
}

function queueDebugInfo(info: DebugInfo) {
  if (!updateDebugInfoFn) return;
  pendingDebugInfo = info;
  if (debugFrameId !== null) return;
  debugFrameId = requestAnimationFrame(() => {
    debugFrameId = null;
    if (pendingDebugInfo && updateDebugInfoFn) {
      updateDebugInfoFn(pendingDebugInfo);
      pendingDebugInfo = null;
    }
  });
}

function recordPointerSample(
  event: PointerEvent,
  source: string,
  target: Element | null,
  options?: { coalescedEventsCount?: number }
) {
  const clientX = event.clientX;
  const clientY = event.clientY;
  const lastX = lastPointerClientX;
  const lastY = lastPointerClientY;

  lastPointerClientX = clientX;
  lastPointerClientY = clientY;
  lastPointerScreenX = event.screenX;
  lastPointerEventTime = performance.now();
  lastVelocityX = lastX !== null ? clientX - lastX : 0;
  lastVelocityY = lastY !== null ? clientY - lastY : 0;
  updateEdgeDetectionStateForX(clientX);

  queueDebugInfo({
    clientX,
    clientY,
    lastX,
    inHotzone: clientX <= HOTZONE_WIDTH_PX, // 負の値も含める
    movingLeft: lastX !== null ? clientX < lastX : false,
    startedOutside: lastX !== null ? lastX > HOTZONE_WIDTH_PX : false,
    hotzoneIntersects: false,
    shouldTrigger: clientX <= HOTZONE_WIDTH_PX,
    rafPending: debugFrameId !== null,
    targetTag: target?.tagName ?? null,
    targetId: target?.id ?? null,
    targetClass:
      target && typeof target.className === 'string' ? (target.className as string) : null,
    screenX: event.screenX,
    windowScreenX: window.screenX,
    distanceFromWindowEdge: event.screenX - window.screenX,
    velocityX: lastVelocityX,
    velocityY: lastVelocityY,
    state: edgeDetectionState,
    lastEventType: source,
    coalescedEventsCount: options?.coalescedEventsCount,
  });
}

function handlePointerLeave(event: PointerEvent) {
  // pointerleave 時の clientX が負の値 = ウィンドウ左端を超えた = ホットゾーン通過
  const currentClientX = event.clientX;
  const isInHotzone = currentClientX <= HOTZONE_WIDTH_PX;

  // 速度を計算（最後の pointermove からの移動）
  const inferredVelocityX = lastPointerClientX !== null ? currentClientX - lastPointerClientX : 0;
  const displayVelocityX = inferredVelocityX !== 0 ? inferredVelocityX : lastVelocityX;

  queueDebugInfo({
    clientX: currentClientX,
    clientY: event.clientY,
    lastX: lastPointerClientX,
    inHotzone: isInHotzone, // 現在の位置で判定（負の値も含める）
    movingLeft: displayVelocityX < 0 || currentClientX < (lastPointerClientX ?? 0),
    startedOutside: (lastPointerClientX ?? 0) > HOTZONE_WIDTH_PX,
    hotzoneIntersects: false,
    shouldTrigger: isInHotzone, // ホットゾーン内なら shouldTrigger=true
    rafPending: debugFrameId !== null,
    targetTag: null,
    targetId: null,
    targetClass: null,
    screenX: event.screenX,
    windowScreenX: window.screenX,
    distanceFromWindowEdge: event.screenX - window.screenX,
    velocityX: displayVelocityX, // 推論された速度を使用
    velocityY: lastVelocityY,
    state: edgeDetectionState,
    lastEventType: 'pointerleave',
  });

  // pointerleave 時に clientX がホットゾーン内（負の値を含む）なら直接起動
  if (isInHotzone && (lastPointerClientX ?? 0) > HOTZONE_WIDTH_PX) {
    maybeLogEdgeDebug('pointerleave-hotzone-direct', {
      currentClientX,
      lastClientX: lastPointerClientX,
      inferredVelocityX,
    });
    openFloatingUiFromEdge();
    return;
  }

  // Phase 2 の推論ロジック
  if (!config.pointerLeaveInferenceEnabled) {
    return;
  }

  const now = performance.now();
  const timeSinceSample = now - lastPointerEventTime;
  const sampleFresh = timeSinceSample <= SAMPLE_STALE_THRESHOLD_MS;
  const exitedDom = event.relatedTarget === null;
  const movingLeftFast = lastVelocityX <= config.snapVelocityThreshold;
  const movingVerticallySlow = Math.abs(lastVelocityY) <= config.maxVelocityYThreshold;

  const lastClientX = lastPointerClientX ?? event.clientX;
  const viewportClose = lastClientX <= config.viewportEdgeThresholdPx;

  const lastScreenX = lastPointerScreenX ?? event.screenX;
  const distanceFromWindowEdge = lastScreenX - window.screenX;
  const windowClose = distanceFromWindowEdge <= config.windowEdgeThresholdPx;

  const cooldownElapsed = now - lastInferenceTime >= config.inferenceCooldownMs;

  if (
    exitedDom &&
    sampleFresh &&
    movingLeftFast &&
    movingVerticallySlow &&
    viewportClose &&
    windowClose &&
    cooldownElapsed
  ) {
    lastInferenceTime = now;
    maybeLogEdgeDebug('pointerleave-inference', {
      lastClientX,
      lastScreenX,
      timeSinceSample,
      distanceFromWindowEdge,
      lastVelocityX,
      lastVelocityY,
    });
    openFloatingUiFromEdge();
  }
}

function ensureHost() {
  if (hostElement && shadowRoot) {
    return;
  }

  const existing = document.getElementById(HOST_ID);
  if (existing) {
    hostElement = existing;
    shadowRoot = existing.shadowRoot ?? existing.attachShadow({ mode: 'open' });
    return;
  }

  const element = document.createElement('div');
  element.id = HOST_ID;
  element.setAttribute('aria-hidden', 'true');
  element.style.position = 'fixed';
  element.style.top = '0';
  element.style.left = '0';
  element.style.height = '100vh';
  element.style.width = `${HOTZONE_WIDTH_PX}px`;
  element.style.transition = 'none'; // Disable CSS transitions to avoid animation conflicts
  element.style.zIndex = '2147483646';
  element.style.pointerEvents = 'auto';
  document.documentElement.append(element);

  hostElement = element;
  shadowRoot = element.attachShadow({ mode: 'open' });
}

function ensureBootstrapHotzone() {
  if (!hostElement || !shadowRoot) return;
  if (bootstrapHotzone && shadowRoot.contains(bootstrapHotzone)) return;

  const hotzone = document.createElement('div');
  hotzone.setAttribute(BOOTSTRAP_MARK, 'true');
  hotzone.style.position = 'absolute';
  hotzone.style.inset = '0';
  hotzone.style.pointerEvents = 'auto';
  hotzone.style.cursor = 'default';
  hotzone.style.background = 'transparent';
  hotzone.addEventListener('pointerenter', () => {
    void startFloatingUi();
  });

  shadowRoot.append(hotzone);
  bootstrapHotzone = hotzone;
  window.__arclineFloatingReady = true;
}

function setHostPointerEvents(enabled: boolean) {
  if (!hostElement) return;
  hostElement.style.pointerEvents = enabled ? 'auto' : 'none';
}

function openFloatingUiFromEdge() {
  if (floatingInstance) {
    floatingInstance.openFromHover();
    setHostPointerEvents(false);
    return;
  }
  void startFloatingUi();
}

function updateEdgeDetectionStateForX(x: number) {
  if (x <= HOTZONE_WIDTH_PX) {
    edgeDetectionState = EdgeDetectionState.BORDER;
    return;
  }
  edgeDetectionState =
    x <= config.viewportEdgeThresholdPx ? EdgeDetectionState.PROXIMITY : EdgeDetectionState.IDLE;
}

function maybeLogEdgeDebug(source: string, payload: Record<string, unknown>) {
  if (!config.debugLogging) return;
  console.debug('[Arcline][EdgeDetection]', source, payload);
}

async function startFloatingUi(options?: { instant?: boolean; commandPalette?: boolean }) {
  if (!hostElement || !shadowRoot) return;
  if (!mountPromise) {
    mountPromise = import('../floating/mount').catch((error) => {
      console.error('[Arcline] Failed to load floating UI', error);
      mountPromise = null;
      return null;
    });
  }

  const module = await mountPromise;
  if (!module) return;
  if (floatingInstance) {
    if (options?.instant) {
      floatingInstance.openInstantly();
    } else if (options?.commandPalette) {
      floatingInstance.openCommandPalette();
    } else {
      floatingInstance.openFromHover();
    }
    isFloatingUIOpen = true; // Mark as open
    return;
  }

  floatingInstance = await module
    .mountFloatingUi({
      host: hostElement,
      shadowRoot,
      onBootstrapReady: () => {
        bootstrapHotzone?.remove();
        bootstrapHotzone = null;
      },
      onClosed: () => {
        isFloatingUIOpen = false; // Mark as closed
        enableHostElementPointerEvents();
      },
    })
    .catch((error) => {
      console.error('[Arcline] Failed to mount floating UI', error);
      floatingInstance = null;
      return null;
    });

  if (options?.instant) {
    floatingInstance?.openInstantly();
  } else if (options?.commandPalette) {
    floatingInstance?.openCommandPalette();
  } else {
    floatingInstance?.openFromHover();
  }
  isFloatingUIOpen = true; // Mark as open
}

function setupEdgeDetection() {
  if (!hostElement) return;
  if (edgeDetectionHandler) return;

  if (import.meta.env.DEV) {
    void import('./edge-detection-debug')
      .then((module) => {
        updateDebugInfoFn = module.updateDebugInfo;
        module.enableEdgeDetectionDebug();
      })
      .catch((error) => {
        console.warn('[Arcline] Failed to load edge detection debug', error);
      });
  }

  let lastEnterTime = 0;
  const ENTER_DEBOUNCE_MS = 100;

  edgeDetectionHandler = (e: PointerEvent) => {
    const now = Date.now();
    if (now - lastEnterTime < ENTER_DEBOUNCE_MS) {
      return;
    }
    lastEnterTime = now;
    const target = e.target instanceof Element ? e.target : null;
    recordPointerSample(e, 'pointerenter', target);
    openFloatingUiFromEdge();
  };

  pointerMoveHandler = (e: PointerEvent) => {
    const target = e.target instanceof Element ? e.target : null;

    // Phase 1: getCoalescedEvents() で間引きされたイベントもチェック
    // 高速移動時にホットゾーンを「飛び越える」問題を解決
    const coalescedEvents = e.getCoalescedEvents?.() || [e];

    // デバッグ情報に coalesced events の数を記録
    recordPointerSample(e, 'pointermove', target, {
      coalescedEventsCount: coalescedEvents.length,
    });

    // 中間イベントでホットゾーン通過をチェック（負の値も含める）
    for (const event of coalescedEvents) {
      if (event.clientX <= HOTZONE_WIDTH_PX) {
        // ホットゾーン内を通過 → Floating UI を起動
        maybeLogEdgeDebug('coalesced-hotzone-detected', {
          clientX: event.clientX,
          screenX: event.screenX,
          totalCoalescedEvents: coalescedEvents.length,
          eventIndex: coalescedEvents.indexOf(event),
        });
        openFloatingUiFromEdge();
        break;
      }
    }
  };

  pointerRawUpdateHandler = (ev: Event) => {
    if (!(ev instanceof PointerEvent)) return;
    const target = ev.target instanceof Element ? ev.target : null;

    // Phase 1: getCoalescedEvents() で間引きされたイベントもチェック
    const coalescedEvents = ev.getCoalescedEvents?.() || [ev];

    // デバッグ情報に coalesced events の数を記録
    recordPointerSample(ev, 'pointerrawupdate', target, {
      coalescedEventsCount: coalescedEvents.length,
    });

    // 中間イベントでホットゾーン通過をチェック（負の値も含める）
    for (const event of coalescedEvents) {
      if (event.clientX <= HOTZONE_WIDTH_PX) {
        maybeLogEdgeDebug('coalesced-rawupdate-hotzone-detected', {
          clientX: event.clientX,
          screenX: event.screenX,
          totalCoalescedEvents: coalescedEvents.length,
          eventIndex: coalescedEvents.indexOf(event),
        });
        openFloatingUiFromEdge();
        break;
      }
    }
  };

  pointerLeaveHandler = (e: PointerEvent) => {
    handlePointerLeave(e);
  };

  hostElement.addEventListener('pointerenter', edgeDetectionHandler);
  window.addEventListener('pointermove', pointerMoveHandler, { passive: true });
  window.addEventListener('pointerrawupdate', pointerRawUpdateHandler, { passive: true });
  document.addEventListener('pointerleave', pointerLeaveHandler, true);
}

function teardownEdgeDetection() {
  if (edgeDetectionHandler && hostElement) {
    hostElement.removeEventListener('pointerenter', edgeDetectionHandler);
    edgeDetectionHandler = null;
  }

  if (pointerMoveHandler) {
    window.removeEventListener('pointermove', pointerMoveHandler);
    pointerMoveHandler = null;
  }

  if (pointerRawUpdateHandler) {
    window.removeEventListener('pointerrawupdate', pointerRawUpdateHandler);
    pointerRawUpdateHandler = null;
  }

  if (pointerLeaveHandler) {
    document.removeEventListener('pointerleave', pointerLeaveHandler, true);
    pointerLeaveHandler = null;
  }
}

/**
 * Check if the page is horizontally scrollable
 * Used to avoid blocking native horizontal scroll when user wants to scroll the page
 */
function isPageHorizontallyScrollable(): boolean {
  const scrollWidth = document.documentElement.scrollWidth;
  const clientWidth = document.documentElement.clientWidth;
  return scrollWidth > clientWidth + 5; // 5px tolerance for rounding
}

/**
 * Check if user is intentionally scrolling the page (not swiping for space navigation)
 * Returns true if:
 * - Page is horizontally scrollable AND
 * - Current scroll position is not at the edge corresponding to swipe direction
 */
function isIntentionalPageScroll(deltaX: number): boolean {
  if (!isPageHorizontallyScrollable()) {
    return false;
  }

  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
  const scrollWidth = document.documentElement.scrollWidth;
  const clientWidth = document.documentElement.clientWidth;
  const maxScroll = scrollWidth - clientWidth;

  // Swiping left (deltaX > 0) when not at right edge = probably want to scroll page
  if (deltaX > 0 && scrollLeft < maxScroll - 10) {
    return true;
  }

  // Swiping right (deltaX < 0) when not at left edge = probably want to scroll page
  if (deltaX < 0 && scrollLeft > 10) {
    return true;
  }

  return false;
}

function setupTrackpadGestures() {
  if (gestureHandler) return;

  gestureHandler = (e: WheelEvent) => {
    const startTime = performance.now();
    const scrollable = isPageHorizontallyScrollable();
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    const currentDelta = swipeDetector.getCurrentDelta();

    // Check if event originated from within Floating UI shadow root
    // This is more reliable than isFloatingUIOpen flag which may be out of sync during animations
    const path = e.composedPath();
    const isInsideFloatingUI = shadowRoot && path.includes(shadowRoot.host);

    // Debug info
    const pathLength = path.length;
    const targetInfo = `target=${(e.target as HTMLElement)?.tagName || 'unknown'}, host=${shadowRoot?.host?.tagName || 'none'}`;

    // Console debug: log events that should prevent browser back but might not be
    if (isInsideFloatingUI && Math.abs(e.deltaX) >= 3 && Math.abs(e.deltaY) <= Math.abs(e.deltaX)) {
      console.log('[Arcline Debug] 🔍 Horizontal swipe inside Floating UI detected:', {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        isInsideFloatingUI,
        pathLength,
        targetInfo,
        shadowRootHost: shadowRoot?.host,
        willPreventDefault: true,
      });
    }

    if (!isInsideFloatingUI) {
      // Event is outside Floating UI: ignore all gesture detection, allow native scrolling
      updateSwipeDebugInfo({
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        prevented: false,
        reason: 'floating-ui-closed',
        scrollable,
        scrollLeft,
        currentDelta,
        processingTime: performance.now() - startTime,
        isInsideFloatingUI: false,
        pathLength,
        targetInfo,
      });
      return;
    }

    // From here on, we're INSIDE Floating UI

    // Check vertical-dominant FIRST, before preventDefault()
    // This ensures smooth vertical scrolling is never blocked
    const isVerticalDominant = Math.abs(e.deltaY) > Math.abs(e.deltaX);

    if (!gesturesEnabled) {
      resetFloatingUISlidePosition();
      updateSwipeDebugInfo({
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        prevented: false,
        reason: 'gestures-disabled',
        scrollable,
        scrollLeft,
        currentDelta,
        processingTime: performance.now() - startTime,
        isInsideFloatingUI: true,
        pathLength,
        targetInfo,
      });
      return;
    }

    // Allow vertical scrolling: if vertical movement is dominant, don't prevent
    // This ensures smooth scrolling inside Floating UI
    // CRITICAL: Check this BEFORE preventDefault() to never block vertical scrolling
    if (isVerticalDominant) {
      resetFloatingUISlidePosition();
      updateSwipeDebugInfo({
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        prevented: false,
        reason: 'vertical-dominant',
        scrollable,
        scrollLeft,
        currentDelta,
        processingTime: performance.now() - startTime,
        isInsideFloatingUI: true,
        pathLength,
        targetInfo,
      });
      return;
    }

    // ========================================
    // CRITICAL: Prevent browser gestures IMMEDIATELY for horizontal events
    // This must happen as early as possible to block browser back/forward
    // ========================================
    e.preventDefault();
    e.stopPropagation();

    // Ignore noise: very small horizontal movements (< 3px) are likely accidental
    // Note: preventDefault() was already called above, so these are also prevented
    if (Math.abs(e.deltaX) < 3) {
      updateSwipeDebugInfo({
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        prevented: true,
        reason: 'noise-threshold',
        scrollable,
        scrollLeft,
        currentDelta,
        processingTime: performance.now() - startTime,
        isInsideFloatingUI: true,
        pathLength,
        targetInfo,
      });
      return;
    }

    // ========================================
    // Horizontal swipe detected
    // preventDefault() was already called above
    // ========================================

    // Inside Floating UI: horizontal swipe = space navigation

    // Get current accumulation for UI feedback
    const nextDelta = currentDelta + e.deltaX;

    // Update Floating UI slide position
    updateFloatingUISlidePosition(nextDelta);

    // Reset panel position after user stops swiping
    if (swipeResetTimer) {
      clearTimeout(swipeResetTimer);
    }
    swipeResetTimer = setTimeout(() => {
      resetFloatingUISlidePosition();
      swipeResetTimer = null;
    }, 300);

    const direction = swipeDetector.process(e);

    updateSwipeDebugInfo({
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      prevented: true,
      reason: direction ? `space-nav-${direction}` : 'accumulating',
      scrollable,
      scrollLeft,
      currentDelta: nextDelta,
      processingTime: performance.now() - startTime,
      isInsideFloatingUI: true,
      pathLength,
      targetInfo,
    });

    if (direction) {
      // Clear the reset timer since we're completing the swipe
      if (swipeResetTimer) {
        clearTimeout(swipeResetTimer);
        swipeResetTimer = null;
      }
      resetFloatingUISlidePosition();

      if (typeof crypto.randomUUID !== 'function') return;

      chrome.runtime.sendMessage(
        {
          method: 'navigateSpace',
          params: { direction },
          id: crypto.randomUUID(),
        },
        () => {
          if (chrome.runtime.lastError) {
            // Ignore
          }
        }
      );

      showFeedback(direction);
    }
  };

  // passive: false is required to use preventDefault() for blocking browser gestures
  // capture: true ensures we intercept events BEFORE they bubble up to browser gesture handlers
  window.addEventListener('wheel', gestureHandler, { passive: false, capture: true });

  // CRITICAL: Also add listener to hostElement to catch events earlier in the event path
  // This ensures preventDefault() is called as close to the source as possible
  if (hostElement) {
    hostElement.addEventListener('wheel', gestureHandler, { passive: false, capture: true });
    console.log('[Arcline] Added wheel listener to hostElement for earlier event interception');
  }
}

const FEEDBACK_ID = 'arcline-swipe-feedback';

/**
 * Update Floating UI panel position based on swipe delta
 * The panel slides horizontally as user swipes
 */
function updateFloatingUISlidePosition(totalDelta: number) {
  if (!shadowRoot) return;

  // Find the Floating UI container (the panel that should slide)
  const floatingContainer = shadowRoot.querySelector('#arcline-floating-ui-container') as HTMLDivElement;
  if (!floatingContainer) return;

  // Convert delta to pixels (negative delta = swipe left, positive = swipe right)
  // Dampen the movement slightly for better feel (0.8 factor)
  const translateX = -totalDelta * 0.8;

  // Apply transform without transition for smooth tracking
  floatingContainer.style.transition = 'none';
  floatingContainer.style.transform = `translateX(${translateX}px)`;
}

/**
 * Reset Floating UI panel position with smooth animation
 */
function resetFloatingUISlidePosition() {
  if (!shadowRoot) return;

  const floatingContainer = shadowRoot.querySelector('#arcline-floating-ui-container') as HTMLDivElement;
  if (!floatingContainer) return;

  // Smooth return to original position
  floatingContainer.style.transition = 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
  floatingContainer.style.transform = 'translateX(0)';
}

function ensureFeedbackStyles() {
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

function showFeedback(direction: 'left' | 'right') {
  ensureHost();
  if (!shadowRoot) return;
  ensureFeedbackStyles();

  let el = shadowRoot.getElementById(FEEDBACK_ID) as HTMLDivElement;
  if (!el) {
    el = document.createElement('div');
    el.id = FEEDBACK_ID;
    el.className = 'arcline-feedback enter';
    shadowRoot.append(el);
  }

  // Icons (Chevron Left / Right)
  const leftIcon = `<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>`;
  const rightIcon = `<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>`;

  // Labels
  const leftLabel = 'Previous Space';
  const rightLabel = 'Next Space';

  el.innerHTML = `
    ${direction === 'left' ? leftIcon : rightIcon}
    <div class="arcline-feedback-label">${direction === 'left' ? leftLabel : rightLabel}</div>
  `;

  // Reset animation
  el.classList.remove('show');
  el.classList.add('enter');

  // Force reflow
  void el.offsetWidth;

  // Animate in
  el.classList.add('show');
  el.classList.remove('enter');

  // Hide after delay (short pulse)
  setTimeout(() => {
    el.classList.remove('show');
  }, 800);
}

function teardownTrackpadGestures() {
  if (gestureHandler) {
    window.removeEventListener('wheel', gestureHandler, { capture: true });
    gestureHandler = null;
  }
}

// Swipe Debug Functions
function enableSwipeDebug() {
  if (swipeDebugWindow) return;
  swipeDebugEnabled = true;
  swipeEventHistory = [];
  swipeEventCount = 0;

  swipeDebugWindow = document.createElement('div');
  swipeDebugWindow.id = 'arcline-swipe-debug';
  swipeDebugWindow.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    width: 800px;
    background: rgba(0, 0, 0, 0.95);
    color: #00ff00;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 10px;
    padding: 12px;
    border-radius: 8px;
    z-index: 2147483647;
    box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
    border: 2px solid #00ff00;
    pointer-events: auto;
    user-select: none;
  `;

  swipeDebugWindow.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #00ff00;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-weight: bold; color: #00ffff; font-size: 16px;">
          🔍 Swipe Gesture Debug
        </div>
        <div id="swipe-location-badge" style="padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 13px;"></div>
      </div>
      <div style="font-size: 11px; color: #888; line-height: 1.6;">
        <div>Ctrl+Shift+S: Toggle | Ctrl+Shift+R: Reset</div>
        <div>Ctrl+Shift+E: Copy JSON | Ctrl+Shift+W: Save to File</div>
        <div>Ctrl+Shift+L: Print to Console</div>
      </div>
    </div>

    <!-- Prevent Rate Visualization -->
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-weight: bold; color: #00ffff; font-size: 12px;">Prevent Rate</span>
        <span id="prevent-rate-value" style="font-weight: bold; font-size: 14px;"></span>
      </div>
      <div style="width: 100%; height: 12px; background: rgba(255, 255, 255, 0.1); border-radius: 6px; overflow: hidden; border: 1px solid #333;">
        <div id="prevent-rate-bar" style="height: 100%; transition: width 0.3s ease, background-color 0.3s ease; border-radius: 6px;"></div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
      <!-- Left Column: Current Event -->
      <div>
        <div style="font-weight: bold; color: #00ffff; font-size: 13px; margin-bottom: 6px;">📊 Current Event</div>
        <div id="swipe-current-info" style="line-height: 1.8; font-size: 11px;"></div>
      </div>

      <!-- Middle Column: Page Scroll State -->
      <div>
        <div style="font-weight: bold; color: #00ffff; font-size: 13px; margin-bottom: 6px;">📄 Page State</div>
        <div id="swipe-page-info" style="line-height: 1.8; font-size: 11px;"></div>
      </div>

      <!-- Right Column: Stats -->
      <div>
        <div style="font-weight: bold; color: #00ffff; font-size: 13px; margin-bottom: 6px;">📈 Stats</div>
        <div id="swipe-stats-info" style="line-height: 1.8; font-size: 11px;"></div>
      </div>
    </div>

    <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #333;">
      <div style="font-weight: bold; color: #00ffff; font-size: 13px; margin-bottom: 6px;">📜 Recent Events (Last 10)</div>
      <div id="swipe-history-info" style="font-size: 10px; line-height: 1.6; max-height: 140px; overflow-y: auto;"></div>
    </div>
  `;

  document.documentElement.appendChild(swipeDebugWindow);
}

function disableSwipeDebug() {
  if (swipeDebugWindow) {
    swipeDebugWindow.remove();
    swipeDebugWindow = null;
  }
  swipeDebugEnabled = false;
  swipeEventHistory = [];
  swipeEventCount = 0;
  swipePreventCount = 0;
}

/**
 * Export swipe event logs to clipboard as JSON
 * Includes summary statistics and detailed event history
 */
function exportSwipeLogsToClipboard() {
  if (swipeEventHistory.length === 0) {
    console.warn('[Arcline Debug] No swipe events to export');
    return;
  }

  const now = Date.now();
  const firstEventTime = swipeEventHistory[0]?.time ?? now;
  const sessionDuration = now - logStartTime;

  // Calculate statistics
  const preventRate = swipeEventCount > 0 ? (swipePreventCount / swipeEventCount) * 100 : 0;
  const eventsPerSecond = sessionDuration > 0 ? (swipeEventCount / (sessionDuration / 1000)).toFixed(2) : '0';

  // Group events by reason
  const reasonCounts: Record<string, number> = {};
  for (const event of swipeEventHistory) {
    reasonCounts[event.reason] = (reasonCounts[event.reason] ?? 0) + 1;
  }

  // Create export data
  const exportData = {
    summary: {
      totalEvents: swipeEventCount,
      preventedEvents: swipePreventCount,
      preventRate: `${preventRate.toFixed(1)}%`,
      sessionDuration: `${(sessionDuration / 1000).toFixed(1)}s`,
      eventsPerSecond,
      capturedEvents: swipeEventHistory.length,
      reasonBreakdown: reasonCounts,
    },
    events: swipeEventHistory.map((event, index) => ({
      index,
      relativeTime: `${((event.time - firstEventTime) / 1000).toFixed(3)}s`,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      prevented: event.prevented,
      reason: event.reason,
      scrollable: event.scrollable,
      scrollLeft: event.scrollLeft,
      currentDelta: event.currentDelta,
      processingTime: `${event.processingTime.toFixed(2)}ms`,
      isInsideFloatingUI: event.isInsideFloatingUI,
      pathLength: event.pathLength,
      targetInfo: event.targetInfo,
    })),
  };

  const jsonString = JSON.stringify(exportData, null, 2);

  navigator.clipboard
    .writeText(jsonString)
    .then(() => {
      console.log('[Arcline Debug] ✅ Logs exported to clipboard!');
      console.log(`Total events: ${swipeEventCount}, Prevented: ${swipePreventCount}, Prevent rate: ${preventRate.toFixed(1)}%`);
    })
    .catch((err) => {
      console.error('[Arcline Debug] ❌ Failed to copy to clipboard:', err);
      console.log('[Arcline Debug] Log data:', exportData);
    });
}

/**
 * Print swipe event logs to console
 */
function printSwipeLogsToConsole() {
  if (swipeEventHistory.length === 0) {
    console.warn('[Arcline Debug] No swipe events to print');
    return;
  }

  const now = Date.now();
  const firstEventTime = swipeEventHistory[0]?.time ?? now;
  const sessionDuration = now - logStartTime;
  const preventRate = swipeEventCount > 0 ? (swipePreventCount / swipeEventCount) * 100 : 0;

  console.group('[Arcline Debug] 📊 Swipe Event Logs');
  console.log(`Total events: ${swipeEventCount}`);
  console.log(`Prevented events: ${swipePreventCount}`);
  console.log(`Prevent rate: ${preventRate.toFixed(1)}%`);
  console.log(`Session duration: ${(sessionDuration / 1000).toFixed(1)}s`);
  console.log(`Events in history: ${swipeEventHistory.length}`);
  console.log('---');

  console.table(
    swipeEventHistory.map((event, index) => ({
      '#': index,
      'Time (s)': ((event.time - firstEventTime) / 1000).toFixed(3),
      'ΔX': event.deltaX.toFixed(1),
      'ΔY': event.deltaY.toFixed(1),
      Prevented: event.prevented ? '🚫' : '✅',
      Reason: event.reason,
      'Acc Delta': event.currentDelta.toFixed(1),
      'Process (ms)': event.processingTime.toFixed(2),
    }))
  );

  console.groupEnd();
}

/**
 * Export swipe event logs to file (downloads to browser's download folder)
 * File can then be moved to docs/logs/ directory
 */
function exportSwipeLogsToFile() {
  if (swipeEventHistory.length === 0) {
    console.warn('[Arcline Debug] No swipe events to export');
    return;
  }

  const now = Date.now();
  const firstEventTime = swipeEventHistory[0]?.time ?? now;
  const sessionDuration = now - logStartTime;

  // Calculate statistics
  const preventRate = swipeEventCount > 0 ? (swipePreventCount / swipeEventCount) * 100 : 0;
  const eventsPerSecond = sessionDuration > 0 ? (swipeEventCount / (sessionDuration / 1000)).toFixed(2) : '0';

  // Group events by reason
  const reasonCounts: Record<string, number> = {};
  for (const event of swipeEventHistory) {
    reasonCounts[event.reason] = (reasonCounts[event.reason] ?? 0) + 1;
  }

  // Create export data with metadata
  const exportData = {
    metadata: {
      timestamp: new Date().toISOString(),
      exportedAt: new Date().toLocaleString('ja-JP'),
      sessionDuration: `${(sessionDuration / 1000).toFixed(1)}s`,
      totalEvents: swipeEventCount,
      preventedEvents: swipePreventCount,
      preventRate: `${preventRate.toFixed(1)}%`,
    },
    summary: {
      totalEvents: swipeEventCount,
      preventedEvents: swipePreventCount,
      preventRate: `${preventRate.toFixed(1)}%`,
      sessionDuration: `${(sessionDuration / 1000).toFixed(1)}s`,
      eventsPerSecond,
      capturedEvents: swipeEventHistory.length,
      reasonBreakdown: reasonCounts,
    },
    events: swipeEventHistory.map((event, index) => ({
      index,
      relativeTime: `${((event.time - firstEventTime) / 1000).toFixed(3)}s`,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      prevented: event.prevented,
      reason: event.reason,
      scrollable: event.scrollable,
      scrollLeft: event.scrollLeft,
      currentDelta: event.currentDelta,
      processingTime: `${event.processingTime.toFixed(2)}ms`,
      isInsideFloatingUI: event.isInsideFloatingUI,
      pathLength: event.pathLength,
      targetInfo: event.targetInfo,
    })),
  };

  const jsonString = JSON.stringify(exportData, null, 2);

  // Create filename with timestamp
  const date = new Date();
  const dateStr = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
  const filename = `${dateStr}-${timeStr}-swipe-events.json`;

  // Create blob and download
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('[Arcline Debug] ✅ Logs exported to file!');
  console.log(`Filename: ${filename}`);
  console.log(`Total events: ${swipeEventCount}, Prevented: ${swipePreventCount}, Prevent rate: ${preventRate.toFixed(1)}%`);
  console.log('💡 Move the downloaded file to docs/logs/ directory');
}

function updateSwipeDebugInfo(info: {
  deltaX: number;
  deltaY: number;
  prevented: boolean;
  reason: string;
  scrollable: boolean;
  scrollLeft: number;
  currentDelta: number;
  processingTime?: number;
  isInsideFloatingUI?: boolean;
  pathLength?: number;
  targetInfo?: string;
}) {
  if (!swipeDebugEnabled || !swipeDebugWindow) return;

  swipeEventCount++;
  if (info.prevented) {
    swipePreventCount++;
  }

  swipeEventHistory.push({
    time: Date.now(),
    deltaX: info.deltaX,
    deltaY: info.deltaY,
    prevented: info.prevented,
    reason: info.reason,
    scrollable: info.scrollable,
    scrollLeft: info.scrollLeft,
    currentDelta: info.currentDelta,
    processingTime: info.processingTime ?? 0,
    isInsideFloatingUI: info.isInsideFloatingUI,
    pathLength: info.pathLength,
    targetInfo: info.targetInfo,
  });

  // Keep last 1000 events for detailed analysis
  if (swipeEventHistory.length > 1000) {
    swipeEventHistory.shift();
  }

  // Update location badge (Floating UI Open/Closed)
  const locationBadge = swipeDebugWindow.querySelector('#swipe-location-badge');
  if (locationBadge) {
    const isOpen = info.reason !== 'floating-ui-closed';
    const badgeText = isOpen ? '✅ FLOATING UI OPEN' : '❌ FLOATING UI CLOSED';
    const badgeBg = isOpen ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';
    const badgeBorder = isOpen ? '#00ff00' : '#ff0000';
    const badgeColor = isOpen ? '#00ff00' : '#ff0000';

    locationBadge.innerHTML = badgeText;
    (locationBadge as HTMLElement).style.background = badgeBg;
    (locationBadge as HTMLElement).style.border = `2px solid ${badgeBorder}`;
    (locationBadge as HTMLElement).style.color = badgeColor;
  }

  // Calculate prevent rate
  const preventedCount = swipeEventHistory.filter((e) => e.prevented).length;
  const preventRate = swipeEventHistory.length > 0 ? (preventedCount / swipeEventHistory.length) * 100 : 0;

  // Update prevent rate visualization
  const preventRateBar = swipeDebugWindow.querySelector('#prevent-rate-bar');
  const preventRateValue = swipeDebugWindow.querySelector('#prevent-rate-value');
  if (preventRateBar && preventRateValue) {
    const barWidth = `${preventRate}%`;
    let barColor = '#00ff00'; // Green (good)
    if (preventRate > 70) {
      barColor = '#ff0000'; // Red (bad)
    } else if (preventRate > 30) {
      barColor = '#ffff00'; // Yellow (warning)
    }

    (preventRateBar as HTMLElement).style.width = barWidth;
    (preventRateBar as HTMLElement).style.backgroundColor = barColor;
    preventRateValue.innerHTML = `<span style="color: ${barColor};">${preventRate.toFixed(0)}%</span>`;
  }

  // Update current event info (larger font)
  const currentContainer = swipeDebugWindow.querySelector('#swipe-current-info');
  if (currentContainer) {
    currentContainer.innerHTML = `
      <div><strong>deltaX:</strong> <span style="color: ${Math.abs(info.deltaX) > Math.abs(info.deltaY) ? '#ffff00' : '#00ff00'}; font-size: 13px;">${info.deltaX.toFixed(1)}</span></div>
      <div><strong>deltaY:</strong> <span style="color: ${Math.abs(info.deltaY) > Math.abs(info.deltaX) ? '#ffff00' : '#00ff00'}; font-size: 13px;">${info.deltaY.toFixed(1)}</span></div>
      <div><strong>accumulated:</strong> <span style="color: #00ff00; font-size: 13px;">${info.currentDelta.toFixed(1)}</span></div>
      <div><strong>prevented:</strong> <span style="color: ${info.prevented ? '#ff0000' : '#00ff00'}; font-size: 13px; font-weight: bold;">${info.prevented ? 'YES' : 'NO'}</span></div>
      <div><strong>reason:</strong> <span style="color: #ffff00; font-size: 12px;">${info.reason}</span></div>
      ${info.processingTime ? `<div><strong>time:</strong> <span style="color: ${info.processingTime > 5 ? '#ff0000' : '#00ff00'}; font-size: 13px;">${info.processingTime.toFixed(2)}ms</span></div>` : ''}
      <div style="border-top: 1px solid rgba(255,255,255,0.2); margin-top: 4px; padding-top: 4px;">
        <div><strong>isInsideUI:</strong> <span style="color: ${info.isInsideFloatingUI ? '#00ff00' : '#ff0000'}; font-size: 13px; font-weight: bold;">${info.isInsideFloatingUI ? 'YES ✅' : 'NO ❌'}</span></div>
        ${info.pathLength ? `<div><strong>pathLength:</strong> <span style="color: #00ffff; font-size: 12px;">${info.pathLength}</span></div>` : ''}
        ${info.targetInfo ? `<div><strong>target:</strong> <span style="color: #ffff00; font-size: 11px;">${info.targetInfo}</span></div>` : ''}
      </div>
    `;
  }

  // Update page state info
  const pageContainer = swipeDebugWindow.querySelector('#swipe-page-info');
  if (pageContainer) {
    pageContainer.innerHTML = `
      <div><strong>scrollable:</strong> <span style="color: ${info.scrollable ? '#ffff00' : '#00ff00'}; font-size: 13px;">${info.scrollable ? 'YES' : 'NO'}</span></div>
      <div><strong>scrollLeft:</strong> <span style="color: #00ff00; font-size: 13px;">${info.scrollLeft.toFixed(0)}</span></div>
      <div><strong>scrollWidth:</strong> <span style="color: #00ff00; font-size: 13px;">${document.documentElement.scrollWidth}</span></div>
      <div><strong>clientWidth:</strong> <span style="color: #00ff00; font-size: 13px;">${document.documentElement.clientWidth}</span></div>
    `;
  }

  // Update stats info
  const statsContainer = swipeDebugWindow.querySelector('#swipe-stats-info');
  if (statsContainer) {
    const now = Date.now();
    const recentEvents = swipeEventHistory.filter((e) => now - e.time < 1000);
    const eventsPerSec = recentEvents.length;

    statsContainer.innerHTML = `
      <div><strong>total events:</strong> <span style="color: #00ff00; font-size: 13px;">${swipeEventCount}</span></div>
      <div><strong>events/sec:</strong> <span style="color: ${eventsPerSec > 60 ? '#ff0000' : '#00ff00'}; font-size: 13px;">${eventsPerSec}</span></div>
      <div><strong>prevented:</strong> <span style="color: #ffff00; font-size: 13px;">${preventedCount}</span></div>
    `;
  }

  // Update history (larger font)
  const historyContainer = swipeDebugWindow.querySelector('#swipe-history-info');
  if (historyContainer) {
    const historyHtml = swipeEventHistory
      .slice()
      .reverse()
      .slice(0, 10)
      .map((e, i) => {
        const age = Date.now() - e.time;
        const color = e.prevented ? '#ff0000' : '#00ff00';
        const icon = e.prevented ? '🚫' : '✅';
        return `<div style="color: ${color};"><strong>${i + 1}.</strong> ${icon} dx=${e.deltaX.toFixed(0)} dy=${e.deltaY.toFixed(0)} | <span style="color: #ffff00;">${e.reason}</span> | ${age}ms ago</div>`;
      })
      .join('');
    historyContainer.innerHTML = historyHtml || '<div style="color: #444;">No events</div>';
  }
}

// Keyboard shortcuts for swipe debug
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'S') {
    if (swipeDebugEnabled) {
      disableSwipeDebug();
      console.log('[Arcline Debug] Swipe debug disabled');
    } else {
      enableSwipeDebug();
      console.log('[Arcline Debug] Swipe debug enabled');
    }
  }

  if (e.ctrlKey && e.shiftKey && e.key === 'R') {
    swipeEventCount = 0;
    swipePreventCount = 0;
    swipeEventHistory = [];
    logStartTime = Date.now();
    console.log('[Arcline Debug] Swipe stats reset');
  }

  // Export logs to clipboard as JSON
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    exportSwipeLogsToClipboard();
  }

  // Print logs to console
  if (e.ctrlKey && e.shiftKey && e.key === 'L') {
    printSwipeLogsToConsole();
  }

  // Export logs to file (download)
  if (e.ctrlKey && e.shiftKey && e.key === 'W') {
    exportSwipeLogsToFile();
  }
});

// Re-enable hostElement pointer events when UI is closed
export function enableHostElementPointerEvents() {
  if (hostElement) {
    hostElement.style.pointerEvents = 'auto';
  }
}

function teardownFloatingUi() {
  bootstrapHotzone?.remove();
  bootstrapHotzone = null;

  floatingInstance?.destroy();
  floatingInstance = null;
  mountPromise = null;

  window.__arclineFloatingReady = false;

  teardownEdgeDetection();
  teardownTrackpadGestures();

  if (hostElement) {
    hostElement.remove();
  }

  hostElement = null;
  shadowRoot = null;
}

function applyUiMode(mode: UiMode) {
  if (mode === currentMode) return;
  currentMode = mode;

  if (mode === 'floating') {
    ensureHost();
    ensureBootstrapHotzone();
    setupEdgeDetection();
    setupTrackpadGestures();
  } else {
    teardownFloatingUi();
  }
}

function handleRuntimeMessage(message: unknown) {
  if (typeof message !== 'object' || message === null) return;
  const payload = message as { command?: string; mode?: UiMode };
  if (payload.command === 'currentUiMode' && payload.mode) {
    applyUiMode(payload.mode);
    return;
  }

  if (payload.command === 'openFloatingUi') {
    ensureHost();
    ensureBootstrapHotzone();
    void startFloatingUi();
  }

  if (payload.command === 'openFloatingUiInstantly') {
    ensureHost();
    ensureBootstrapHotzone();
    void startFloatingUi({ instant: true });
  }

  if (payload.command === 'openCommandPalette') {
    ensureHost();
    ensureBootstrapHotzone();
    void startFloatingUi({ commandPalette: true });
  }

  if (payload.command === 'zoomChanged' && (payload as { zoomFactor?: number }).zoomFactor) {
    applyZoomCorrection((payload as { zoomFactor: number }).zoomFactor);
  }
}

function applyZoomCorrection(zoomFactor: number) {
  if (!hostElement) return;
  // Counteract browser zoom to keep the UI at 100% physical scale.
  // "zoom" property is non-standard but works in Chrome/Edge.
  hostElement.style.zoom = `${1 / zoomFactor}`;
  hostElement.style.height = `${100 * zoomFactor}vh`;
}

async function syncZoomLevel() {
  try {
    const response = await chrome.runtime.sendMessage({ method: 'getZoomLevel', id: 'zoom-init' });
    if (response?.data?.ok && typeof response.data.zoom === 'number') {
      applyZoomCorrection(response.data.zoom);
    }
  } catch (_e) {
    // Ignore fallback
  }
}

function handleWindowMessage(event: MessageEvent) {
  if (event.source !== window) return;
  const payload = event.data;
  if (typeof payload !== 'object' || payload === null) return;
  if ('type' in payload && (payload as { type?: unknown }).type === 'ARCLINE_OPEN_FLOATING_UI') {
    ensureHost();
    ensureBootstrapHotzone();
    void startFloatingUi();
  }
}

async function initialize() {
  if (!hasChromeRuntime()) return;

  const [mode, settings] = await Promise.all([
    requestUiMode().catch(() => 'floating' as const),
    requestSettings().catch(() => ({ gesturesEnabled: true, gestureSensitivity: 100 })),
  ]);

  if (settings) {
    swipeDetector.updateConfig({ threshold: settings.gestureSensitivity });
    gesturesEnabled = settings.gesturesEnabled;
  }

  applyUiMode(mode);

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  window.addEventListener('message', handleWindowMessage);

  void syncZoomLevel();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void initialize();
  });
} else {
  void initialize();
}
