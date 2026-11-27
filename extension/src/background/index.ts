import { isOverlayCapableUrl, OverlayContinuityTracker } from '../core/overlay-continuity';
import { completeSettings } from '../core/settings';
import type { Command, CommandBarOpenMode, Settings } from '../core/types';
import {
  swLoadWallpaper,
  swRemoveWallpaper,
  swResolveWallpaper,
  swSaveWallpaper,
  type WallpaperRpcMessage,
} from '../core/wallpapers';
import { Engine } from './engine';
import { startNativeBridge } from './native-bridge';
import { ensureRoot } from './root';
import { syncShortcutsToBookmarks } from './shortcut-sync';
import { STORAGE_KEYS, stampTabActivity, storage } from './storage';

const AUTO_ARCHIVE_ALARM = 'arcline:auto-archive';
const ONBOARDING_SEEN_KEY = 'arcline:onboardingSeen';
const engine = new Engine();
startNativeBridge(engine);
const lastActiveTabByWindow = new Map<number, number>();
const overlayContinuity = new OverlayContinuityTracker();
let nativeSidePanelConnections = 0;
let cachedCommandBarOpenMode: CommandBarOpenMode = 'popup';

// Hydrate cached commandBarOpenMode eagerly on Service Worker start for 0-await onCreated path
void storage
  .getSettings()
  .then((s) => {
    cachedCommandBarOpenMode = s.commandBarOpenMode;
  })
  .catch(() => undefined);

function notifyOverlayOpen(tabId: number): void {
  chrome.tabs.sendMessage(tabId, { arclineOverlay: 'open' }).catch(() => undefined);
  setTimeout(() => {
    chrome.tabs.sendMessage(tabId, { arclineOverlay: 'open' }).catch(() => undefined);
  }, 110);
}

async function closeNativeSidePanel(): Promise<void> {
  try {
    await chrome.sidePanel.setOptions({ enabled: false });
    await chrome.sidePanel.setOptions({ path: 'sidepanel.html', enabled: true });
    nativeSidePanelConnections = 0;
  } catch (err) {
    console.warn('[Arcline] closeNativeSidePanel failed', err);
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'arcline:native-sidepanel') return;
  nativeSidePanelConnections += 1;
  port.onDisconnect.addListener(() => {
    nativeSidePanelConnections = Math.max(0, nativeSidePanelConnections - 1);
  });
});

function updateActionHintForTab(tabId: number, url?: string): void {
  const capable = isOverlayCapableUrl(url);
  chrome.action
    .setTitle({
      tabId,
      title: capable
        ? 'Open Arcline Side Panel (⌃⇧B / Alt+Shift+B)'
        : 'Arcline — Press ⌃⇧B (Alt+Shift+B) or click to open Side Panel on internal pages',
    })
    .catch(() => undefined);
}

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.warn('[Arcline] setPanelBehavior failed', err));

async function bootstrap(recover: boolean): Promise<void> {
  await ensureRoot();
  await engine.reconcileAll({ recover });
  const tabs = await chrome.tabs.query({});
  const tabIds = tabs.map((t) => t.id).filter((id): id is number => id !== undefined);
  await stampTabActivity(tabIds);
  await chrome.alarms.create(AUTO_ARCHIVE_ALARM, { periodInMinutes: 30 });
  const settings = await storage.getSettings();
  cachedCommandBarOpenMode = settings.commandBarOpenMode;
  await syncShortcutsToBookmarks(settings);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && STORAGE_KEYS.spaceMeta in changes) {
    const incoming = changes[STORAGE_KEYS.spaceMeta]?.newValue;
    if (incoming && typeof incoming === 'object') {
      void chrome.storage.local.set({ [STORAGE_KEYS.spaceMeta]: incoming });
    }
    return;
  }
  if (area !== 'local' || !(STORAGE_KEYS.settings in changes)) return;
  const next = completeSettings(changes[STORAGE_KEYS.settings]?.newValue as Partial<Settings>);
  cachedCommandBarOpenMode = next.commandBarOpenMode;
  void syncShortcutsToBookmarks(next);
});

