import type { UiMode } from '@/lib/ui-mode';
import type { ArchivedTab, Settings, SpaceCreateRequest } from '@/shared/types';
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

const UI_MODE_KEY = 'arclineoMode';

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
  const isAtlas = /\bAtlas\b/i.test(navigator.userAgent);
  if (isAtlas) {
    console.info('[Arcline] Atlas browser detected: forcing floating mode');
  }
  return 'floating';
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

// Handle action clicks manually (always floating for now)
chrome.action.onClicked.addListener(async (tab) => {
  const tabId = tab.id;

  const showFloatingUi = async () => {
    await applyUiMode('floating');
    if (typeof tabId === 'number') {
      try {
        chrome.tabs.sendMessage(tabId, { command: 'openFloatingUi' }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[Arcline] Floating message failed, ensure content script is ready');
          }
        });
      } catch (error) {
        console.warn('[Arcline] Failed to request floating UI open', error);
      }
    }
  };

  await showFloatingUi();
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

  const toggled = await trySendSidebarToggle(activeTab.id);
  if (toggled) {
    return;
  }
};

chrome.commands.onCommand.addListener(async (command) => {
  switch (command) {
    case 'quickPinToggle':
      await handleQuickPinToggle();
      break;
    case 'toggleSidePanel':
      await handleToggleSidePanel();
      break;
    default:
      break;
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
        sendResponse({ command: 'currentUiMode', mode: 'floating' as UiMode });
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
    const { name, color } = message as unknown as SpaceCreateRequest;
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
