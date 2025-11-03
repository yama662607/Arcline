/// <reference types="chrome" />
import {
  getSpacesSnapshot,
  broadcastSpacesSnapshot,
  toggleTabPinned,
  moveTabToSpace,
  createSpace,
  removeSpace,
  closeTab,
  activateTab
} from './services/browser';

const UI_MODE_KEY = 'arclineUiMode';
type UiMode = 'side-panel' | 'popup';

async function initializeUiMode() {
  const hasSidePanel = typeof chrome.sidePanel !== 'undefined';
  const mode: UiMode = hasSidePanel ? 'side-panel' : 'popup';

  await chrome.storage.local.set({ [UI_MODE_KEY]: mode });

  if (hasSidePanel) {
    chrome.sidePanel.setPanelBehavior?.({ openPanelOnActionClick: true }).catch((error) => {
      console.warn('Failed to configure side panel behavior', error);
    });
  } else {
    // Fallback: ensure action opens the popup
    chrome.action.setPopup({ popup: 'index.html' });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await initializeUiMode();
});

chrome.runtime.onStartup?.addListener(async () => {
  await initializeUiMode();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quickPinToggle') {
    await chrome.runtime.sendMessage({ command: 'quickPinToggle' });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const { command } = message as { command?: string };

  switch (command) {
    case 'requestUiMode': {
      (async () => {
        try {
          const result = await chrome.storage.local.get(UI_MODE_KEY);
          sendResponse({ command: 'currentUiMode', mode: (result[UI_MODE_KEY] as UiMode) ?? 'side-panel' });
        } catch (error) {
          console.error('Failed to respond with UI mode', error);
          sendResponse({ command: 'currentUiMode', mode: 'side-panel' as UiMode });
        }
      })();
      return true;
    }
    case 'requestSpacesSnapshot': {
      (async () => {
        const spaces = await getSpacesSnapshot();
        sendResponse({ command: 'spacesSnapshot', spaces });
      })().catch((error) => {
        console.error('Failed to respond with spaces snapshot', error);
        sendResponse({ command: 'spacesSnapshot', spaces: [] });
      });
      return true;
    }
    case 'toggleTabPinned': {
      const { tabId, pinned } = message as { tabId?: number; pinned?: boolean };
      if (typeof tabId !== 'number') {
        sendResponse({ ok: false, error: 'tabId is required' });
        return false;
      }

      (async () => {
        try {
          const nextPinned = await toggleTabPinned(tabId, pinned);
          await broadcastSpacesSnapshot();
          sendResponse({ ok: true, pinned: nextPinned });
        } catch (error) {
          console.error('Failed to toggle pin state', error);
          sendResponse({ ok: false, error: (error as Error).message });
        }
      })();
      return true;
    }
    case 'moveTabToSpace': {
      const { tabId, spaceId } = message as { tabId?: number; spaceId?: number };
      if (typeof tabId !== 'number' || typeof spaceId !== 'number') {
        sendResponse({ ok: false, error: 'tabId and spaceId are required' });
        return false;
      }

      (async () => {
        try {
          const groupId = await moveTabToSpace(tabId, spaceId);
          await broadcastSpacesSnapshot();
          sendResponse({ ok: true, groupId });
        } catch (error) {
          console.error('Failed to move tab to space', error);
          sendResponse({ ok: false, error: (error as Error).message });
        }
      })();
      return true;
    }
    case 'createSpace': {
      const { name, color } = message as { name?: string; color?: chrome.tabGroups.ColorEnum };
      if (!name) {
        sendResponse({ ok: false, error: 'name is required' });
        return false;
      }

      (async () => {
        try {
          const groupId = await createSpace(name, color);
          await broadcastSpacesSnapshot();
          sendResponse({ ok: true, groupId });
        } catch (error) {
          console.error('Failed to create space', error);
          sendResponse({ ok: false, error: (error as Error).message });
        }
      })();
      return true;
    }
    case 'removeSpace': {
      const { spaceId } = message as { spaceId?: number };
      if (typeof spaceId !== 'number') {
        sendResponse({ ok: false, error: 'spaceId is required' });
        return false;
      }

      (async () => {
        try {
          await removeSpace(spaceId);
          await broadcastSpacesSnapshot();
          sendResponse({ ok: true });
        } catch (error) {
          console.error('Failed to remove space', error);
          sendResponse({ ok: false, error: (error as Error).message });
        }
      })();
      return true;
    }
    case 'closeTab': {
      const { tabId } = message as { tabId?: number };
      if (typeof tabId !== 'number') {
        sendResponse({ ok: false, error: 'tabId is required' });
        return false;
      }

      (async () => {
        try {
          await closeTab(tabId);
          await broadcastSpacesSnapshot();
          sendResponse({ ok: true });
        } catch (error) {
          console.error('Failed to close tab', error);
          sendResponse({ ok: false, error: (error as Error).message });
        }
      })();
      return true;
    }
    case 'activateTab': {
      const { tabId } = message as { tabId?: number };
      if (typeof tabId !== 'number') {
        sendResponse({ ok: false, error: 'tabId is required' });
        return false;
      }

      (async () => {
        try {
          await activateTab(tabId);
          sendResponse({ ok: true });
        } catch (error) {
          console.error('Failed to activate tab', error);
          sendResponse({ ok: false, error: (error as Error).message });
        }
      })();
      return true;
    }
    default:
      return false;
  }
});

const tabEventHandlers: Array<[chrome.events.Event<(...args: any[]) => void> | undefined, () => void]> = [
  [chrome.tabs.onCreated, () => void broadcastSpacesSnapshot()],
  [chrome.tabs.onUpdated, () => void broadcastSpacesSnapshot()],
  [chrome.tabs.onMoved, () => void broadcastSpacesSnapshot()],
  [chrome.tabs.onDetached, () => void broadcastSpacesSnapshot()],
  [chrome.tabs.onAttached, () => void broadcastSpacesSnapshot()],
  [chrome.tabs.onRemoved, () => void broadcastSpacesSnapshot()],
  [chrome.tabs.onActivated, () => void broadcastSpacesSnapshot()],
  [chrome.windows.onFocusChanged, () => void broadcastSpacesSnapshot()]
];

tabEventHandlers.forEach(([event, handler]) => {
  event?.addListener(handler);
});

if (typeof chrome.tabGroups !== 'undefined') {
  chrome.tabGroups.onCreated?.addListener(() => {
    void broadcastSpacesSnapshot();
  });
  chrome.tabGroups.onUpdated?.addListener(() => {
    void broadcastSpacesSnapshot();
  });
  chrome.tabGroups.onRemoved?.addListener(() => {
    void broadcastSpacesSnapshot();
  });
}