chrome.runtime.onInstalled.addListener(async (details) => {
  await bootstrap(true);
  if (details.reason === 'install') {
    try {
      const stored = await chrome.storage.local.get(ONBOARDING_SEEN_KEY);
      if (!stored[ONBOARDING_SEEN_KEY]) {
        await chrome.storage.local.set({ [ONBOARDING_SEEN_KEY]: true });
        const url = chrome.runtime.getURL('onboarding.html');
        const existing = await chrome.tabs.query({ url }).catch(() => []);
        if (existing.length === 0) {
          await chrome.tabs.create({ url, active: true });
        }
      }
    } catch (err) {
      console.warn('[Arcline] onboarding open failed', err);
    }
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await bootstrap(true);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_ARCHIVE_ALARM) {
    engine
      .run({ type: 'runAutoArchive' })
      .catch((err) => console.warn('[Arcline] auto-archive', err));
  }
});

async function runOpenCommandBar(tab?: chrome.tabs.Tab): Promise<void> {
  const commandUrl = chrome.runtime.getURL('empty-space.html?commandBar=1');
  try {
    const [settings, normalWin] = await Promise.all([
      storage.getSettings().catch(() => undefined),
      chrome.windows
        .getLastFocused({ windowTypes: ['normal'], populate: true })
        .catch(() => undefined),
    ]);
    const openMode = settings?.commandBarOpenMode ?? cachedCommandBarOpenMode;
    cachedCommandBarOpenMode = openMode;
    const activeTab =
      tab?.id !== undefined && tab.windowId !== undefined
        ? tab
        : normalWin?.tabs?.find((t) => t.active);
    const targetWinId = activeTab?.windowId ?? normalWin?.id;
    if (targetWinId !== undefined) {
      await chrome.windows.update(targetWinId, { focused: true }).catch(() => undefined);
      const activeUrl = activeTab?.url ?? activeTab?.pendingUrl;
      if (
        openMode === 'popup' &&
        activeTab?.id !== undefined &&
        (isOverlayCapableUrl(activeUrl) || activeUrl?.includes('/empty-space.html'))
      ) {
        try {
          await chrome.tabs.sendMessage(activeTab.id, { arclineCommandBar: 'toggle' });
          return;
        } catch {
          // Content script not ready (e.g. tab opened before extension reload); fall back to Command Bar tab
        }
      }
      overlayContinuity.setWindowOpen(targetWinId, false);
      if (activeTab?.id !== undefined && activeUrl?.includes('/empty-space.html')) {
        await chrome.tabs.update(activeTab.id, { url: commandUrl, active: true });
      } else {
        await chrome.tabs.create({ windowId: targetWinId, url: commandUrl, active: true });
      }
      return;
    }
    await chrome.windows.create({
      url: `${commandUrl}&popup=1`,
      type: 'popup',
      width: 760,
      height: 580,
      focused: true,
    });
  } catch (err) {
    console.warn('[Arcline] open-command-bar failed', err);
  }
}

async function runSpaceOrPinCommand(
  command: 'next-space' | 'previous-space' | 'toggle-pin',
  tab?: chrome.tabs.Tab,
): Promise<void> {
  const activeTab = tab ?? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  const windowId = activeTab?.windowId;
  if (windowId === undefined) return;
  if (command === 'next-space') {
    overlayContinuity.setWindowOpen(windowId, true);
    await engine.run({ type: 'shiftSpace', windowId, offset: 1, keepOverlayOpen: true });
    return;
  }
  if (command === 'previous-space') {
    overlayContinuity.setWindowOpen(windowId, true);
    await engine.run({ type: 'shiftSpace', windowId, offset: -1, keepOverlayOpen: true });
    return;
  }
  if (command === 'toggle-pin' && activeTab?.id !== undefined) {
    await engine.run({ type: 'togglePin', windowId, tabId: activeTab.id });
  }
}

