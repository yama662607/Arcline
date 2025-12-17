/// <reference types="chrome" />

import '@/dev/reactPreamble';

import { SwipeDetector } from '@/lib/gestures';
import { hasChromeRuntime, requestSettings, requestUiMode, type UiMode } from './shared-utils';

const HOST_ID = 'arcline-floating-root';
const BOOTSTRAP_MARK = 'data-arcline-floating-bootstrap';
let hostElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let bootstrapHotzone: HTMLDivElement | null = null;
let mountPromise: Promise<typeof import('../floating/mount') | null> | null = null;
let floatingInstance: Awaited<
  ReturnType<typeof import('../floating/mount')['mountFloatingUi']>
> | null = null;
let currentMode: UiMode | null = null;
let edgeDetectionHandler: ((e: PointerEvent) => void) | null = null;
let gestureHandler: ((e: WheelEvent) => void) | null = null;
const swipeDetector = new SwipeDetector({ threshold: 100 }); // Default sensitivity
let gesturesEnabled = true;

interface DebugInfo {
  clientX: number;
  lastX: number | null;
  inHotzone: boolean;
  movingLeft: boolean;
  startedOutside: boolean;
  hotzoneIntersects: boolean;
  shouldTrigger: boolean;
  rafPending: boolean;
}

let updateDebugInfoFn: ((info: DebugInfo) => void) | null = null;

declare global {
  interface Window {
    __arclineFloatingReady?: boolean;
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
  element.style.width = '8px';
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
      onClosed: enableHostElementPointerEvents,
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

  let debugRafId: number | null = null;
  let lastEnterTime = 0;
  const DEBOUNCE_MS = 100; // Prevent rapid re-triggers

  // Use hostElement's pointerenter for reliable detection
  // hostElement is the 8px-wide fixed element on the left edge
  edgeDetectionHandler = (e: PointerEvent) => {
    const now = Date.now();

    // Debounce to prevent rapid re-triggers
    if (now - lastEnterTime < DEBOUNCE_MS) {
      return;
    }
    lastEnterTime = now;

    if (updateDebugInfoFn) {
      if (debugRafId === null) {
        debugRafId = requestAnimationFrame(() => {
          debugRafId = null;
          updateDebugInfoFn?.({
            clientX: e.clientX,
            lastX: null,
            inHotzone: true,
            movingLeft: false,
            startedOutside: false,
            hotzoneIntersects: false,
            shouldTrigger: true,
            rafPending: false,
          });
        });
      }
    }

    // Trigger floating UI
    if (floatingInstance) {
      floatingInstance.openFromHover();
      // Disable pointer events on hostElement while UI is open
      // to prevent re-triggering when hovering over the open UI
      if (hostElement) {
        hostElement.style.pointerEvents = 'none';
      }
    }
  };

  hostElement.addEventListener('pointerenter', edgeDetectionHandler);
}

function teardownEdgeDetection() {
  if (edgeDetectionHandler && hostElement) {
    hostElement.removeEventListener('pointerenter', edgeDetectionHandler);
    edgeDetectionHandler = null;
  }
}

function setupTrackpadGestures() {
  if (gestureHandler) return;

  gestureHandler = (e: WheelEvent) => {
    // console.log('[Arcline] wheel', e.deltaX, e.deltaY);
    if (!gesturesEnabled) return;

    const direction = swipeDetector.process(e);
    if (direction) {
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
    }
  };

  window.addEventListener('wheel', gestureHandler, { passive: true });
}

function teardownTrackpadGestures() {
  if (gestureHandler) {
    window.removeEventListener('wheel', gestureHandler);
    gestureHandler = null;
  }
}

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
