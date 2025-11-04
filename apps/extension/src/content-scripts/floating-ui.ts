/// <reference types="chrome" />

// Minimal inline utilities to avoid pulling large modules into the bootstrap bundle.
type UiMode = 'side-panel' | 'popup' | 'floating';

const HOST_ID = 'arcline-floating-root';
const BOOTSTRAP_MARK = 'data-arcline-floating-bootstrap';
let hostElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let bootstrapHotzone: HTMLDivElement | null = null;
let mountPromise: Promise<typeof import('../floating/mount') | null> | null = null;
let floatingInstance: Awaited<ReturnType<typeof import('../floating/mount')['mountFloatingUi']>> | null = null;
let currentMode: UiMode | null = null;

function hasChromeRuntime(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime && typeof chrome.runtime.sendMessage === 'function';
}

function requestUiMode(timeoutMs = 600): Promise<UiMode> {
  if (!hasChromeRuntime()) {
    return Promise.resolve('side-panel');
  }

  return new Promise<UiMode>((resolve) => {
    let settled = false;

    const cleanup = (mode: UiMode) => {
      if (settled) return;
      settled = true;
      resolve(mode);
    };

    const timer = window.setTimeout(() => {
      cleanup('side-panel');
    }, timeoutMs);

    try {
      chrome.runtime.sendMessage({ command: 'requestUiMode' }, (response?: { mode?: UiMode }) => {
        window.clearTimeout(timer);
        if (chrome.runtime.lastError) {
          cleanup('side-panel');
          return;
        }
        cleanup((response?.mode as UiMode | undefined) ?? 'side-panel');
      });
    } catch (error) {
      console.warn('[Arcline] requestUiMode failed', error);
      window.clearTimeout(timer);
      cleanup('side-panel');
    }
  });
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
  element.style.width = '6px';
  element.style.zIndex = '2147483646';
  element.style.pointerEvents = 'none';
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
  hotzone.addEventListener(
    'pointerenter',
    () => {
      void startFloatingUi();
    },
    { once: true }
  );

  shadowRoot.append(hotzone);
  bootstrapHotzone = hotzone;
}

async function startFloatingUi() {
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
    floatingInstance.openFromHover();
    return;
  }

  floatingInstance = await module
    .mountFloatingUi({
      host: hostElement,
      shadowRoot,
      onBootstrapReady: () => {
        bootstrapHotzone?.remove();
        bootstrapHotzone = null;
      }
    })
    .catch((error) => {
      console.error('[Arcline] Failed to mount floating UI', error);
      floatingInstance = null;
      return null;
    });

  floatingInstance?.openFromHover();
}

function teardownFloatingUi() {
  bootstrapHotzone?.remove();
  bootstrapHotzone = null;

  floatingInstance?.destroy();
  floatingInstance = null;
  mountPromise = null;

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
  } else {
    teardownFloatingUi();
  }
}

function handleRuntimeMessage(message: unknown) {
  if (typeof message !== 'object' || message === null) return;
  const payload = message as { command?: string; mode?: UiMode };
  if (payload.command === 'currentUiMode' && payload.mode) {
    applyUiMode(payload.mode);
  }
}

async function initialize() {
  if (window.top !== window) return;
  if (!hasChromeRuntime()) return;

  const mode = await requestUiMode().catch(() => 'side-panel' as const);
  applyUiMode(mode);

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void initialize();
  });
} else {
  void initialize();
}
