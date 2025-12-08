/// <reference types="chrome" />

import '@/dev/reactPreamble';

import { hasChromeRuntime, requestUiMode, type UiMode } from './shared-utils';

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
  element.style.width = '6px';
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
  hotzone.addEventListener(
    'pointerenter',
    () => {
      void startFloatingUi();
    },
    { once: true }
  );

  shadowRoot.append(hotzone);
  bootstrapHotzone = hotzone;
  window.__arclineFloatingReady = true;
}

async function startFloatingUi(options?: { instant?: boolean }) {
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
    })
    .catch((error) => {
      console.error('[Arcline] Failed to mount floating UI', error);
      floatingInstance = null;
      return null;
    });

  if (options?.instant) {
    floatingInstance?.openInstantly();
  } else {
    floatingInstance?.openFromHover();
  }
}

function teardownFloatingUi() {
  bootstrapHotzone?.remove();
  bootstrapHotzone = null;

  floatingInstance?.destroy();
  floatingInstance = null;
  mountPromise = null;

  window.__arclineFloatingReady = false;

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
    return;
  }

  if (payload.command === 'openFloatingUi') {
    ensureHost();
    ensureBootstrapHotzone();
    void startFloatingUi();
  }

  // タブ移動時に即座に開く（アニメーションなし）
  if (payload.command === 'openFloatingUiInstantly') {
    ensureHost();
    ensureBootstrapHotzone();
    void startFloatingUi({ instant: true });
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
  if (window.top !== window) return;
  if (!hasChromeRuntime()) return;

  const mode = await requestUiMode().catch(() => 'floating' as const);
  applyUiMode(mode);

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  window.addEventListener('message', handleWindowMessage);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void initialize();
  });
} else {
  void initialize();
}
