/// <reference types="chrome" />
import type { UiMode } from '@/lib/ui-mode';
import type { ArchivedTab, Settings, SpaceCreateRequest } from '@/shared/types';
import { initializeAutoArchive } from './services/auto-archive';
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
import { initializeGestureDetection, subscribeToSwipe } from './services/gestures';
import { navigateSpace } from './services/space-navigation';

type RuntimeSendResponse = (response?: unknown) => void;

type CommandHandler = (
  message: Record<string, unknown>,
  sendResponse: RuntimeSendResponse
) => boolean;

const UI_MODE_KEY = 'arclineoMode';

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
  await initializeAutoArchive();
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

export const commandHandlers: Record<string, CommandHandler> = {
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
        sendResponse({ ok: true, data: groupId });
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
  getSpacesSnapshot: (_message, sendResponse) =>
    respondAsync(async () => {
      try {
        const spaces = await getSpacesSnapshot();
        sendResponse(spaces);
      } catch (error) {
        sendResponse({ ok: false, error: (error as Error).message });
      }
    }),
  getSettings: (_message, sendResponse) =>
    respondAsync(async () => {
      try {
        const settings = await getSettings();
        sendResponse(settings);
      } catch (error) {
        sendResponse({ ok: false, error: (error as Error).message });
      }
    }),
  getArchivedTabs: (_message, sendResponse) =>
    respondAsync(async () => {
      try {
        const archivedTabs = await getArchivedTabs();
        sendResponse(archivedTabs);
      } catch (error) {
        sendResponse({ ok: false, error: (error as Error).message });
      }
    }),
  getBookmarksForSpace: (message, sendResponse) => {
    const { spaceId, spaceName } = message as { spaceId?: number; spaceName?: string };

    return respondAsync(async () => {
      try {
        let resolvedName = spaceName;

        if (!resolvedName) {
          if (typeof spaceId !== 'number') {
            sendResponse({ ok: false, error: 'spaceId or spaceName is required' });
            return;
          }

          const spaces = await getSpacesSnapshot();
          const targetSpace = spaces.find((space) => space.id === spaceId);
          if (!targetSpace) {
            sendResponse({ ok: false, error: `Space with id ${spaceId} not found` });
            return;
          }

          resolvedName = targetSpace.name;
        }

        const bookmarks = await getBookmarksForSpace(resolvedName);
        sendResponse(bookmarks);
      } catch (error) {
        sendResponse({ ok: false, error: (error as Error).message });
      }
    });
  },
  archiveTab: (message, sendResponse) => {
    const { tabId } = message as { tabId?: number };
    if (typeof tabId !== 'number') {
      sendResponse({ ok: false, error: 'tabId is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        await archiveTab(tabId);
        await broadcastSpacesSnapshot();
        sendResponse(null);
      } catch (error) {
        sendResponse({ ok: false, error: (error as Error).message });
      }
    });
  },
  restoreArchivedTab: (message, sendResponse) => {
    const { archivedTab } = message as { archivedTab?: ArchivedTab };
    if (!archivedTab) {
      sendResponse({ ok: false, error: 'archivedTab is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        await restoreArchivedTab(archivedTab);
        await broadcastSpacesSnapshot();
        sendResponse(null);
      } catch (error) {
        sendResponse({ ok: false, error: (error as Error).message });
      }
    });
  },
  updateSettings: (message, sendResponse) => {
    const { settings } = message as { settings?: Partial<Settings> };
    if (!settings) {
      sendResponse({ ok: false, error: 'settings object is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        await updateSettings(settings);
        sendResponse(null);
      } catch (error) {
        sendResponse({ ok: false, error: (error as Error).message });
      }
    });
  },
};

chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
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
    const bridgeHandler: CommandHandler = (msg, respond) => {
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
      return handler(msg ?? {}, wrappedRespond);
    };

    return bridgeHandler(params || {}, sendResponse);
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

  return handler(message, sendResponse);
});

chrome.tabs.onCreated?.addListener(() => {
  void broadcastSpacesSnapshot();
});

chrome.tabs.onUpdated?.addListener(() => {
  void broadcastSpacesSnapshot();
});

chrome.tabs.onMoved?.addListener(() => {
  void broadcastSpacesSnapshot();
});

chrome.tabs.onDetached?.addListener(() => {
  void broadcastSpacesSnapshot();
});

chrome.tabs.onAttached?.addListener(() => {
  void broadcastSpacesSnapshot();
});

chrome.tabs.onRemoved?.addListener(() => {
  void broadcastSpacesSnapshot();
});

chrome.tabs.onActivated?.addListener(() => {
  void broadcastSpacesSnapshot();
});

chrome.windows.onFocusChanged?.addListener(() => {
  void broadcastSpacesSnapshot();
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

if (import.meta.env.MODE === 'test') {
  setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {});
  }, 20000);
}
