/// <reference types="chrome" />

import '@/dev/reactPreamble';

import type { SwipeDirection } from '@/lib/gestures';
import type { SpaceTransitionHandoff } from '@/shared/types';
import {
  EdgeDetectionState,
  getEdgeDetectionConfig,
  subscribeEdgeDetectionConfig,
} from './edge-detection-config';
import { createFloatingGestureController } from './floating-gestures';
import {
  disableSwipeDebug,
  enableSwipeDebug,
  exportSwipeLogsToClipboard,
  exportSwipeLogsToFile,
  isSwipeDebugActive,
  printSwipeLogsToConsole,
  resetSwipeDebugStats,
} from './floating-swipe-debug';
import { hasChromeRuntime, requestSettings, requestUiMode, type UiMode } from './shared-utils';

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
let edgeDetectionState: EdgeDetectionState = EdgeDetectionState.IDLE;
let lastVelocityX = 0;
let lastVelocityY = 0;
let lastPointerEventTime = 0;
let lastPointerScreenX: number | null = null;
let lastPointerClientX: number | null = null;
let lastPointerClientY: number | null = null;
let config = getEdgeDetectionConfig();
let lastInferenceTime = 0;
let pendingTransition: SpaceTransitionHandoff | null = null;
let transitionApplyTimer: number | null = null;
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

const gestureController = createFloatingGestureController({
  getShadowRoot: () => shadowRoot,
  getHostElement: () => hostElement,
  ensureHost,
  onNavigateSpace: (direction, options) => sendNavigateSpace(direction, options),
  onPageTransition: () => {
    floatingInstance?.showPageTransition();
  },
});

function sendNavigateSpace(
  direction: SwipeDirection,
  options?: { mode: 'handoff' | 'flick'; transition?: SpaceTransitionHandoff; perfId?: string; t0?: number }
) {
  if (typeof crypto.randomUUID !== 'function') return;

  // If this window is already in a transition-out phase, the mask should already be visible.
  // We don't necessarily need to call showPageTransition here if it was already called by onPageTransition.

  const t1 = Date.now();
  if (options?.perfId) {
    console.log(`[Arcline][Perf][${options.perfId}] T1: Sending navigateSpace message at ${new Date(t1).toISOString().split('T')[1]} (Delta T0-T1: ${t1 - (options.t0 || t1)}ms)`);
  }

  chrome.runtime.sendMessage(
    {
      method: 'navigateSpace',
      params: {
        direction,
        transition: options?.transition,
        perfId: options?.perfId,
        t0: options?.t0
      },
      id: crypto.randomUUID(),
    },
    () => {
      if (chrome.runtime.lastError) {
        // Ignore
      }
    }
  );
}

function sendActivateSpace(spaceId: number, options?: { perfId?: string; t0?: number }) {
  if (typeof crypto.randomUUID !== 'function') return;

  const perfId = options?.perfId || `activate-${Math.random().toString(36).slice(2, 6)}`;
  const t0 = options?.t0 || Date.now();
  const t1 = Date.now();

  console.log(`[Arcline][Perf][${perfId}] T1: Sending activateSpace message at ${new Date(t1).toISOString().split('T')[1]} (Delta T0-T1: ${t1 - (t0 || t1)}ms)`);

  chrome.runtime.sendMessage(
    {
      method: 'activateSpace',
      params: { spaceId, perfId, t0 },
      id: crypto.randomUUID(),
    },
    () => {
      if (chrome.runtime.lastError) {
        // Ignore
      }
    }
  );
}

function clearTransitionApplyTimer() {
  if (transitionApplyTimer !== null) {
    window.clearTimeout(transitionApplyTimer);
    transitionApplyTimer = null;
  }
}

