import type { ArchivedTab, Settings } from '@/shared/types';
/// <reference types="chrome" />
import {
  activateTab,
  archiveTab,
  broadcastSpacesSnapshot,
  closeTab,
  createSpace,
  getArchivedTabs,
  getBookmarksForSpace,
  getSettings,
  getSpacesSnapshot,
  moveTabToSpace,
  removeSpace,
  restoreArchivedTab,
  toggleTabPinned,
  updateSettings,
} from './services/browser';

type RuntimeSendResponse = (response?: unknown) => void;

type CommandHandler = (
  message: Record<string, unknown>,
  sendResponse: RuntimeSendResponse
) => boolean;

const UI_MODE_KEY = 'arclineUiMode';
type UiMode = 'side-panel' | 'popup' | 'floating';

async function broadcastUiMode(mode: UiMode) {
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
  if (mode === 'side-panel') {
    // Empty string clears the popup so onClicked still fires.
    chrome.action.setPopup({ popup: '' });
  } else {
    chrome.action.setPopup({ popup: 'index.html' });
  }

  await chrome.storage.local.set({ [UI_MODE_KEY]: mode });
  await broadcastUiMode(mode);
}

async function detectUiMode(): Promise<UiMode> {
  const hasSidePanel = typeof chrome.sidePanel !== 'undefined';
  const isAtlas = /\bAtlas\b/i.test(navigator.userAgent);

  // Test side panel capabilities
  if (hasSidePanel) {
    try {
      // Try to get current panel options
      await chrome.sidePanel.getOptions({});
    } catch (error) {
      console.warn('[Arcline] Failed to get side panel options:', error);
    }

    try {
      // Try to get panel state for current window
      const windows = await chrome.windows.getAll();

      if (windows.length > 0) {
        try {
          await chrome.sidePanel.getOptions({ tabId: undefined });
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
    } catch (error) {
      console.warn('[Arcline] ✗ setPanelBehavior failed:', error);
    }
  }
  if (hasSidePanel && isAtlas) {
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
  } else if (mode === 'popup') {
  } else {
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await initializeUiMode();
});

chrome.runtime.onStartup?.addListener(async () => {
  await initializeUiMode();
});

// Handle action clicks manually as a fallback
chrome.action.onClicked.addListener(async () => {
  const hasSidePanel = typeof chrome.sidePanel !== 'undefined';

  if (hasSidePanel) {
    try {
      const windows = await chrome.windows.getCurrent();
      const windowId = windows?.id;
      if (typeof windowId === 'number') {
        await chrome.sidePanel.open({ windowId });
      }
      await applyUiMode('side-panel');
    } catch (error) {
      console.error('[Arcline] ✗ Failed to open side panel:', error);
      console.error('[Arcline] Error details:', {
        message: (error as Error).message,
        name: (error as Error).name,
        stack: (error as Error).stack,
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
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quickPinToggle') {
    await chrome.runtime.sendMessage({ command: 'quickPinToggle' });
  } else if (command === 'toggleSidePanel') {
    // Toggle sidebar in content script
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      try {
        await chrome.tabs.sendMessage(tabs[0].id, { command: 'toggleSidebar' });
      } catch (_error) {
        // Content script not loaded, try to open side panel instead
        try {
          await chrome.sidePanel.open({ windowId: tabs[0].windowId });
        } catch (_sidePanelError) {}
      }
    }
  }
});

const respondAsync = (handler: () => Promise<void>): boolean => {
  void handler();
  return true;
};

const commandHandlers: Record<string, CommandHandler> = {
  requestUiMode: (_message, sendResponse) =>
    respondAsync(async () => {
      try {
        const result = await chrome.storage.local.get(UI_MODE_KEY);
        const fallbackMode = await detectUiMode();
        sendResponse({
          command: 'currentUiMode',
          mode: (result[UI_MODE_KEY] as UiMode) ?? fallbackMode,
        });
      } catch (error) {
        console.error('Failed to respond with UI mode', error);
        sendResponse({ command: 'currentUiMode', mode: 'side-panel' as UiMode });
      }
    }),
  requestSpacesSnapshot: (_message, sendResponse) =>
    respondAsync(async () => {
      try {
        const spaces = await getSpacesSnapshot();
        sendResponse({ command: 'spacesSnapshot', spaces });
      } catch (error) {
        console.error('Failed to respond with spaces snapshot', error);
        sendResponse({ command: 'spacesSnapshot', spaces: [] });
      }
    }),
  toggleTabPinned: (message, sendResponse) => {
    const { tabId, pinned } = message as { tabId?: number; pinned?: boolean };
    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, error: 'tabId is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        const nextPinned = await toggleTabPinned(tabId, pinned);
        await broadcastSpacesSnapshot();
        sendResponse({ ok: true, pinned: nextPinned });
      } catch (error) {
        console.error('Failed to toggle pin state', error);
        sendResponse({ ok: false, error: (error as Error).message });
      }
    });
  },
  moveTabToSpace: (message, sendResponse) => {
    const { tabId, spaceId } = message as { tabId?: number; spaceId?: number };
    if (typeof tabId !== 'number' || typeof spaceId !== 'number') {
      sendResponse({ ok: false, error: 'tabId and spaceId are required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        const groupId = await moveTabToSpace(tabId, spaceId);
        await broadcastSpacesSnapshot();
        sendResponse({ ok: true, groupId });
      } catch (error) {
        console.error('Failed to move tab to space', error);
        sendResponse({ ok: false, error: (error as Error).message });
      }
    });
  },
  createSpace: (message, sendResponse) => {
    const { name, color } = message as {
      name?: string;
      color?: chrome.tabGroups.ColorEnum;
    };
    if (!name) {
      sendResponse({ ok: false, error: 'name is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        const groupId = await createSpace(name, color);
        await broadcastSpacesSnapshot();
        sendResponse({ ok: true, groupId });
      } catch (error) {
        console.error('Failed to create space', error);
        sendResponse({ ok: false, error: (error as Error).message });
      }
    });
  },
  removeSpace: (message, sendResponse) => {
    const { spaceId } = message as { spaceId?: number };
    if (typeof spaceId !== 'number') {
      sendResponse({ ok: false, error: 'spaceId is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        await removeSpace(spaceId);
        await broadcastSpacesSnapshot();
        sendResponse({ ok: true });
      } catch (error) {
        console.error('Failed to remove space', error);
        sendResponse({ ok: false, error: (error as Error).message });
      }
    });
  },
  closeTab: (message, sendResponse) => {
    const { tabId } = message as { tabId?: number };
    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, error: 'tabId is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        await closeTab(tabId);
        await broadcastSpacesSnapshot();
        sendResponse({ ok: true });
      } catch (error) {
        console.error('Failed to close tab', error);
        sendResponse({ ok: false, error: (error as Error).message });
      }
    });
  },
  activateTab: (message, sendResponse) => {
    const { tabId } = message as { tabId?: number };
    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, error: 'tabId is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        await activateTab(tabId);
        sendResponse({ ok: true });
      } catch (error) {
        console.error('Failed to activate tab', error);
        sendResponse({ ok: false, error: (error as Error).message });
      }
    });
  },
  getSpacesSnapshot: (message, sendResponse) =>
    respondAsync(async () => {
      try {
        const spaces = await getSpacesSnapshot();
        sendResponse({ id: message.id, data: spaces });
      } catch (error) {
        sendResponse({ id: message.id, error: (error as Error).message });
      }
    }),
  getSettings: (message, sendResponse) =>
    respondAsync(async () => {
      try {
        const settings = await getSettings();
        sendResponse({ id: message.id, data: settings });
      } catch (error) {
        sendResponse({ id: message.id, error: (error as Error).message });
      }
    }),
  getArchivedTabs: (message, sendResponse) =>
    respondAsync(async () => {
      try {
        const archivedTabs = await getArchivedTabs();
        sendResponse({ id: message.id, data: archivedTabs });
      } catch (error) {
        sendResponse({ id: message.id, error: (error as Error).message });
      }
    }),
  getBookmarksForSpace: (message, sendResponse) => {
    const { spaceId } = message as { spaceId?: number };
    if (typeof spaceId !== 'number') {
      sendResponse({ id: message.id, error: 'spaceId is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        const bookmarks = await getBookmarksForSpace(spaceId);
        sendResponse({ id: message.id, data: bookmarks });
      } catch (error) {
        sendResponse({ id: message.id, error: (error as Error).message });
      }
    });
  },
  archiveTab: (message, sendResponse) => {
    const { tabId } = message as { tabId?: number };
    if (typeof tabId !== 'number') {
      sendResponse({ id: message.id, error: 'tabId is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        await archiveTab(tabId);
        await broadcastSpacesSnapshot();
        sendResponse({ id: message.id, data: null });
      } catch (error) {
        sendResponse({ id: message.id, error: (error as Error).message });
      }
    });
  },
  restoreArchivedTab: (message, sendResponse) => {
    const { archivedTab } = message as { archivedTab?: ArchivedTab };
    if (!archivedTab) {
      sendResponse({ id: message.id, error: 'archivedTab is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        await restoreArchivedTab(archivedTab);
        await broadcastSpacesSnapshot();
        sendResponse({ id: message.id, data: null });
      } catch (error) {
        sendResponse({ id: message.id, error: (error as Error).message });
      }
    });
  },
  updateSettings: (message, sendResponse) => {
    const { settings } = message as { settings?: Partial<Settings> };
    if (!settings) {
      sendResponse({ id: message.id, error: 'settings object is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        await updateSettings(settings);
        sendResponse({ id: message.id, data: null });
      } catch (error) {
        sendResponse({ id: message.id, error: (error as Error).message });
      }
    });
  },
};

chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
  if (typeof rawMessage !== 'object' || rawMessage === null) {
    return false;
  }

  const message = rawMessage as Record<string, unknown>;
  const command = message.command;

  if (typeof command !== 'string') {
    return false;
  }

  const handler = commandHandlers[command];
  if (!handler) {
    return false;
  }

  return handler(message, sendResponse);
});

const tabEventHandlers: Array<
  [chrome.events.Event<(...args: unknown[]) => void> | undefined, () => void]
> = [
  [chrome.tabs.onCreated, () => void broadcastSpacesSnapshot()],
  [chrome.tabs.onUpdated, () => void broadcastSpacesSnapshot()],
  [chrome.tabs.onMoved, () => void broadcastSpacesSnapshot()],
  [chrome.tabs.onDetached, () => void broadcastSpacesSnapshot()],
  [chrome.tabs.onAttached, () => void broadcastSpacesSnapshot()],
  [chrome.tabs.onRemoved, () => void broadcastSpacesSnapshot()],
  [chrome.tabs.onActivated, () => void broadcastSpacesSnapshot()],
  [chrome.windows.onFocusChanged, () => void broadcastSpacesSnapshot()],
];

for (const [event, handler] of tabEventHandlers) {
  event?.addListener(handler);
}

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