// NOTE: Do NOT mark this listener `async` before calling `chrome.sidePanel.open()` —
// Chrome requires `sidePanel.open()` to be invoked synchronously within the user gesture turn.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'toggle-sidebar') {
    const windowId = tab?.windowId;
    const overlayCapable = isOverlayCapableUrl(tab?.url);

    // If the native Side Panel is currently open, pressing Ctrl+B toggles it CLOSED immediately!
    if (nativeSidePanelConnections > 0) {
      void closeNativeSidePanel();
      return;
    }

    // On restricted pages (`brave://`, `chrome://`, Chrome Web Store), immediately open
    // the native Side Panel synchronously so the user gesture is never lost across an `await`.
    if (!overlayCapable && windowId !== undefined) {
      chrome.sidePanel
        .open({ windowId })
        .catch((err) => console.warn('[Arcline] sidePanel.open failed', err));
      return;
    }

    (async () => {
      const targetTab =
        tab ?? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
      const winId = targetTab?.windowId;
      if (winId === undefined) return;
      const settings = await storage.getSettings();
      if (
        settings.edgeHoverEnabled &&
        targetTab?.id !== undefined &&
        isOverlayCapableUrl(targetTab.url)
      ) {
        try {
          await chrome.tabs.sendMessage(targetTab.id, { arclineOverlay: 'toggle' });
          return;
        } catch {
          // Content script not ready (e.g. tab loaded before extension install); fall back to Side Panel
        }
      }
      await chrome.sidePanel.open({ windowId: winId }).catch(() => undefined);
    })();
    return;
  }

  if (command === 'open-command-bar') {
    void runOpenCommandBar(tab);
    return;
  }

  if (command === 'next-space' || command === 'previous-space' || command === 'toggle-pin') {
    void runSpaceOrPinCommand(command, tab);
  }
});

const lastContentTabByWindow = new Map<number, { tabId: number; url: string }>();
const transientNewTabIds = new Set<number>();
const NATIVE_NEWTAB_RE = /^(?:chrome|brave):\/\/newtab\/?$/i;

function isNativeNewTabUrl(url?: string): boolean {
  return Boolean(url && NATIVE_NEWTAB_RE.test(url));
}

function canPopupCommandBarOnUrl(url?: string): boolean {
  return Boolean(url && (isOverlayCapableUrl(url) || url.includes('/empty-space.html')));
}

chrome.tabs.onCreated.addListener((tab) => {
  const initialUrl = tab.pendingUrl ?? tab.url;
  if (tab.id !== undefined && tab.active && isNativeNewTabUrl(initialUrl)) {
    const createdTabId = tab.id;
    const winId = tab.windowId;
    if (cachedCommandBarOpenMode === 'newtab') {
      // Redirect native chrome://newtab / brave://newtab straight to our extension URL so
      // Chromium never renders its bottom "Arcline | Customize" bar and focuses the Command Bar.
      void chrome.tabs
        .update(createdTabId, { url: chrome.runtime.getURL('empty-space.html?commandBar=1') })
        .catch(() => undefined);
      return;
    }
    const cachedPrev = lastContentTabByWindow.get(winId);
    // Fast synchronous path (0 IPC roundtrips before switching back): minimizes visual flicker on Cmd+T.
    if (
      cachedPrev &&
      cachedPrev.tabId !== createdTabId &&
      canPopupCommandBarOnUrl(cachedPrev.url)
    ) {
      transientNewTabIds.add(createdTabId);
      setTimeout(() => transientNewTabIds.delete(createdTabId), 2000);
      const prevTabId = cachedPrev.tabId;
      void chrome.tabs.update(prevTabId, { active: true }).catch(() => undefined);
      void chrome.tabs.remove(createdTabId).catch(() => undefined);
      void chrome.tabs.sendMessage(prevTabId, { arclineCommandBar: 'open' }).catch(() => {
        // Content script not ready (e.g. tab loaded before extension install); fall back to Command Bar tab
        void chrome.tabs
          .create({
            windowId: winId,
            url: chrome.runtime.getURL('empty-space.html?commandBar=1'),
            active: true,
          })
          .catch(() => undefined);
      });
      return;
    }
    // Cold-start fallback when Service Worker just woke up and cache is empty
    const openerId = tab.openerTabId;
    if (openerId !== undefined && openerId !== createdTabId) {
      transientNewTabIds.add(createdTabId);
      setTimeout(() => transientNewTabIds.delete(createdTabId), 2000);
      void (async () => {
        try {
          const prevTab = await chrome.tabs.get(openerId).catch(() => undefined);
          const prevUrl = prevTab?.url ?? prevTab?.pendingUrl;
          if (!prevTab || prevTab.windowId !== winId || !canPopupCommandBarOnUrl(prevUrl)) {
            transientNewTabIds.delete(createdTabId);
            return;
          }
          void chrome.tabs.update(openerId, { active: true }).catch(() => undefined);
          void chrome.tabs.remove(createdTabId).catch(() => undefined);
          void chrome.tabs.sendMessage(openerId, { arclineCommandBar: 'open' }).catch(() => {
            void chrome.tabs
              .create({
                windowId: winId,
                url: chrome.runtime.getURL('empty-space.html?commandBar=1'),
                active: true,
              })
              .catch(() => undefined);
          });
        } catch {
          transientNewTabIds.delete(createdTabId);
        }
      })();
      return;
    }
  }
  if (tab.id !== undefined) {
    stampTabActivity([tab.id]).catch(() => undefined);
    updateActionHintForTab(tab.id, initialUrl);
  }
  engine.scheduleReconcile(tab.windowId);
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  if (transientNewTabIds.has(tabId)) return;
  const prevTabId = lastActiveTabByWindow.get(windowId);
  lastActiveTabByWindow.set(windowId, tabId);
  if (prevTabId !== undefined && prevTabId !== tabId) {
    chrome.tabs.sendMessage(prevTabId, { arclineOverlay: 'tab-hidden' }).catch(() => undefined);
  } else if (prevTabId === undefined) {
    // Service Worker may have cold-started after sleeping; broadcast tab-hidden to any non-active tabs in the window
    chrome.tabs
      .query({ windowId })
      .then((windowTabs) => {
        for (const t of windowTabs) {
          if (t.id !== undefined && t.id !== tabId) {
            chrome.tabs.sendMessage(t.id, { arclineOverlay: 'tab-hidden' }).catch(() => undefined);
          }
        }
      })
      .catch(() => undefined);
  }
  chrome.tabs
    .get(tabId)
    .then((t) => {
      const url = t.url ?? t.pendingUrl;
      if (url && !isNativeNewTabUrl(url)) {
        lastContentTabByWindow.set(windowId, { tabId, url });
      }
      updateActionHintForTab(tabId, url);
      const { shouldOpenOverlay, shouldCloseNativeSidePanel } = overlayContinuity.onTabActivated(
        windowId,
        url,
        nativeSidePanelConnections > 0,
      );
      // Automatically close any open native Side Panel when returning to an overlay-capable webpage
      // so the docked Side Panel never lingers on normal websites.
      if (shouldCloseNativeSidePanel) {
        void closeNativeSidePanel();
      }
      if (shouldOpenOverlay) {
        notifyOverlayOpen(tabId);
      }
    })
    .catch(() => undefined);
  engine.onTabActivated(tabId, windowId).catch((err) => console.warn('[Arcline] onActivated', err));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    if (tab.active && !isNativeNewTabUrl(changeInfo.url)) {
      lastContentTabByWindow.set(tab.windowId, { tabId, url: changeInfo.url });
    }
    updateActionHintForTab(tabId, changeInfo.url);
    engine.onTabUpdated(tabId, changeInfo.url).catch(() => undefined);
  }
  if (changeInfo.pinned !== undefined || changeInfo.groupId !== undefined) {
    engine.scheduleReconcile(tab.windowId);
  }
});

