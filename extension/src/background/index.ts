/// <reference types="chrome" />
import type { UiMode } from '@/lib/ui-mode';
import { SETTINGS_STORAGE_KEY } from '@/shared/settings';
import type { Settings } from '@/shared/types';
import { type CommandHandler, createCommandHandlers } from './handlers/command-handlers';
import { registerSpacesSnapshotListeners } from './listeners/spaces-snapshot-listeners';
import { initializeAutoArchive, setupAutoArchiveAlarm } from './services/auto-archive';
import {
  activateTab,
  archiveTab,
  broadcastSpacesSnapshot,
  closeTab,
  createPinnedFolder,
  createPinnedTab,
  createSpace,
  exportSpaceBookmarks,
  getActiveTabEntry,
  getArchivedTabs,
  getBookmarksForSpace,
  getSettings,
  getSpacesSnapshot,
  importSpaceBookmarks,
  movePinnedItem,
  moveTabToSpace,
  reloadTab,
  removePinnedItem,
  removeSpace,
  restoreArchivedTab,
  searchBookmarks,
  searchHistory,
  toggleTabPinned,
  updatePinnedItem,
  updateSettings,
} from './services/browser';
import {
  addToFavorites,
  getFavorites,
  removeFromFavorites,
  reorderFavorites,
  toggleFavorite,
} from './services/favorites';
import { initializeGestureDetection, subscribeToSwipe } from './services/gestures';
import { navigateSpace } from './services/space-navigation';

const LEGACY_UI_MODE_KEY = 'arclineoMode';
const UI_MODE_KEY = 'arcline.uiMode.current';

let currentUiMode: UiMode | null = null;

async function migrateUiModeStorageKey(): Promise<void> {
  try {
    const probe = await chrome.storage.local.get([UI_MODE_KEY, LEGACY_UI_MODE_KEY]);
    const hasNew = typeof probe[UI_MODE_KEY] !== 'undefined';
    const legacyValue = probe[LEGACY_UI_MODE_KEY] as unknown;
    const hasLegacy = typeof legacyValue !== 'undefined';

    if (!hasNew && hasLegacy) {
      await chrome.storage.local.set({ [UI_MODE_KEY]: legacyValue });
      await chrome.storage.local.remove(LEGACY_UI_MODE_KEY);
    }
  } catch (error) {
    console.warn('[Arcline] Failed to migrate uiMode storage key', error);
  }
}

function isSidePanelSupported(): boolean {
  return typeof chrome.sidePanel !== 'undefined' && typeof chrome.sidePanel.open === 'function';
}

async function resolveUiMode(): Promise<UiMode> {
  const settings = await getSettings();
  const preference = (settings.uiMode as UiMode | undefined) ?? 'floating';

  if (preference === 'side-panel') {
    if (!isSidePanelSupported()) {
      console.warn(
        '[Arcline] Side Panel preference requested but chrome.sidePanel is unavailable; falling back to floating UI'
      );
      return 'floating';
    }
    return 'side-panel';
  }

  if (preference === 'popup') {
    return 'popup';
  }

  return preference;
}

async function configureSidePanelBehavior(enabled: boolean): Promise<void> {
  if (!chrome.sidePanel || typeof chrome.sidePanel.setPanelBehavior !== 'function') {
    return;
  }

  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: enabled });
  } catch (error) {
    console.warn('[Arcline] Failed to configure side panel behavior', error);
  }
}

async function closeSidePanel(): Promise<void> {
  const panel = chrome.sidePanel as { close?: () => Promise<void> } | undefined;
  if (!panel || typeof panel.close !== 'function') {
    return;
  }

  try {
    await panel.close();
  } catch (error) {
    console.warn('[Arcline] Failed to close side panel', error);
  }
}

async function refreshUiMode(): Promise<void> {
  const nextMode = await resolveUiMode();
  if (currentUiMode === nextMode) {
    await configureSidePanelBehavior(nextMode === 'side-panel');
    return;
  }
  await applyUiMode(nextMode);
}

export async function broadcastUiMode(mode: UiMode) {
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(
      tabs.map((tab) => {
        const tabId = tab.id;
        if (typeof tabId !== 'number') return Promise.resolve();
        return new Promise<void>((resolve) => {
          chrome.tabs.sendMessage(tabId, { command: 'currentUiMode', mode }, () => {
            if (chrome.runtime.lastError) {
              resolve();
              return;
            }
            resolve();
          });
        });
      })
    );
  } catch (error) {
    console.warn('[Arcline] Failed to broadcast UI mode', error);
  }
}

