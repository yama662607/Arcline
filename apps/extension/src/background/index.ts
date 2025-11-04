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
type UiMode = 'side-panel' | 'popup' | 'floating';

async function broadcastUiMode(mode: UiMode) {
  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(
      tabs.map((tab) => {
        if (!tab.id) return Promise.resolve();
        return new Promise<void>((resolve) => {
          chrome.tabs.sendMessage(tab.id!, { command: 'currentUiMode', mode }, () => {
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
  if (mode === 'side-panel') {
    // Empty string clears the popup so onClicked still fires.
    chrome.action.setPopup({ popup: '' });
  } else {
    chrome.action.setPopup({ popup: 'index.html' });
  }

  await chrome.storage.local.set({ [UI_MODE_KEY]: mode });
  console.log('[Arcline] UI mode applied:', mode);
  await broadcastUiMode(mode);
}

async function detectUiMode(): Promise<UiMode> {
  const hasSidePanel = typeof chrome.sidePanel !== 'undefined';
  const isAtlas = /\bAtlas\b/i.test(navigator.userAgent);

  console.log('[Arcline] ========== Side Panel Detection ==========');
  console.log('[Arcline] chrome.sidePanel available:', hasSidePanel);
  console.log('[Arcline] User agent:', navigator.userAgent);

  // Test side panel capabilities
  if (hasSidePanel) {
    console.log('[Arcline] Available side panel methods:', Object.keys(chrome.sidePanel));

    try {
      // Try to get current panel options
      const options = await chrome.sidePanel.getOptions({});
      console.log('[Arcline] Current side panel options:', options);
    } catch (error) {
      console.warn('[Arcline] Failed to get side panel options:', error);
    }

    try {
      // Try to get panel state for current window
      const windows = await chrome.windows.getAll();
      console.log('[Arcline] Number of windows:', windows.length);

      if (windows.length > 0) {
        const currentWindow = windows[0];
        console.log('[Arcline] Current window ID:', currentWindow.id);

        try {
          const panelOptions = await chrome.sidePanel.getOptions({ tabId: undefined });
          console.log('[Arcline] Panel options for current context:', panelOptions);
        } catch (err) {
          console.warn('[Arcline] Could not get panel options:', err);
        }
      }
    } catch (error) {
      console.warn('[Arcline] Failed to query windows:', error);
    }

    // Try to set panel behavior and see what happens
    try {
      // DON'T use openPanelOnActionClick for Atlas compatibility
      // await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
      console.log('[Arcline] ✓ setPanelBehavior succeeded (openPanelOnActionClick: false)');
    } catch (error) {
      console.warn('[Arcline] ✗ setPanelBehavior failed:', error);
    }
  }


  console.log('[Arcline] =======================================');
  if (hasSidePanel && isAtlas) {
    console.log('[Arcline] Atlas detected, scheduling floating mode');
    return 'floating';
  }

  if (hasSidePanel) {
    return 'side-panel';
  }

  return 'popup';
}

async function initializeUiMode() {
  const mode = await detectUiMode();
  await applyUiMode(mode);

  if (mode === 'side-panel') {
    console.log('[Arcline] Using side panel mode by default (sidePanel detected)');
  } else if (mode === 'popup') {
    console.log('[Arcline] Using popup mode (no sidePanel API)');
  } else {
    console.log('[Arcline] Using floating mode (Atlas fallback)');
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Arcline] Extension installed/updated');
  await initializeUiMode();
});

chrome.runtime.onStartup?.addListener(async () => {
  console.log('[Arcline] Browser startup');
  await initializeUiMode();
});

// Handle action clicks manually as a fallback
chrome.action.onClicked.addListener(async () => {
  console.log('[Arcline] ========== Action Clicked ==========');
  const hasSidePanel = typeof chrome.sidePanel !== 'undefined';
  console.log('[Arcline] Side panel API available:', hasSidePanel);

  if (hasSidePanel) {
    try {
      console.log('[Arcline] Attempting to open side panel...');
      const windows = await chrome.windows.getCurrent();
      console.log('[Arcline] Current window ID:', windows.id);

      await chrome.sidePanel.open({ windowId: windows.id });
      console.log('[Arcline] ✓ Side panel opened successfully');
      await applyUiMode('side-panel');
    } catch (error) {
      console.error('[Arcline] ✗ Failed to open side panel:', error);
      console.error('[Arcline] Error details:', {
        message: (error as Error).message,
        name: (error as Error).name,
        stack: (error as Error).stack
      });

      console.warn('[Arcline] Falling back to floating mode');
      await applyUiMode('floating');
      try {
        await chrome.action.openPopup?.();
      } catch (openPopupError) {
        console.warn('[Arcline] Failed to auto-open popup after fallback:', openPopupError);
      }
    }
  } else {
    console.log('[Arcline] Side panel API not available, popup should open instead');
  }
  console.log('[Arcline] =====================================');
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
          const fallbackMode = await detectUiMode();
          sendResponse({ command: 'currentUiMode', mode: (result[UI_MODE_KEY] as UiMode) ?? fallbackMode });
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