// Keep overlay UI zoom-invariant when the user zooms a webpage with Cmd+/Cmd-/Cmd0
chrome.tabs.onZoomChange.addListener(({ tabId, newZoomFactor }) => {
  chrome.tabs.sendMessage(tabId, { arclineZoom: newZoomFactor }).catch(() => undefined);
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  transientNewTabIds.delete(tabId);
  if (lastContentTabByWindow.get(removeInfo.windowId)?.tabId === tabId) {
    lastContentTabByWindow.delete(removeInfo.windowId);
  }
  engine.onTabRemoved(tabId).catch(() => undefined);
  if (!removeInfo.isWindowClosing) {
    engine.scheduleReconcile(removeInfo.windowId);
  }
});

chrome.tabs.onAttached.addListener((_tabId, attachInfo) => {
  engine.scheduleReconcile(attachInfo.newWindowId);
});

chrome.tabs.onDetached.addListener((_tabId, detachInfo) => {
  engine.scheduleReconcile(detachInfo.oldWindowId);
});

chrome.windows.onFocusChanged.addListener((focusedWindowId) => {
  overlayContinuity.onWindowFocusChanged(focusedWindowId, chrome.windows.WINDOW_ID_NONE);
});

chrome.windows.onRemoved.addListener((windowId) => {
  lastActiveTabByWindow.delete(windowId);
  lastContentTabByWindow.delete(windowId);
  overlayContinuity.onWindowRemoved(windowId);
});

chrome.tabGroups.onCreated.addListener((group) => {
  engine.scheduleReconcile(group.windowId);
});

chrome.tabGroups.onUpdated.addListener((group) => {
  engine.scheduleReconcile(group.windowId);
});