function scheduleTransitionApply() {
  if (!pendingTransition) return;

  const startedAt = Date.now();
  const attempt = () => {
    if (!pendingTransition) {
      transitionApplyTimer = null;
      return;
    }

    const applied = gestureController.playHandoffTransition(pendingTransition);
    if (applied) {
      pendingTransition = null;
      transitionApplyTimer = null;
      return;
    }

    if (Date.now() - startedAt > 600) {
      pendingTransition = null;
      transitionApplyTimer = null;
      return;
    }

    transitionApplyTimer = window.setTimeout(attempt, 50);
  };

  clearTransitionApplyTimer();
  attempt();
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

/**
 * Shows a subtle notification to the user that the page needs to be refreshed
 * because the extension has been updated/reloaded.
 */
function showRefreshRequiredNotification() {
  if (document.getElementById('arcline-refresh-notification')) return;

  const div = document.createElement('div');
  div.id = 'arcline-refresh-notification';
  Object.assign(div.style, {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#1a1a1b',
    color: '#ffffff',
    padding: '12px 32px',
    borderRadius: '16px',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer',
    backdropFilter: 'blur(12px)',
    animation: 'arcline-fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  });

  const style = document.createElement('style');
  style.textContent = `
    @keyframes arcline-fade-in-up {
      from { opacity: 0; transform: translate(-50%, 10px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
  `;
  document.head.append(style);

  div.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
    <span>Extension Updated: Please Refresh Page</span>
  `;

  div.onclick = () => window.location.reload();
  document.body.append(div);
}

function openFloatingUiFromEdge() {
  if (!hasChromeRuntime()) {
    showRefreshRequiredNotification();
    return;
  }
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
  const isProximity = x <= config.viewportEdgeThresholdPx;
  edgeDetectionState = isProximity ? EdgeDetectionState.PROXIMITY : EdgeDetectionState.IDLE;

  if (isProximity) {
    void prewarmFloatingUi();
  }
}

async function prewarmFloatingUi() {
  if (mountPromise || floatingInstance) return;

  // Start loading the heavy mount module ahead of time
  mountPromise = import('../floating/mount').catch((error) => {
    console.warn('[Arcline] Failed to pre-warm floating UI', error);
    mountPromise = null;
    return null;
  });
}

function maybeLogEdgeDebug(source: string, payload: Record<string, unknown>) {
  if (!config.debugLogging) return;
  console.debug('[Arcline][EdgeDetection]', source, payload);
}

async function startFloatingUi(options?: {
  instant?: boolean;
  commandPalette?: boolean;
  perfId?: string;
  t0?: number;
}) {
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
    }
    return;
  }

  floatingInstance = await module
    .mountFloatingUi({
      host: hostElement,
      shadowRoot,
      perfId: options?.perfId,
      t0: options?.t0,
      onBootstrapReady: () => {
        bootstrapHotzone?.remove();
        bootstrapHotzone = null;
      },
      onClosed: () => {
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
  scheduleTransitionApply();
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

// Keyboard shortcuts for swipe debug
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'S') {
    if (isSwipeDebugActive()) {
      disableSwipeDebug();
      console.log('[Arcline Debug] Swipe debug disabled');
    } else {
      enableSwipeDebug();
      console.log('[Arcline Debug] Swipe debug enabled');
    }
  }

  if (e.ctrlKey && e.shiftKey && e.key === 'R') {
    resetSwipeDebugStats();
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

  pendingTransition = null;
  clearTransitionApplyTimer();

  teardownEdgeDetection();
  gestureController.teardown();

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
    gestureController.setup();
  } else {
    teardownFloatingUi();
  }
}

import { getServiceWorkerBridge } from '@/hooks/use-service-worker-bridge';

function handleRuntimeMessage(message: unknown) {
  if (typeof message !== 'object' || message === null) return;
  const payload = message as {
    command?: string;
    mode?: UiMode;
    transition?: SpaceTransitionHandoff;
    spaces?: SpaceSnapshot[];
    instant?: boolean;
  };

  if (payload.command === 'openFloatingUiWithData') {
    const t6 = Date.now();
    const { perfId, t0 } = message as { perfId?: string; t0?: number };
    if (perfId) {
      console.log(`[Arcline][Perf][${perfId}] T6: UI Message received on target tab at ${new Date(t6).toISOString().split('T')[1]} (Total Latency T0-T6: ${t6 - (t0 || t6)}ms)`);
    }

    if (payload.spaces) {
      // Pre-populate cache directly to avoid query delay
      getServiceWorkerBridge().updateSpacesCache(payload.spaces);
    }
    if (payload.transition) {
      pendingTransition = payload.transition;
      scheduleTransitionApply();
    }

    ensureHost();
    ensureBootstrapHotzone();
    void startFloatingUi({ instant: payload.instant, perfId: perfId, t0: t0 }).then(() => {
      // Trigger the entry transition mask on the target tab
      floatingInstance?.showPageTransition();
    });
    return;
  }

  if (payload.command === 'currentUiMode' && payload.mode) {
    applyUiMode(payload.mode);
    return;
  }

  if (payload.command === 'spaceTransition' && payload.transition) {
    pendingTransition = payload.transition;
    scheduleTransitionApply();
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

  if (payload.command === 'preloadFloatingUi') {
    void prewarmFloatingUi();
  }

  if (payload.command === 'openCommandPalette') {
    if (!hasChromeRuntime()) {
      showRefreshRequiredNotification();
      return;
    }
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

function handleSpaceBarSwitch(event: Event) {
  const detail = (event as CustomEvent<{ spaceId: number; direction: SwipeDirection }>).detail;
  if (!detail || typeof detail.spaceId !== 'number' || !detail.direction) return;

  const perfId = `spacebar-${Math.random().toString(36).slice(2, 6)}`;
  const t0 = Date.now();
  console.log(`[Arcline][Perf][${perfId}] T0: Spacebar switch triggered at ${new Date(t0).toISOString().split('T')[1]} (${t0})`);

  const started = gestureController.triggerFlickTransition(detail.direction, () => {
    sendActivateSpace(detail.spaceId, { perfId, t0 });
  });

  if (!started) {
    sendActivateSpace(detail.spaceId, { perfId, t0 });
  }
}

async function initialize() {
  if (!hasChromeRuntime()) return;

  const [mode, settings] = await Promise.all([
    requestUiMode().catch(() => 'floating' as const),
    requestSettings().catch(() => ({ gesturesEnabled: true, gestureSensitivity: 100 })),
  ]);

  if (settings) {
    gestureController.updateSettings(settings);
  }

  applyUiMode(mode);

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  window.addEventListener('message', handleWindowMessage);
  window.addEventListener('arcline-space-bar-switch', handleSpaceBarSwitch);

  void syncZoomLevel();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void initialize();
  });
} else {
  void initialize();
}