async function applyUiMode(mode: UiMode) {
  if (mode === 'popup') {
    chrome.action.setPopup({ popup: 'popup.html' });
  } else {
    chrome.action.setPopup({ popup: '' });
  }

  if (mode !== 'side-panel') {
    await closeSidePanel();
  }

  currentUiMode = mode;

  await configureSidePanelBehavior(mode === 'side-panel');

  await chrome.storage.local.set({ [UI_MODE_KEY]: mode });
  await broadcastUiMode(mode);
}

async function detectUiMode(): Promise<UiMode> {
  const preferredMode = await resolveUiMode();
  const atlas = /\bAtlas\b/i.test(navigator.userAgent);
  if (atlas && preferredMode === 'side-panel') {
    console.info('[Arcline] Atlas browser detected; keeping preferred side-panel UI mode');
  }
  return preferredMode;
}

async function initializeUiMode() {
  await migrateUiModeStorageKey();
  await refreshUiMode();
}

export const commandHandlers: Record<string, CommandHandler> = createCommandHandlers({
  uiModeKey: UI_MODE_KEY,
  detectUiMode,
  getCurrentUiMode: () => currentUiMode,
  getActiveTabEntry,
  getSpacesSnapshot,
  getSettings,
  getArchivedTabs,
  getBookmarksForSpace,
  archiveTab,
  restoreArchivedTab,
  updateSettings,
  searchHistory,
  searchBookmarks,
  toggleTabPinned,
  moveTabToSpace,
  createSpace,
  removeSpace,
  closeTab,
  activateTab,
  reloadTab,
  broadcastSpacesSnapshot,
  createPinnedFolder,
  createPinnedTab,
  movePinnedItem,
  removePinnedItem,
  updatePinnedItem,
  exportSpaceBookmarks,
  importSpaceBookmarks,
  getFavorites,
  addToFavorites,
  removeFromFavorites,
  toggleFavorite,
  reorderFavorites,
});

chrome.runtime.onInstalled.addListener(async () => {
  await initializeUiMode();
  await initializeAutoArchive();
});

chrome.tabs.onZoomChange.addListener(async (info) => {
  const { newZoomFactor, tabId } = info;
  chrome.tabs.sendMessage(tabId, { command: 'zoomChanged', zoomFactor: newZoomFactor }, () => {
    if (chrome.runtime.lastError) {
      // Ignore errors if content script is not ready
    }
  });
});

chrome.runtime.onStartup?.addListener(async () => {
  await initializeUiMode();
  await initializeAutoArchive();
});

initializeGestureDetection();

subscribeToSwipe(async ({ direction }) => {
  try {
    const navigated = await navigateSpace(direction);
    if (!navigated) {
      return;
    }

    await broadcastSpacesSnapshot();
  } catch (error) {
    console.error('[Arcline] Swipe navigation failed', error);
  }
});

async function resolveHostTabId(tabId?: number): Promise<number | undefined> {
  if (typeof tabId === 'number') {
    return tabId;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab?.id;
}

async function openFloatingUi(tabId?: number, instant = false): Promise<void> {
  const targetTabId = await resolveHostTabId(tabId);
  if (typeof targetTabId !== 'number') {
    return;
  }

  const command = instant ? 'openFloatingUiInstantly' : 'openFloatingUi';
  try {
    chrome.tabs.sendMessage(targetTabId, { command }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[Arcline] Floating message failed', chrome.runtime.lastError.message);
      }
    });
  } catch (error) {
    console.warn('[Arcline] Failed to request floating UI open', error);
  }
}

async function openSidePanel(tabId?: number): Promise<void> {
  if (isSidePanelSupported()) {
    try {
      await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      return;
    } catch (error) {
      console.warn(
        '[Arcline] Side panel open failed; falling back to sidebar content script',
        error
      );
    }
  }

  const targetTabId = await resolveHostTabId(tabId);
  if (typeof targetTabId !== 'number') {
    return;
  }

  const success = await sendSidebarCommand(targetTabId, 'showSidebar');
  if (!success) {
    console.warn('[Arcline] Failed to show sidebar via content script');
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  const mode = currentUiMode ?? 'floating';
  if (mode === 'side-panel' || mode === 'popup') {
    await openSidePanel(tab.id);
    return;
  }

  await openFloatingUi(tab.id);
});