chrome.tabGroups.onRemoved.addListener((group) => {
  engine.scheduleReconcile(group.windowId);
});

chrome.bookmarks.onCreated.addListener(() => engine.scheduleReconcileAll());
chrome.bookmarks.onRemoved.addListener(() => engine.scheduleReconcileAll());
chrome.bookmarks.onChanged.addListener(() => engine.scheduleReconcileAll());
chrome.bookmarks.onMoved.addListener(() => engine.scheduleReconcileAll());

const FRAME_TOKEN_TTL_MS = 10 * 60 * 1000;
const FRAME_TOKENS_SESSION_KEY = 'arcline:frameTokens';
type FrameTokenEntry = { kind: 'overlay' | 'modal'; tabId: number; expiresAt: number };
const issuedFrameTokens = new Map<string, FrameTokenEntry>();
let frameTokensHydrated = false;
let frameTokensHydrationPromise: Promise<void> | null = null;

function pruneExpiredFrameTokens(now: number): void {
  for (const [token, entry] of issuedFrameTokens) {
    if (entry.expiresAt <= now) issuedFrameTokens.delete(token);
  }
}

async function persistFrameTokens(): Promise<void> {
  try {
    const obj: Record<string, FrameTokenEntry> = {};
    for (const [token, entry] of issuedFrameTokens) {
      obj[token] = entry;
    }
    await chrome.storage.session?.set?.({ [FRAME_TOKENS_SESSION_KEY]: obj });
  } catch {
    // Ignore if session storage is unavailable
  }
}

async function ensureFrameTokensHydrated(): Promise<void> {
  if (frameTokensHydrated) return;
  if (!frameTokensHydrationPromise) {
    frameTokensHydrationPromise = (async () => {
      try {
        const stored = await chrome.storage.session?.get?.(FRAME_TOKENS_SESSION_KEY);
        const map = stored?.[FRAME_TOKENS_SESSION_KEY] as
          | Record<string, FrameTokenEntry>
          | undefined;
        if (map && typeof map === 'object') {
          const now = Date.now();
          for (const [token, entry] of Object.entries(map)) {
            if (entry && entry.expiresAt > now && !issuedFrameTokens.has(token)) {
              issuedFrameTokens.set(token, entry);
            }
          }
        }
      } catch {
        // Ignore if session storage is unavailable
      } finally {
        frameTokensHydrated = true;
      }
    })();
  }
  await frameTokensHydrationPromise;
}

async function issueFrameToken(kind: 'overlay' | 'modal', tabId: number): Promise<string> {
  await ensureFrameTokensHydrated();
  const now = Date.now();
  pruneExpiredFrameTokens(now);
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  issuedFrameTokens.set(token, { kind, tabId, expiresAt: now + FRAME_TOKEN_TTL_MS });
  await persistFrameTokens();
  return token;
}

