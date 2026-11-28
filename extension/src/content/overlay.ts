import { EdgeHoverMachine } from '../core/edge-hover';
import { completeSettings, DEFAULT_SETTINGS } from '../core/settings';
import { matchCustomShortcut, matchFavoriteShortcut } from '../core/shortcut-keys';
import {
  stepSwitcherIndex,
  type TabSwitcherItem,
  type TabSwitcherResponse,
} from '../core/tab-switcher';
import type { Settings } from '../core/types';

/**
 * Ultra-lightweight Vanilla JS left-edge hover overlay controller (~4.4KB gzip, zero React).
 * - Renders zero visible pixels and loads NO iframe until the user intentionally hovers the left edge.
 * - Mounts the full Arcline UI inside an isolated extension-origin iframe (`sidepanel.html?mode=overlay`).
 * - Counter-scales against browser page zoom (`Cmd+` / `Cmd-` / `Cmd0`) via `chrome.tabs.getZoom` /
 *   `onZoomChange` so Arcline's physical UI size, typography, and edge trigger remain 100% constant.
 * - Expands the iframe transparently to a full-viewport stage when a centered modal (Settings,
 *   Space editor, Theme studio) or overflowing context menu opens, while keeping the frosted-glass
 *   sidebar silhouette pinned at the left edge with zero flicker.
 * - Auto-unloads the iframe when the tab goes into the background (unless locked by active edit/modal).
 * - Self-repairs if an aggressive SPA removes the host element.
 */