const handleQuickPinToggle = async () => {
  await chrome.runtime.sendMessage({ command: 'quickPinToggle' });
};

const sendSidebarCommand = async (
  tabId: number,
  command: 'toggleSidebar' | 'showSidebar' | 'hideSidebar'
): Promise<boolean> => {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { command }, () => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(true);
    });
  });
};

const trySendSidebarToggle = async (tabId: number) => sendSidebarCommand(tabId, 'toggleSidebar');

const handleToggleSidePanel = async () => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) {
    return;
  }

  const mode = currentUiMode ?? 'floating';
  if (mode === 'side-panel') {
    const toggled = await trySendSidebarToggle(activeTab.id);
    if (toggled) {
      return;
    }
  }

  if (mode === 'floating') {
    await openFloatingUi(activeTab.id, true);
    return;
  }

  await openSidePanel(activeTab.id);
};

const handleToggleCommandPalette = async () => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) return;
  chrome.tabs.sendMessage(activeTab.id, { command: 'openCommandPalette' }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[Arcline] Failed to toggle command palette', chrome.runtime.lastError.message);
    }
  });
};

chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case 'quickPinToggle':
      await handleQuickPinToggle();
      break;
    case 'toggleSidePanel':
      await handleToggleSidePanel();
      break;
    case 'toggleCommandPalette':
      await handleToggleCommandPalette();
      break;
    default:
      break;
  }
});

chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
  if (typeof rawMessage !== 'object' || rawMessage === null) {
    return false;
  }

  const message = rawMessage as Record<string, unknown>;

  // Handle Bridge messages (method, params, id)
  if ('method' in message && 'id' in message) {
    const { method, params, id } = message as {
      method: string;
      params?: Record<string, unknown>;
      id: string;
    };

    // Find corresponding command handler
    const handler = commandHandlers[method];
    if (!handler) {
      console.error('[SW] Unknown method:', method);
      sendResponse({ id, error: `Unknown method: ${method}` });
      return false;
    }

    // Call handler with bridge-style response
    const bridgeHandler: CommandHandler = (msg, respond, s) => {
      const wrappedRespond = (response?: unknown) => {
        if (typeof response === 'object' && response !== null && 'ok' in response) {
          const result = response as { ok?: boolean; error?: string; data?: unknown };
          if (result.ok === false) {
            respond({ id, error: result.error });
          } else {
            respond({ id, data: result.data });
          }
        } else {
          respond({ id, data: response });
        }
      };
      return handler(msg ?? {}, wrappedRespond, s);
    };

    return bridgeHandler(params || {}, sendResponse, sender);
  }

  // Handle legacy command messages
  const command = message.command;
  if (typeof command !== 'string') {
    return false;
  }

  const handler = commandHandlers[command];
  if (!handler) {
    return false;
  }

  return handler(message, sendResponse, sender);
});

registerSpacesSnapshotListeners({ broadcastSpacesSnapshot });

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;

  const settingsChange = changes[SETTINGS_STORAGE_KEY];
  if (settingsChange) {
    const previous = (settingsChange.oldValue ?? {}) as Partial<Settings>;
    const next = (settingsChange.newValue ?? {}) as Partial<Settings>;

    if (previous.uiMode !== next.uiMode) {
      void refreshUiMode();
    }

    if (
      previous.autoArchiveEnabled !== next.autoArchiveEnabled ||
      previous.autoArchiveIdleMinutes !== next.autoArchiveIdleMinutes
    ) {
      void getSettings().then((settings) =>
        setupAutoArchiveAlarm(settings.autoArchiveEnabled, settings.autoArchiveIdleMinutes)
      );
    }

    return;
  }

  if ('uiMode' in changes) {
    void refreshUiMode();
  }

  if ('autoArchiveEnabled' in changes || 'autoArchiveIdleMinutes' in changes) {
    void getSettings().then((settings) =>
      setupAutoArchiveAlarm(settings.autoArchiveEnabled, settings.autoArchiveIdleMinutes)
    );
  }
});

if (import.meta.env.MODE === 'test') {
  setInterval(() => {
    chrome.runtime.getPlatformInfo(() => undefined);
  }, 20000);
}