async function verifyFrameToken(
  token: string,
  kind: 'overlay' | 'modal',
  tabId: number | undefined,
): Promise<boolean> {
  await ensureFrameTokensHydrated();
  const now = Date.now();
  pruneExpiredFrameTokens(now);
  const entry = issuedFrameTokens.get(token);
  if (!entry || entry.kind !== kind || entry.expiresAt <= now) return false;
  if (tabId !== undefined && entry.tabId !== tabId) return false;
  return true;
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  const payload = message as
    | {
        arclineCommand?: Command;
        arclineGetZoom?: boolean;
        arclineInit?: boolean;
        arclineOverlayState?: 'open' | 'closed';
        arclineOpenFavoriteUrl?: string;
        arclineTriggerCommand?: 'open-command-bar' | 'next-space' | 'previous-space' | 'toggle-pin';
        arclineWallpaper?: WallpaperRpcMessage;
        arclineIssueFrameToken?: 'overlay' | 'modal';
        arclineVerifyFrameToken?: { token: string; kind: 'overlay' | 'modal' };
      }
    | undefined;

  if (
    payload?.arclineIssueFrameToken === 'overlay' ||
    payload?.arclineIssueFrameToken === 'modal'
  ) {
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      sendResponse({ ok: false });
      return false;
    }
    void issueFrameToken(payload.arclineIssueFrameToken, tabId)
      .then((token) => sendResponse({ ok: true, token }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (payload?.arclineVerifyFrameToken) {
    const { token, kind } = payload.arclineVerifyFrameToken;
    const isExtSender = Boolean(sender.url?.startsWith(chrome.runtime.getURL('')));
    if (!isExtSender || typeof token !== 'string' || (kind !== 'overlay' && kind !== 'modal')) {
      sendResponse({ ok: false });
      return false;
    }
    void verifyFrameToken(token, kind, sender.tab?.id).then((valid) => {
      sendResponse({ ok: valid });
    });
    return true;
  }

  if (payload?.arclineWallpaper) {
    if (!sender.url?.startsWith(chrome.runtime.getURL(''))) {
      sendResponse({ ok: false, error: 'Unauthorized wallpaper sender' });
      return false;
    }
    const rpc = payload.arclineWallpaper;
    void (async () => {
      try {
        if (rpc.op === 'save') {
          await swSaveWallpaper(rpc.key, rpc.dataUrl, rpc.name, rpc.mime);
          sendResponse({ ok: true });
        } else if (rpc.op === 'remove') {
          await swRemoveWallpaper(rpc.key);
          sendResponse({ ok: true });
        } else if (rpc.op === 'load') {
          const result = await swLoadWallpaper(rpc.key);
          sendResponse({ ok: true, result });
        } else if (rpc.op === 'resolve') {
          const result = await swResolveWallpaper(rpc.spaceId);
          sendResponse({ ok: true, result });
        } else {
          sendResponse({ ok: false, error: 'Unknown wallpaper operation' });
        }
      } catch (err) {
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return true;
  }

  if (
    payload?.arclineTriggerCommand === 'open-command-bar' ||
    payload?.arclineTriggerCommand === 'next-space' ||
    payload?.arclineTriggerCommand === 'previous-space' ||
    payload?.arclineTriggerCommand === 'toggle-pin'
  ) {
    const trigger = payload.arclineTriggerCommand;
    void (async () => {
      try {
        if (trigger === 'open-command-bar') {
          await runOpenCommandBar(sender.tab);
        } else {
          await runSpaceOrPinCommand(trigger, sender.tab);
        }
        sendResponse({ ok: true });
      } catch {
        sendResponse({ ok: false });
      }
    })();
    return true;
  }

  if (typeof payload?.arclineOpenFavoriteUrl === 'string') {
    const targetUrl = payload.arclineOpenFavoriteUrl;
    (async () => {
      try {
        const windowId =
          sender.tab?.windowId ??
          (await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => undefined))
            ?.id;
        if (windowId !== undefined) {
          await engine.run({ type: 'openFavoriteByUrl', windowId, url: targetUrl });
        }
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return true;
  }

  if (payload?.arclineOverlayState === 'open' || payload?.arclineOverlayState === 'closed') {
    const windowId = sender.tab?.windowId;
    if (windowId !== undefined) {
      overlayContinuity.reportOverlayState(
        windowId,
        Boolean(sender.tab?.active),
        payload.arclineOverlayState,
      );
    }
    sendResponse({ ok: true });
    return false;
  }

  if (payload?.arclineInit || payload?.arclineGetZoom) {
    const tabId = sender.tab?.id;
    const windowId = sender.tab?.windowId;
    const autoOpen =
      payload.arclineInit && windowId !== undefined
        ? overlayContinuity.shouldAutoOpenOnInit(
            windowId,
            Boolean(sender.tab?.active),
            sender.tab?.url,
          )
        : false;
    if (tabId === undefined) {
      sendResponse({ zoom: 1, autoOpen });
      return false;
    }
    (async () => {
      try {
        const zoom = await chrome.tabs.getZoom(tabId);
        sendResponse({ zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 1, autoOpen });
      } catch {
        sendResponse({ zoom: 1, autoOpen });
      }
    })();
    return true;
  }

  const cmd = payload?.arclineCommand;
  if (!cmd) return false;
  // Privileged Arcline commands are only accepted from extension pages (Side Panel, Overlay iframe,
  // Command Bar, Onboarding), never from webpage content scripts.
  if (!sender.url?.startsWith(chrome.runtime.getURL(''))) {
    sendResponse({ ok: false, error: 'Unauthorized command sender' });
    return false;
  }
  if (cmd.type === 'closeNativeSidePanel') {
    (async () => {
      await closeNativeSidePanel();
      sendResponse({ ok: true });
    })();
    return true;
  }
  (async () => {
    try {
      const result = await engine.run(cmd);
      sendResponse({ ok: true, result });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
  return true;
});