(() => {
  if (window.top !== window) return;
  // Skip CSP-sandboxed opaque-origin documents (e.g. raw CDN images served with `CSP: sandbox`),
  // where Chromium blocks script execution in any child iframe and logs a sandbox console error.
  if (window.origin === 'null') return;
  // Bail cleanly if extension APIs are unavailable (e.g. invalidated context during reload)
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) return;
  const HOST_ID = 'arcline-overlay-host';
  if (document.getElementById(HOST_ID)) return;

  const SETTINGS_KEY = 'arcline:settings';
  const EXT_ORIGIN = chrome.runtime?.id ? `chrome-extension://${chrome.runtime.id}` : '';
  const PANEL_URL = chrome.runtime?.getURL?.('sidepanel.html?mode=overlay') ?? '';
  const COMMAND_BAR_MODAL_URL = chrome.runtime?.getURL?.('empty-space.html?mode=modal') ?? '';

  let settings: Settings = { ...DEFAULT_SETTINGS };
  let pageZoom = 1;
  let disposed = false;
  let stageExpanded = false;
  let iframeLoaded = false;
  let commandBarOpen = false;
  let commandBarOpenSeq = 0;
  let tabHidden = false;
  let nativeSidePanelOpen = false;
  let hostEl: HTMLDivElement | null = null;
  let shadow: ShadowRoot | null = null;
  let edgeEl: HTMLDivElement | null = null;
  let glassBackdropEl: HTMLDivElement | null = null;
  let panelEl: HTMLDivElement | null = null;
  let iframeEl: HTMLIFrameElement | null = null;
  let reloadCardEl: HTMLDivElement | null = null;
  let cmdBackdropEl: HTMLDivElement | null = null;
  let cmdIframeEl: HTMLIFrameElement | null = null;
  let resizeEl: HTMLDivElement | null = null;
  let resizeBadgeEl: HTMLDivElement | null = null;
  let switcherEl: HTMLDivElement | null = null;
  let switcherOpen = false;
  let switcherLoading = false;
  let switcherSeq = 0;
  let switcherItems: TabSwitcherItem[] = [];
  let switcherIndex = 0;
  let switcherAccentHex: string | undefined;
  let switcherPendingDelta = 0;
  let ctrlHeldNow = false;
  let unloadTimer: ReturnType<typeof setTimeout> | undefined;
  let repairTimer: ReturnType<typeof setTimeout> | undefined;
  let cmdRevealTimer: ReturnType<typeof setTimeout> | undefined;
  let graceCheckTimer: ReturnType<typeof setTimeout> | undefined;
  let forceOpenGraceUntil = 0;
  let lastKnownPointerX: number | null = null;
  let suppressStateReport = false;
  let observer: MutationObserver | null = null;

  const machine = new EdgeHoverMachine(
    {
      enabled: settings.edgeHoverEnabled,
      triggerWidthPx: settings.edgeTriggerWidthPx,
      openDelayMs: settings.edgeOpenDelayMs,
      closeDelayMs: settings.edgeCloseDelayMs,
      panelWidthPx: settings.overlayWidthPx,
    },
    {
      onOpen: () => showPanel(),
      onClose: () => hidePanel(),
    },
  );

  function toUnzoomedPx(clientCoord: number): number {
    return clientCoord * pageZoom;
  }

  function buildStyles(): string {
    return `
      :host {
        all: initial !important;
        position: fixed !important;
        inset: 0 !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        display: block !important;
        visibility: visible !important;
      }
      .arcline-edge {
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        width: ${settings.edgeTriggerWidthPx}px;
        pointer-events: auto;
        background: transparent;
      }
      /* Preserves frosted glass behind the pinned left sidebar while the iframe expands to full viewport for centered modals & menus */
      .arcline-glass-backing {
        position: fixed;
        top: 6px;
        left: 6px;
        bottom: 6px;
        width: ${settings.overlayWidthPx}px;
        border-radius: 14px;
        pointer-events: none;
        visibility: hidden;
        opacity: 0;
        -webkit-backdrop-filter: blur(28px) saturate(1.25);
        backdrop-filter: blur(28px) saturate(1.25);
        box-shadow:
          0 24px 56px rgba(0, 0, 0, 0.36),
          0 4px 16px rgba(0, 0, 0, 0.18),
          0 0 0 0.5px rgba(255, 255, 255, 0.16);
      }
      .arcline-glass-backing.active {
        visibility: visible;
        opacity: 1;
      }
      .arcline-panel {
        position: fixed;
        top: 6px;
        left: 6px;
        bottom: 6px;
        width: ${settings.overlayWidthPx}px;
        border-radius: 14px;
        overflow: hidden;
        visibility: hidden;
        opacity: 0;
        pointer-events: none;
        transform: translate3d(calc(-100% - 16px), 0, 0);
        -webkit-backdrop-filter: blur(28px) saturate(1.25);
        backdrop-filter: blur(28px) saturate(1.25);
        box-shadow:
          0 24px 56px rgba(0, 0, 0, 0.36),
          0 4px 16px rgba(0, 0, 0, 0.18),
          0 0 0 0.5px rgba(255, 255, 255, 0.16);
        transition:
          transform 155ms cubic-bezier(0.32, 0.72, 0, 1),
          opacity 135ms ease,
          visibility 0s linear 155ms;
        will-change: transform, opacity;
      }
      .arcline-panel.open {
        visibility: visible;
        opacity: 1;
        pointer-events: auto;
        transform: translate3d(0, 0, 0);
        transition:
          transform 195ms cubic-bezier(0.16, 1, 0.3, 1),
          opacity 145ms ease,
          visibility 0s linear 0s;
      }
      .arcline-panel.open.stage-expanded {
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: auto !important;
        height: auto;
        border-radius: 0;
        overflow: visible;
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        box-shadow: none;
        background: transparent;
        transition: none;
      }
      .arcline-panel.open.stage-expanded .arcline-resize {
        display: none;
      }
      .arcline-panel.resizing {
        transition: none;
      }
      .arcline-frame {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        background: transparent;
      }
      .arcline-reload-card {
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        padding: 24px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 12px;
        background: rgba(24, 25, 32, 0.88);
        color: #f4f4f6;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif;
      }
      @media (prefers-color-scheme: light) {
        .arcline-reload-card {
          background: rgba(250, 250, 252, 0.92);
          color: #18181b;
        }
      }
      .arcline-reload-icon {
        width: 38px;
        height: 38px;
        border-radius: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(99, 102, 241, 0.18);
        color: #818cf8;
        font-size: 18px;
        font-weight: 700;
      }
      .arcline-reload-title {
        margin: 0;
        font-size: 13.5px;
        font-weight: 600;
        line-height: 1.4;
      }
      .arcline-reload-desc {
        margin: 0;
        font-size: 12px;
        line-height: 1.55;
        opacity: 0.78;
        max-width: 220px;
      }
      .arcline-reload-actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        max-width: 210px;
        margin-top: 4px;
      }
      .arcline-reload-btn {
        appearance: none;
        border: 0;
        border-radius: 9px;
        padding: 9px 14px;
        font: 600 12.5px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
        cursor: pointer;
        background: #6366f1;
        color: #ffffff;
        transition: opacity 120ms ease;
      }
      .arcline-reload-btn:hover {
        opacity: 0.92;
      }
      .arcline-reload-dismiss {
        appearance: none;
        border: 0;
        border-radius: 8px;
        padding: 6px 12px;
        font: 500 11.5px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
        cursor: pointer;
        background: transparent;
        color: inherit;
        opacity: 0.65;
      }
      .arcline-reload-dismiss:hover {
        opacity: 1;
      }
      .arcline-resize {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 8px;
        cursor: ew-resize;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .arcline-resize::after {
        content: '';
        width: 3px;
        height: 44px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.42);
        box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.25);
        opacity: 0;
        transform: scaleY(0.75);
        transition: opacity 140ms ease, transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      .arcline-resize:hover::after,
      .arcline-panel.resizing .arcline-resize::after {
        opacity: 1;
        transform: scaleY(1);
      }
      .arcline-resize-badge {
        position: fixed;
        top: 50%;
        transform: translateY(-50%);
        padding: 3px 8px;
        border-radius: 999px;
        background: rgba(24, 24, 28, 0.88);
        color: #f4f4f6;
        font: 600 11px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.01em;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35), 0 0 0 0.5px rgba(255, 255, 255, 0.16);
        pointer-events: none;
        opacity: 0;
        transition: opacity 120ms ease;
      }
      .arcline-resize-badge.light {
        background: rgba(252, 252, 254, 0.94);
        color: #18181b;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.14), 0 0 0 0.5px rgba(0, 0, 0, 0.12);
      }
      .arcline-resize-badge.visible {
        opacity: 1;
      }
      .arcline-cmd-modal {
        position: fixed;
        inset: 0;
        z-index: 20;
        display: none;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        background: transparent;
      }
      .arcline-cmd-modal.open {
        display: flex;
      }
      .arcline-cmd-frame {
        width: 100%;
        height: 100%;
        border: 0;
        color-scheme: light;
        background: transparent;
        opacity: 0;
      }
      .arcline-cmd-frame.ready {
        opacity: 1;
      }
      .arcline-switcher-dock {
        position: fixed;
        left: 50%;
        top: 50%;
        z-index: 25;
        display: none;
        max-width: min(94vw, 960px);
        padding: 12px;
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(31, 32, 36, 0.95) 0%, rgba(21, 22, 25, 0.97) 100%);
        -webkit-backdrop-filter: blur(28px) saturate(1.2);
        backdrop-filter: blur(28px) saturate(1.2);
        border: 0.5px solid rgba(255, 255, 255, 0.18);
        box-shadow:
          0 32px 84px rgba(0, 0, 0, 0.62),
          0 12px 28px rgba(0, 0, 0, 0.36),
          0 0 0 1px rgba(0, 0, 0, 0.55),
          inset 0 1px 0 rgba(255, 255, 255, 0.16);
        transform: translate(-50%, -50%);
        pointer-events: auto;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
        color: #f5f5f7;
      }
      .arcline-switcher-dock.open {
        display: flex;
        align-items: stretch;
        gap: 10px;
      }
      .arcline-switcher-card {
        display: flex;
        flex-direction: column;
        width: 152px;
        padding: 6px;
        border-radius: 12px;
        border: 1.5px solid transparent;
        background: rgba(255, 255, 255, 0.04);
        color: inherit;
        text-align: left;
        cursor: pointer;
        transition: background-color 110ms ease, border-color 110ms ease;
      }
      .arcline-switcher-card:hover {
        background: rgba(255, 255, 255, 0.09);
      }
      .arcline-switcher-card.active {
        background: var(--arcline-sw-accent-bg, rgba(255, 255, 255, 0.14));
        border-color: var(--arcline-sw-accent, rgba(255, 255, 255, 0.48));
        box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.2), 0 4px 12px rgba(0, 0, 0, 0.28);
      }
      .arcline-switcher-preview {
        width: 100%;
        height: 82px;
        border-radius: 8px;
        padding: 8px;
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        overflow: hidden;
      }
      .arcline-switcher-badge {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        display: grid;
        place-items: center;
        background: rgba(255, 255, 255, 0.1);
        font-size: 13px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.88);
      }
      .arcline-switcher-badge img {
        width: 20px;
        height: 20px;
        border-radius: 4px;
      }
      .arcline-switcher-host {
        max-width: 100%;
        font-size: 10.5px;
        color: rgba(255, 255, 255, 0.52);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .arcline-switcher-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 7px;
        padding: 0 2px;
        min-width: 0;
      }
      .arcline-switcher-favicon {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        flex-shrink: 0;
        object-fit: contain;
      }
      .arcline-switcher-title {
        font-size: 12px;
        font-weight: 500;
        line-height: 1.3;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: rgba(255, 255, 255, 0.92);
      }
      @media (prefers-reduced-motion: reduce) {
        .arcline-panel,
        .arcline-panel.open,
        .arcline-resize::after,
        .arcline-resize-badge {
          transition: none;
        }
      }
    `;
  }

  function applyZoomCompensation(): void {
    const inv = Math.abs(pageZoom - 1) < 0.005 ? '' : String(1 / pageZoom);
    if (edgeEl) edgeEl.style.zoom = inv;
    if (glassBackdropEl) glassBackdropEl.style.zoom = inv;
    if (panelEl) panelEl.style.zoom = inv;
    if (resizeBadgeEl) resizeBadgeEl.style.zoom = inv;
    if (cmdBackdropEl) cmdBackdropEl.style.zoom = inv;
    if (switcherEl) switcherEl.style.zoom = inv;
    // Force synchronous reflow so any child extension OOPIF immediately updates its layout viewport width
    if (panelEl && iframeEl) {
      void panelEl.offsetWidth;
      void iframeEl.offsetWidth;
    }
  }

  function setPageZoom(nextZoom: number): void {
    if (!Number.isFinite(nextZoom) || nextZoom <= 0.1 || nextZoom > 10) return;
    pageZoom = nextZoom;
    applyZoomCompensation();
  }

  function postHostMetrics(): void {
    if (!iframeLoaded || !iframeEl?.contentWindow || !EXT_ORIGIN) return;
    try {
      iframeEl.contentWindow.postMessage(
        {
          type: 'arcline:host-metrics',
          sidebarWidth: settings.overlayWidthPx,
          stageExpanded,
        },
        EXT_ORIGIN,
      );
    } catch {
      // Ignore cross-origin timing races before iframe finishes navigating
    }
  }

  function applyDimensions(): void {
    if (edgeEl) {
      edgeEl.style.width = `${settings.edgeTriggerWidthPx}px`;
      edgeEl.style.pointerEvents =
        settings.edgeHoverEnabled && !nativeSidePanelOpen ? 'auto' : 'none';
    }
    if (glassBackdropEl) {
      glassBackdropEl.style.width = `${settings.overlayWidthPx}px`;
    }
    if (panelEl && !stageExpanded) {
      panelEl.style.width = `${settings.overlayWidthPx}px`;
    }
    applyZoomCompensation();
    postHostMetrics();
  }

  function setStageExpanded(expanded: boolean): void {
    if (stageExpanded === expanded) return;
    stageExpanded = expanded && machine.isOpen;
    if (stageExpanded) {
      // Paint the exact Space-tinted glass backing BEFORE resizing the cross-origin iframe
      // so Chromium's 1-frame OOPIF resize re-rasterization never flashes blank.
      if (glassBackdropEl) {
        glassBackdropEl.classList.add('active');
        void glassBackdropEl.offsetWidth;
      }
      if (panelEl) {
        panelEl.classList.add('stage-expanded');
      }
      postHostMetrics();
    } else {
      if (panelEl) {
        panelEl.classList.remove('stage-expanded');
        panelEl.style.width = `${settings.overlayWidthPx}px`;
      }
      postHostMetrics();
      requestAnimationFrame(() => {
        if (!stageExpanded) {
          glassBackdropEl?.classList.remove('active');
        }
      });
    }
  }

  function ensureHostMounted(): void {
    if (disposed || !document.documentElement) return;
    if (hostEl?.isConnected) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-arcline-overlay', 'true');
    const root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = buildStyles();

    const edge = document.createElement('div');
    edge.className = 'arcline-edge';
    edge.setAttribute('data-arcline-edge', 'true');
    edge.setAttribute('role', 'region');
    edge.setAttribute('aria-label', 'Arcline Sidebar Edge Trigger');

    const glassBackdrop = document.createElement('div');
    glassBackdrop.className = 'arcline-glass-backing';
    glassBackdrop.setAttribute('data-arcline-glass-backing', 'true');

    const panel = document.createElement('div');
    panel.className = 'arcline-panel';
    panel.setAttribute('data-arcline-panel', 'true');

    const resize = document.createElement('div');
    resize.className = 'arcline-resize';
    resize.setAttribute('data-arcline-resize', 'true');

    const badge = document.createElement('div');
    badge.className = 'arcline-resize-badge';
    badge.setAttribute('aria-hidden', 'true');

    const cmdModal = document.createElement('div');
    cmdModal.className = 'arcline-cmd-modal';
    cmdModal.setAttribute('data-arcline-command-modal', 'true');

    const switcher = document.createElement('div');
    switcher.className = 'arcline-switcher-dock';
    switcher.setAttribute('data-arcline-tab-switcher', 'true');
    switcher.setAttribute('role', 'listbox');
    switcher.setAttribute('aria-label', 'Tab Switcher');

    panel.append(resize);
    root.append(style, edge, glassBackdrop, panel, badge, cmdModal, switcher);
    document.documentElement.append(host);

    hostEl = host;
    shadow = root;
    edgeEl = edge;
    glassBackdropEl = glassBackdrop;
    panelEl = panel;
    iframeEl = null;
    resizeEl = resize;
    resizeBadgeEl = badge;
    cmdBackdropEl = cmdModal;
    switcherEl = switcher;

    edge.addEventListener('pointerenter', (e) => {
      if (document.hidden || tabHidden || nativeSidePanelOpen || unloadTimer !== undefined) return;
      machine.handlePointerMove(1, e.buttons);
    });
    edge.addEventListener('mouseenter', (e) => {
      if (document.hidden || tabHidden || nativeSidePanelOpen || unloadTimer !== undefined) return;
      machine.handlePointerMove(1, e.buttons);
    });
    edge.addEventListener('click', () => {
      if (!document.hidden && !tabHidden && !nativeSidePanelOpen && settings.edgeHoverEnabled) {
        machine.forceOpen();
      }
    });

    panel.addEventListener('pointerenter', () => machine.handlePointerEnterPanel());
    panel.addEventListener('mouseenter', () => machine.handlePointerEnterPanel());
    panel.addEventListener('pointerleave', (e) => {
      if (stageExpanded || Date.now() < forceOpenGraceUntil) return;
      // Ignore synthetic leave when cursor enters the child cross-origin extension iframe (OOPIF)
      // or rests in the 8px left gutter between screen edge and floating panel.
      if (iframeEl && e.relatedTarget === iframeEl) return;
      const rect = panel.getBoundingClientRect();
      if (
        e.clientX >= 0 &&
        e.clientX <= rect.right + 4 &&
        e.clientY >= 0 &&
        e.clientY <= rect.bottom + 4
      ) {
        return;
      }
      machine.handlePointerLeavePanel();
    });

    wireResizeHandle(resize);
    applyDimensions();
  }

  function wireResizeHandle(handle: HTMLDivElement): void {
    handle.addEventListener('pointerdown', (startEvent) => {
      if (startEvent.button !== 0 || !panelEl) return;
      startEvent.preventDefault();
      startEvent.stopPropagation();
      machine.setResizing(true);
      panelEl.classList.add('resizing');
      if (iframeEl) iframeEl.style.pointerEvents = 'none';
      if (resizeBadgeEl) {
        resizeBadgeEl.textContent = `${settings.overlayWidthPx}px`;
        resizeBadgeEl.style.left = `${settings.overlayWidthPx + 16}px`;
        resizeBadgeEl.classList.add('visible');
      }

      const onMove = (ev: PointerEvent) => {
        const nextWidth = Math.max(220, Math.min(560, Math.round(toUnzoomedPx(ev.clientX) - 8)));
        settings = { ...settings, overlayWidthPx: nextWidth };
        applyDimensions();
        machine.updateConfig(currentConfig());
        if (resizeBadgeEl) {
          resizeBadgeEl.textContent = `${nextWidth}px`;
          resizeBadgeEl.style.left = `${nextWidth + 16}px`;
        }
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
        panelEl?.classList.remove('resizing');
        resizeBadgeEl?.classList.remove('visible');
        if (iframeEl) iframeEl.style.pointerEvents = '';
        machine.setResizing(false);
        void persistSettings({ overlayWidthPx: settings.overlayWidthPx });
      };

      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
    });
  }

  function currentConfig() {
    return {
      enabled: settings.edgeHoverEnabled,
      triggerWidthPx: settings.edgeTriggerWidthPx,
      openDelayMs: settings.edgeOpenDelayMs,
      closeDelayMs: settings.edgeCloseDelayMs,
      panelWidthPx: settings.overlayWidthPx,
    };
  }

  let overlaySrcPending = false;
  let overlayAuthRetries = 0;
  let overlayRetryTimer: ReturnType<typeof setTimeout> | undefined;

  function isExtensionInvalidated(): boolean {
    try {
      return typeof chrome === 'undefined' || !chrome.runtime?.id;
    } catch {
      return true;
    }
  }

  function clearReloadNotice(): void {
    if (reloadCardEl) {
      reloadCardEl.remove();
      reloadCardEl = null;
    }
  }

  function showReloadNotice(): void {
    ensureHostMounted();
    if (!panelEl) return;
    if (iframeEl) {
      iframeLoaded = false;
      iframeEl.remove();
      iframeEl = null;
    }
    if (reloadCardEl?.isConnected) return;

    const isJa = typeof navigator !== 'undefined' && /^ja/i.test(navigator.language || '');
    const card = document.createElement('div');
    card.className = 'arcline-reload-card';
    card.setAttribute('data-arcline-reload-notice', 'true');
    card.setAttribute('role', 'status');

    const icon = document.createElement('div');
    icon.className = 'arcline-reload-icon';
    icon.textContent = '↻';

    const title = document.createElement('p');
    title.className = 'arcline-reload-title';
    title.textContent = isJa ? 'Arcline が更新されました' : 'Arcline was updated';

    const desc = document.createElement('p');
    desc.className = 'arcline-reload-desc';
    desc.textContent = isJa
      ? 'サイドバーを再表示するには、このページを再読み込みしてください。'
      : 'Reload this page to reconnect the Arcline sidebar.';

    const actions = document.createElement('div');
    actions.className = 'arcline-reload-actions';

    const reloadBtn = document.createElement('button');
    reloadBtn.type = 'button';
    reloadBtn.className = 'arcline-reload-btn';
    reloadBtn.textContent = isJa ? 'ページを再読み込み' : 'Reload page';
    reloadBtn.addEventListener('click', () => {
      window.location.reload();
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'arcline-reload-dismiss';
    dismissBtn.textContent = isJa ? '閉じる' : 'Close';
    dismissBtn.addEventListener('click', () => {
      machine.forceClose();
    });

    actions.append(reloadBtn, dismissBtn);
    card.append(icon, title, desc, actions);
    panelEl.prepend(card);
    reloadCardEl = card;
  }

  function armForceOpenGrace(durationMs: number): void {
    forceOpenGraceUntil = Date.now() + durationMs;
    if (graceCheckTimer) clearTimeout(graceCheckTimer);
    graceCheckTimer = setTimeout(() => {
      graceCheckTimer = undefined;
      if (
        machine.isOpen &&
        !machine.isLocked &&
        !stageExpanded &&
        lastKnownPointerX !== null &&
        lastKnownPointerX > settings.overlayWidthPx + 12
      ) {
        machine.handlePointerLeavePanel();
      }
    }, durationMs + 24);
  }

  async function requestFrameToken(kind: 'overlay' | 'modal'): Promise<string | null> {
    if (isExtensionInvalidated()) return null;
    try {
      const res = (await chrome.runtime.sendMessage({ arclineIssueFrameToken: kind })) as
        | { ok?: boolean; token?: string }
        | undefined;
      return res?.ok && typeof res.token === 'string' ? res.token : null;
    } catch {
      teardownIfInvalidated();
      return null;
    }
  }

  function isSafeBackdropCss(value: string): boolean {
    if (value.length > 1024) return false;
    if (/[;{}\r\n]|url\s*\(|expression\s*\(|@import/i.test(value)) return false;
    return true;
  }

  function reportOverlayState(state: 'open' | 'closed'): void {
    if (suppressStateReport || !chrome.runtime?.id) return;
    chrome.runtime.sendMessage({ arclineOverlayState: state }).catch(() => undefined);
  }

  function mountSidebarIframe(src: string): void {
    if (!panelEl || iframeEl?.isConnected) return;
    clearReloadNotice();
    const iframe = document.createElement('iframe');
    iframe.className = 'arcline-frame';
    iframe.style.colorScheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    iframe.setAttribute('title', 'Arcline Sidebar');
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.src = src;
    iframe.addEventListener('load', () => {
      if (iframe.hasAttribute('src')) {
        iframeLoaded = true;
        postHostMetrics();
      }
    });
    panelEl.prepend(iframe);
    iframeEl = iframe;
  }

  function ensureSidebarIframeMounted(): void {
    if (disposed || !panelEl) return;
    if (isExtensionInvalidated()) {
      showReloadNotice();
      return;
    }
    if (iframeEl?.isConnected || overlaySrcPending || !PANEL_URL) return;
    overlaySrcPending = true;
    void requestFrameToken('overlay').then((token) => {
      overlaySrcPending = false;
      if (disposed || !panelEl) return;
      if (isExtensionInvalidated()) {
        if (machine.isOpen) showReloadNotice();
        return;
      }
      if (iframeEl?.isConnected) return;
      if (token) {
        mountSidebarIframe(`${PANEL_URL}#arclineToken=${token}`);
        return;
      }
      // Retry once if the MV3 Service Worker was restarting transiently while the panel stayed open
      if (machine.isOpen && overlayAuthRetries < 2) {
        overlayAuthRetries += 1;
        if (overlayRetryTimer) clearTimeout(overlayRetryTimer);
        overlayRetryTimer = setTimeout(() => {
          overlayRetryTimer = undefined;
          if (machine.isOpen && !iframeEl?.isConnected) {
            ensureSidebarIframeMounted();
          }
        }, 250);
      } else if (machine.isOpen) {
        showReloadNotice();
      }
    });
  }

  function showPanel(): void {
    if (nativeSidePanelOpen) return;
    ensureHostMounted();
    if (!panelEl) return;
    if (unloadTimer) {
      clearTimeout(unloadTimer);
      unloadTimer = undefined;
    }
    overlayAuthRetries = 0;
    ensureSidebarIframeMounted();
    panelEl.classList.add('open');
    postHostMetrics();
    reportOverlayState('open');
  }

  function hidePanel(): void {
    setStageExpanded(false);
    panelEl?.classList.remove('open');
    reportOverlayState('closed');
  }

  function revealCommandBarFrame(): void {
    if (cmdRevealTimer) {
      clearTimeout(cmdRevealTimer);
      cmdRevealTimer = undefined;
    }
    if (!commandBarOpen || !cmdIframeEl) return;
    cmdIframeEl.classList.add('ready');
    cmdIframeEl.focus();
  }

  let commandBarOpenGraceUntil = 0;

  function openCommandBarModal(): void {
    ensureHostMounted();
    if (!cmdBackdropEl || !COMMAND_BAR_MODAL_URL) return;
    const seq = ++commandBarOpenSeq;
    commandBarOpenGraceUntil = Date.now() + 450;
    if (cmdRevealTimer) {
      clearTimeout(cmdRevealTimer);
      cmdRevealTimer = undefined;
    }
    commandBarOpen = true;
    cmdBackdropEl.classList.add('open');
    applyZoomCompensation();
    void requestFrameToken('modal').then((token) => {
      if (disposed || !commandBarOpen || seq !== commandBarOpenSeq || !cmdBackdropEl || !token) {
        return;
      }
      const src = `${COMMAND_BAR_MODAL_URL}&t=${Date.now()}#arclineToken=${token}`;
      if (cmdIframeEl) {
        cmdIframeEl.remove();
        cmdIframeEl = null;
      }
      const cmdFrame = document.createElement('iframe');
      cmdFrame.className = 'arcline-cmd-frame';
      cmdFrame.style.colorScheme = 'light';
      cmdFrame.setAttribute('title', 'Arcline Command Bar');
      cmdFrame.setAttribute('allow', 'clipboard-write');
      cmdFrame.src = src;
      cmdBackdropEl.append(cmdFrame);
      cmdIframeEl = cmdFrame;
      cmdRevealTimer = setTimeout(() => {
        if (seq === commandBarOpenSeq) revealCommandBarFrame();
      }, 400);
    });
  }

  function shortSwitcherHost(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.hostname.replace(/^www\./, '');
      }
      return parsed.protocol.replace(/:$/, '');
    } catch {
      return '';
    }
  }

  function closeTabSwitcher(): void {
    switcherSeq += 1;
    switcherOpen = false;
    switcherLoading = false;
    switcherItems = [];
    switcherIndex = 0;
    switcherPendingDelta = 0;
    if (switcherEl) {
      switcherEl.classList.remove('open');
      switcherEl.replaceChildren();
    }
  }

  function commitTabSwitcher(explicitTabId?: number): void {
    const targetId = explicitTabId ?? switcherItems[switcherIndex]?.id;
    closeTabSwitcher();
    if (targetId !== undefined && chrome.runtime?.id) {
      chrome.runtime.sendMessage({ arclineSwitchTabId: targetId }).catch(() => undefined);
    }
  }

  function renderTabSwitcher(): void {
    if (!switcherOpen || switcherItems.length === 0) {
      if (switcherEl) {
        switcherEl.classList.remove('open');
        switcherEl.replaceChildren();
      }
      return;
    }
    ensureHostMounted();
    if (!switcherEl) return;
    applyZoomCompensation();
    if (switcherAccentHex) {
      switcherEl.style.setProperty('--arcline-sw-accent', switcherAccentHex);
      switcherEl.style.setProperty(
        '--arcline-sw-accent-bg',
        `color-mix(in oklch, ${switcherAccentHex} 26%, rgba(255, 255, 255, 0.08))`,
      );
    } else {
      switcherEl.style.removeProperty('--arcline-sw-accent');
      switcherEl.style.removeProperty('--arcline-sw-accent-bg');
    }

    const fragment = document.createDocumentFragment();
    switcherItems.forEach((item, idx) => {
      const selected = idx === switcherIndex;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `arcline-switcher-card${selected ? ' active' : ''}`;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      btn.setAttribute('data-tab-id', String(item.id));
      btn.addEventListener('click', () => commitTabSwitcher(item.id));

      const preview = document.createElement('div');
      preview.className = 'arcline-switcher-preview';
      const safeFav =
        item.favIconUrl && /^(?:https?:|data:image\/)/i.test(item.favIconUrl)
          ? item.favIconUrl
          : undefined;
      const badge = document.createElement('div');
      badge.className = 'arcline-switcher-badge';
      if (safeFav) {
        const favImg = document.createElement('img');
        favImg.src = safeFav;
        favImg.alt = '';
        badge.append(favImg);
      } else {
        badge.textContent = (item.title.trim()[0] ?? 'T').toUpperCase();
      }
      const host = document.createElement('span');
      host.className = 'arcline-switcher-host';
      host.textContent = shortSwitcherHost(item.url);
      preview.append(badge, host);

      const meta = document.createElement('div');
      meta.className = 'arcline-switcher-meta';
      if (safeFav) {
        const icon = document.createElement('img');
        icon.className = 'arcline-switcher-favicon';
        icon.src = safeFav;
        icon.alt = '';
        meta.append(icon);
      }
      const title = document.createElement('span');
      title.className = 'arcline-switcher-title';
      title.textContent = item.title;
      meta.append(title);

      btn.append(preview, meta);
      fragment.append(btn);
    });
    switcherEl.replaceChildren(fragment);
    switcherEl.classList.add('open');
  }

  function handleCtrlTabStep(direction: 1 | -1): void {
    ctrlHeldNow = true;
    if (switcherOpen) {
      switcherIndex = stepSwitcherIndex(switcherIndex, direction, switcherItems.length);
      renderTabSwitcher();
      return;
    }
    if (switcherLoading) {
      switcherPendingDelta += direction;
      return;
    }
    if (!chrome.runtime?.id) return;
    switcherLoading = true;
    switcherPendingDelta = 0;
    const seq = ++switcherSeq;
    chrome.runtime
      .sendMessage({ arclineGetTabSwitcherList: { direction } })
      .then((res) => {
        if (disposed || seq !== switcherSeq) return;
        switcherLoading = false;
        const data = (res as { ok?: boolean; data?: TabSwitcherResponse } | undefined)?.data;
        if (!data || data.items.length === 0) return;
        const idx = stepSwitcherIndex(data.selectedIndex, switcherPendingDelta, data.items.length);
        switcherPendingDelta = 0;
        if (!ctrlHeldNow) {
          // Ctrl was released quickly before the IPC returned: switch immediately!
          const targetId = data.items[idx]?.id;
          closeTabSwitcher();
          if (targetId !== undefined) {
            chrome.runtime.sendMessage({ arclineSwitchTabId: targetId }).catch(() => undefined);
          }
          return;
        }
        switcherItems = data.items;
        switcherIndex = idx;
        switcherAccentHex = data.accentHex;
        switcherOpen = true;
        renderTabSwitcher();
      })
      .catch(() => {
        if (seq === switcherSeq) switcherLoading = false;
      });
  }

  function closeCommandBarModal(): void {
    commandBarOpenSeq += 1;
    if (cmdRevealTimer) {
      clearTimeout(cmdRevealTimer);
      cmdRevealTimer = undefined;
    }
    if (!commandBarOpen) return;
    commandBarOpen = false;
    cmdBackdropEl?.classList.remove('open');
    if (cmdIframeEl) {
      cmdIframeEl.remove();
      cmdIframeEl = null;
    }
  }

  function unloadIframeIfIdle(): void {
    if (!iframeEl || machine.isOpen || machine.isLocked) return;
    iframeLoaded = false;
    iframeEl.remove();
    iframeEl = null;
  }

  async function persistSettings(patch: Partial<Settings>): Promise<void> {
    try {
      const res = await chrome.storage.local.get(SETTINGS_KEY);
      const merged = completeSettings({
        ...(res[SETTINGS_KEY] as Partial<Settings> | undefined),
        ...patch,
      });
      await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
    } catch {
      teardownIfInvalidated();
    }
  }

  async function loadInitialSettings(): Promise<void> {
    try {
      const res = await chrome.storage.local.get(SETTINGS_KEY);
      settings = completeSettings(res[SETTINGS_KEY] as Partial<Settings> | undefined);
      machine.updateConfig(currentConfig());
      applyDimensions();
    } catch {
      teardownIfInvalidated();
    }
  }

  async function loadInitialState(): Promise<{ autoOpen: boolean }> {
    try {
      const res = (await chrome.runtime.sendMessage({ arclineInit: true })) as
        | { zoom?: number; autoOpen?: boolean; nativeSidePanelOpen?: boolean }
        | undefined;
      if (typeof res?.zoom === 'number') {
        setPageZoom(res.zoom);
      }
      if (typeof res?.nativeSidePanelOpen === 'boolean') {
        setNativeSidePanelOpen(res.nativeSidePanelOpen);
      }
      return { autoOpen: Boolean(res?.autoOpen) && !nativeSidePanelOpen };
    } catch {
      return { autoOpen: false };
    }
  }

  function setNativeSidePanelOpen(open: boolean): void {
    nativeSidePanelOpen = open;
    if (open && machine.isOpen) {
      suppressStateReport = true;
      try {
        machine.forceClose();
      } finally {
        suppressStateReport = false;
      }
    }
    applyDimensions();
  }

  async function loadInitialZoom(): Promise<void> {
    try {
      const res = (await chrome.runtime.sendMessage({ arclineGetZoom: true })) as
        | { zoom?: number }
        | undefined;
      if (typeof res?.zoom === 'number') {
        setPageZoom(res.zoom);
      }
    } catch {
      // Ignore if SW is unavailable during teardown
    }
  }

  async function bootstrapOverlay(): Promise<void> {
    const [, init] = await Promise.all([loadInitialSettings(), loadInitialState()]);
    if (disposed) return;
    const explicitEmptySpaceOpen =
      location.protocol === 'chrome-extension:' &&
      new URLSearchParams(location.search).get('openOverlay') === '1';
    if (explicitEmptySpaceOpen || init.autoOpen) {
      armForceOpenGrace(360);
      machine.forceOpen();
    }
  }

  function teardownIfInvalidated(): void {
    if (isExtensionInvalidated() && machine.isOpen) {
      showReloadNotice();
    }
  }

  function cleanup(): void {
    if (disposed) return;
    disposed = true;
    machine.dispose();
    if (unloadTimer) clearTimeout(unloadTimer);
    if (repairTimer) clearTimeout(repairTimer);
    if (cmdRevealTimer) clearTimeout(cmdRevealTimer);
    if (overlayRetryTimer) clearTimeout(overlayRetryTimer);
    if (graceCheckTimer) clearTimeout(graceCheckTimer);
    observer?.disconnect();
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('mousedown', onMouseDown, true);
    window.removeEventListener('touchstart', onTouchStart, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('blur', onWindowBlur);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('message', onWindowMessage);
    document.documentElement.removeEventListener('pointerleave', onDocumentPointerLeave);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    hostEl?.remove();
    hostEl = null;
    shadow = null;
    edgeEl = null;
    glassBackdropEl = null;
    panelEl = null;
    iframeEl = null;
    reloadCardEl = null;
    cmdBackdropEl = null;
    cmdIframeEl = null;
    commandBarOpen = false;
    resizeEl = null;
    resizeBadgeEl = null;
    switcherEl = null;
    switcherOpen = false;
    switcherLoading = false;
  }

  const onPointerMove = (e: PointerEvent) => {
    tabHidden = false;
    if (ctrlHeldNow && !e.ctrlKey) {
      ctrlHeldNow = false;
      if (switcherOpen) commitTabSwitcher();
    }
    const unzoomedX = toUnzoomedPx(e.clientX);
    lastKnownPointerX = unzoomedX;
    if (nativeSidePanelOpen) return;
    if (machine.isOpen && Date.now() < forceOpenGraceUntil) return;
    machine.handlePointerMove(unzoomedX, e.buttons);
  };

  function handleOutsideInteraction(target: EventTarget | null, clientX: number): void {
    if (target === hostEl) return;
    const unzoomedX = toUnzoomedPx(clientX);
    lastKnownPointerX = unzoomedX;
    forceOpenGraceUntil = 0;
    if (graceCheckTimer) {
      clearTimeout(graceCheckTimer);
      graceCheckTimer = undefined;
    }
    if (machine.isOpen && !machine.isLocked && !stageExpanded) {
      machine.forceClose();
      return;
    }
    machine.handleOutsidePointerDown(unzoomedX);
  }

  const onPointerDown = (e: PointerEvent) => {
    handleOutsideInteraction(e.target, e.clientX);
  };

  const onMouseDown = (e: MouseEvent) => {
    handleOutsideInteraction(e.target, e.clientX);
  };

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    handleOutsideInteraction(e.target, touch ? touch.clientX : settings.overlayWidthPx + 100);
  };

  const onWindowBlur = () => {
    ctrlHeldNow = false;
    if (switcherOpen || switcherLoading) {
      closeTabSwitcher();
    }
    // Clicking inside an embedded cross-origin webpage iframe (YouTube, Google Docs, etc.)
    // blurs the host window without firing pointerdown on it. Defer 1 tick so Chromium updates
    // document.activeElement before we check whether focus moved into Arcline's own overlay host.
    setTimeout(() => {
      if (disposed || !machine.isOpen || machine.isLocked || stageExpanded) return;
      if (document.activeElement === hostEl) return;
      if (lastKnownPointerX !== null && lastKnownPointerX <= settings.overlayWidthPx + 12) return;
      machine.forceClose();
    }, 0);
  };

  const onPointerUp = (e: PointerEvent) => {
    machine.handlePointerUp(toUnzoomedPx(e.clientX));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (settings.ctrlTabSwitcher) {
      if (e.key === 'Control') ctrlHeldNow = true;
      if (e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        handleCtrlTabStep(e.shiftKey ? -1 : 1);
        return;
      }
      if (switcherOpen && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        e.stopPropagation();
        handleCtrlTabStep(e.key === 'ArrowRight' ? 1 : -1);
        return;
      }
      if ((switcherOpen || switcherLoading) && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeTabSwitcher();
        return;
      }
    }
    if (commandBarOpen && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeCommandBarModal();
      return;
    }
    const isCommandBarPage =
      location.protocol === 'chrome-extension:' && location.pathname.endsWith('/empty-space.html');
    const customAction = matchCustomShortcut(e, settings.customShortcuts, {
      allowInInput: isCommandBarPage,
    });
    if (customAction && chrome.runtime?.id) {
      e.preventDefault();
      e.stopPropagation();
      if (customAction === 'toggleSidebar') {
        if (machine.isOpen) {
          machine.forceClose();
        } else {
          tabHidden = false;
          machine.forceOpen();
        }
        return;
      }
      const cmdMap = {
        openCommandBar: 'open-command-bar',
        nextSpace: 'next-space',
        previousSpace: 'previous-space',
        togglePin: 'toggle-pin',
      } as const;
      chrome.runtime
        .sendMessage({ arclineTriggerCommand: cmdMap[customAction] })
        .catch(() => undefined);
      return;
    }
    const shortcuts = settings.favoriteShortcuts;
    if (!shortcuts || Object.keys(shortcuts).length === 0) return;
    const matchedUrl = matchFavoriteShortcut(e, shortcuts, { allowInInput: isCommandBarPage });
    if (!matchedUrl || !chrome.runtime?.id) return;
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({ arclineOpenFavoriteUrl: matchedUrl }).catch(() => undefined);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Control' || (ctrlHeldNow && !e.ctrlKey)) {
      ctrlHeldNow = false;
      if (switcherOpen) commitTabSwitcher();
    }
  };

  const onDocumentPointerLeave = () => {
    machine.handleDocumentPointerLeave();
  };

  const onWindowMessage = (e: MessageEvent) => {
    if (!e.isTrusted || !EXT_ORIGIN || e.origin !== EXT_ORIGIN) return;
    const fromSidebar = Boolean(iframeEl?.contentWindow && e.source === iframeEl.contentWindow);
    const fromCommandBar = Boolean(
      cmdIframeEl?.contentWindow && e.source === cmdIframeEl.contentWindow,
    );
    if (!fromSidebar && !fromCommandBar) return;
    const msg = e.data as
      | {
          type?: string;
          locked?: boolean;
          expanded?: boolean;
          scheme?: 'light' | 'dark';
          backdrop?: string;
        }
      | undefined;
    if (fromCommandBar && msg?.type === 'arcline:command-bar-ready') {
      revealCommandBarFrame();
      return;
    }
    if (fromCommandBar && msg?.type === 'arcline:command-bar-close') {
      closeCommandBarModal();
      return;
    }
    if (!fromSidebar) return;
    if (msg?.type === 'arcline:overlay-auth-failed') {
      // Ephemeral token expired or was lost across a Service Worker restart: remount with a fresh token
      if (iframeEl) {
        iframeLoaded = false;
        iframeEl.remove();
        iframeEl = null;
      }
      if (machine.isOpen && overlayAuthRetries < 2) {
        overlayAuthRetries += 1;
        ensureSidebarIframeMounted();
      }
      return;
    }
    if (msg?.type === 'arcline:overlay-lock') {
      machine.setLocked(Boolean(msg.locked));
    } else if (msg?.type === 'arcline:overlay-stage') {
      setStageExpanded(Boolean(msg.expanded));
    } else if (
      msg?.type === 'arcline:overlay-scheme' &&
      (msg.scheme === 'light' || msg.scheme === 'dark')
    ) {
      if (iframeEl) iframeEl.style.colorScheme = msg.scheme;
      resizeBadgeEl?.classList.toggle('light', msg.scheme === 'light');
      if (
        glassBackdropEl &&
        typeof msg.backdrop === 'string' &&
        msg.backdrop &&
        isSafeBackdropCss(msg.backdrop)
      ) {
        glassBackdropEl.style.background = msg.backdrop;
      }
    } else if (msg?.type === 'arcline:overlay-enter') {
      machine.handlePointerEnterPanel();
    } else if (msg?.type === 'arcline:overlay-leave') {
      if (Date.now() >= forceOpenGraceUntil) {
        machine.handlePointerLeavePanel();
      }
    } else if (msg?.type === 'arcline:overlay-close') {
      machine.forceClose();
    } else if (msg?.type === 'arcline:request-metrics') {
      overlayAuthRetries = 0;
      postHostMetrics();
    }
  };

  function performTabHiddenUnload(): void {
    tabHidden = true;
    ctrlHeldNow = false;
    closeTabSwitcher();
    if (Date.now() >= commandBarOpenGraceUntil) {
      closeCommandBarModal();
    }
    if (machine.isLocked) return;
    suppressStateReport = true;
    try {
      machine.forceClose();
    } finally {
      suppressStateReport = false;
    }
    if (unloadTimer) clearTimeout(unloadTimer);
    unloadTimer = setTimeout(() => {
      unloadTimer = undefined;
      unloadIframeIfIdle();
    }, 400);
  }

  const onVisibilityChange = () => {
    if (document.hidden) {
      performTabHiddenUnload();
    } else {
      tabHidden = false;
    }
  };

  // Start up
  ensureHostMounted();
  void bootstrapOverlay();

  window.addEventListener('pointermove', onPointerMove, true);
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('blur', onWindowBlur);
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('message', onWindowMessage);
  window.addEventListener('resize', () => {
    void loadInitialZoom();
  });
  document.documentElement.addEventListener('pointerleave', onDocumentPointerLeave);
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Coalesced DOM self-repair for SPAs that rewrite documentElement children
  observer = new MutationObserver(() => {
    if (disposed || hostEl?.isConnected) return;
    if (repairTimer) return;
    repairTimer = setTimeout(() => {
      repairTimer = undefined;
      ensureHostMounted();
    }, 120);
  });
  observer.observe(document.documentElement, { childList: true });

  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (disposed || area !== 'local' || !changes[SETTINGS_KEY]) return;
    settings = completeSettings(changes[SETTINGS_KEY].newValue as Partial<Settings> | undefined);
    machine.updateConfig(currentConfig());
    applyDimensions();
  });

  chrome.runtime?.onMessage?.addListener((message: unknown, _sender, sendResponse) => {
    const msg = message as
      | {
          arclineOverlay?: 'toggle' | 'open' | 'close' | 'tab-hidden';
          arclineCommandBar?: 'open' | 'toggle' | 'close';
          arclineZoom?: number;
          arclineNativeSidePanel?: boolean;
        }
      | undefined;
    if (typeof msg?.arclineNativeSidePanel === 'boolean') {
      setNativeSidePanelOpen(msg.arclineNativeSidePanel);
      sendResponse({ ok: true });
      return false;
    }
    if (typeof msg?.arclineZoom === 'number') {
      setPageZoom(msg.arclineZoom);
      sendResponse({ ok: true, zoom: pageZoom });
      return false;
    }
    if (msg?.arclineCommandBar) {
      const isEmptySpaceSelf =
        location.protocol === 'chrome-extension:' &&
        location.pathname.endsWith('/empty-space.html');
      if (isEmptySpaceSelf) {
        window.dispatchEvent(
          new CustomEvent('arcline:empty-space-command-bar', {
            detail: msg.arclineCommandBar,
          }),
        );
        sendResponse({ ok: true, open: msg.arclineCommandBar !== 'close' });
        return false;
      }
      if (msg.arclineCommandBar === 'close') {
        closeCommandBarModal();
      } else if (msg.arclineCommandBar === 'toggle' && commandBarOpen) {
        closeCommandBarModal();
      } else {
        openCommandBarModal();
      }
      sendResponse({ ok: true, open: commandBarOpen });
      return false;
    }
    if (!msg?.arclineOverlay) return false;
    if (msg.arclineOverlay === 'tab-hidden') {
      performTabHiddenUnload();
    } else if (msg.arclineOverlay === 'open') {
      tabHidden = false;
      armForceOpenGrace(320);
      machine.forceOpen();
    } else if (msg.arclineOverlay === 'close') {
      machine.forceClose();
    } else if (machine.isOpen) {
      machine.forceClose();
    } else {
      tabHidden = false;
      machine.forceOpen();
    }
    sendResponse({ ok: true, open: machine.isOpen });
    return false;
  });

  // Reference shadow & resizeEl so TypeScript sees active usage
  void shadow;
  void resizeEl;
})();
