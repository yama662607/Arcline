/// <reference types="chrome" />
import type { UiMode } from '@/lib/ui-mode';
import type { ArchivedTab, Settings, SpaceCreateRequest, TabEntry } from '@/shared/types';
import { initializeAutoArchive } from './services/auto-archive';
import {
  activateTab,
  archiveTab,
  broadcastSpacesSnapshot,
  closeTab,
  createSpace,
  getActiveTabEntry,
  getArchivedTabs,
  getBookmarksForSpace,
  getSettings,
  getSpacesSnapshot,
  moveTabToSpace,
  reloadTab,
  removeSpace,
  restoreArchivedTab,
  toggleTabPinned,
  updateSettings,
} from './services/browser';
import {
  addToFavorites,
  type FavoriteTab,
  getFavorites,
  removeFromFavorites,
  reorderFavorites,
  toggleFavorite,
} from './services/favorites';
import { initializeGestureDetection, subscribeToSwipe } from './services/gestures';
import { navigateSpace } from './services/space-navigation';

type RuntimeSendResponse = (response?: unknown) => void;

type CommandHandler = (
  message: Record<string, unknown>,
  sendResponse: RuntimeSendResponse
) => boolean;

function isTabEntry(value: unknown): value is TabEntry {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<TabEntry>;

  return (
    typeof candidate.id === 'number' &&
    typeof candidate.url === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.windowId === 'number' &&
    typeof candidate.groupId === 'number' &&
    typeof candidate.pinned === 'boolean' &&
    typeof candidate.active === 'boolean'
  );
}

function isFavoriteTabArray(value: unknown): value is FavoriteTab[] {
  return (
    Array.isArray(value) &&
    value.every(
      (fav) =>
        fav &&
        typeof fav === 'object' &&
        typeof fav.url === 'string' &&
        typeof fav.title === 'string' &&
        typeof (fav as FavoriteTab).addedAt === 'number'
    )
  );
}

const UI_MODE_KEY = 'arclineoMode';

let currentUiMode: UiMode | null = null;

function isSidePanelSupported(): boolean {
  return typeof chrome.sidePanel !== 'undefined' && typeof chrome.sidePanel.open === 'function';
}

function _getPreferredUiMode(settings: Settings): UiMode {
  return (settings.uiMode as UiMode | undefined) ?? 'floating';
}

async function resolveUiMode(): Promise<UiMode> {
  // Temporarily force floating mode for testing
  console.log('[Arcline] Force floating mode for testing');
  return 'floating';

  // const settings = await getSettings();
  // const preference = getPreferredUiMode(settings);
  // if (preference === 'side-panel') {
  //   if (!isSidePanelSupported()) {
  //     console.warn(
  //       '[Arcline] Side Panel preference requested but chrome.sidePanel is unavailable; falling back to floating UI'
  //     );
  //     return 'floating';
  //   }
  //   return 'side-panel';
  // }
  // if (preference === 'popup') {
  //   return 'popup';
  // }
  // return preference;
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
  chrome.action.setPopup({ popup: '' });

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
  await refreshUiMode();
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
        const storedMode = (result[UI_MODE_KEY] as UiMode) ?? fallbackMode;
        const modeToSend = currentUiMode ?? storedMode;
        sendResponse({
          command: 'currentUiMode',
          mode: modeToSend,
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
  getActiveTab: (_message, sendResponse) =>
    respondAsync(async () => {
      try {
        const tab = await getActiveTabEntry();
        sendResponse({ ok: true, data: tab });
      } catch (error) {
        console.error('Failed to fetch active tab', error);
        sendResponse({ ok: false, error: (error as Error).message });
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
    const isAtlas = /\bAtlas\b/i.test(navigator.userAgent);

    console.log('[Arcline] 🎯 activateTab handler called:', {
      tabId,
      isAtlas,
      userAgent: navigator.userAgent,
      message,
      timestamp: new Date().toISOString(),
    });

    if (typeof tabId !== 'number') {
      console.error('[Arcline] ❌ Invalid tabId:', tabId);
      sendResponse({ ok: false, error: 'tabId is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        console.log('[Arcline] 🔄 Calling activateTab function...');
        await activateTab(tabId);
        console.log('[Arcline] ✅ activateTab completed successfully');
        sendResponse({ ok: true });
      } catch (error) {
        console.error('[Arcline] ❌ activateTab handler failed:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack available',
          tabId,
          isAtlas,
        });
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    });
  },
  reloadTab: (message, sendResponse) => {
    const { tabId } = message as { tabId?: number };

    return respondAsync(async () => {
      try {
        await reloadTab(tabId);
        sendResponse({ ok: true });
      } catch (error) {
        console.error('Failed to reload tab', error);
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
  // Favorites management
  getFavorites: (_message, sendResponse) =>
    respondAsync(async () => {
      try {
        const favorites = await getFavorites();
        sendResponse(favorites);
      } catch (error) {
        sendResponse({ ok: false, error: (error as Error).message });
      }
    }),
  addToFavorites: (message, sendResponse) => {
    const { tab } = message as { tab?: unknown };
    if (!isTabEntry(tab)) {
      sendResponse({ ok: false, error: 'tab is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        await addToFavorites(tab);
        sendResponse(null);
      } catch (error) {
        sendResponse({ ok: false, error: (error as Error).message });
      }
    });
  },
  removeFromFavorites: (message, sendResponse) => {
    const { url } = message as { url?: string };
    if (!url) {
      sendResponse({ ok: false, error: 'url is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        await removeFromFavorites(url);
        sendResponse(null);
      } catch (error) {
        sendResponse({ ok: false, error: (error as Error).message });
      }
    });
  },
  toggleFavorite: (message, sendResponse) => {
    const { tab } = message as { tab?: unknown };
    if (!isTabEntry(tab)) {
      sendResponse({ ok: false, error: 'tab is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        const isFavorite = await toggleFavorite(tab);
        sendResponse(isFavorite);
      } catch (error) {
        sendResponse({ ok: false, error: (error as Error).message });
      }
    });
  },
  reorderFavorites: (message, sendResponse) => {
    const { favorites } = message as { favorites?: unknown };

    if (!isFavoriteTabArray(favorites)) {
      sendResponse({ ok: false, error: 'favorites array is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        await reorderFavorites(favorites);
        sendResponse(null);
      } catch (error) {
        sendResponse({ error: error instanceof Error ? error.message : String(error) });
      }
    });
  },
  openUrlInTab: (message, sendResponse) => {
    const { url } = message as { url?: string };

    if (!url) {
      sendResponse({ error: 'URL is required' });
      return false;
    }

    return respondAsync(async () => {
      try {
        // Check if tab with URL already exists
        const tabs = await chrome.tabs.query({ url });
        if (tabs.length > 0 && tabs[0]?.id) {
          // Tab exists, activate it
          await chrome.tabs.update(tabs[0].id, { active: true });
          await chrome.windows.update(tabs[0].windowId, { focused: true });
        } else {
          // Tab doesn't exist, create it
          await chrome.tabs.create({ url, active: true });
        }
        sendResponse(null);
      } catch (error) {
        sendResponse({ error: error instanceof Error ? error.message : String(error) });
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

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && 'uiMode' in changes) {
    void refreshUiMode();
  }
});

if (import.meta.env.MODE === 'test') {
  setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {});
  }, 20000);
}
