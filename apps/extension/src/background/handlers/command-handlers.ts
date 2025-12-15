import type { UiMode } from '@/lib/ui-mode';
import type { ArchivedTab, Settings, SpaceCreateRequest, TabEntry } from '@/shared/types';

type RuntimeSendResponse = (response?: unknown) => void;

export type CommandHandler = (
  message: Record<string, unknown>,
  sendResponse: RuntimeSendResponse,
  sender?: unknown
) => boolean;

type BrowserFns = typeof import('../services/browser');
type FavoritesFns = typeof import('../services/favorites');

export type CommandHandlersDeps = {
  uiModeKey: string;
  detectUiMode: () => Promise<UiMode>;
  getCurrentUiMode: () => UiMode | null;
  getActiveTabEntry: BrowserFns['getActiveTabEntry'];
  getSpacesSnapshot: BrowserFns['getSpacesSnapshot'];
  getSettings: BrowserFns['getSettings'];
  getArchivedTabs: BrowserFns['getArchivedTabs'];
  getBookmarksForSpace: BrowserFns['getBookmarksForSpace'];
  archiveTab: BrowserFns['archiveTab'];
  restoreArchivedTab: BrowserFns['restoreArchivedTab'];
  updateSettings: BrowserFns['updateSettings'];
  searchHistory: BrowserFns['searchHistory'];
  searchBookmarks: BrowserFns['searchBookmarks'];
  toggleTabPinned: BrowserFns['toggleTabPinned'];
  moveTabToSpace: BrowserFns['moveTabToSpace'];
  createSpace: BrowserFns['createSpace'];
  removeSpace: BrowserFns['removeSpace'];
  closeTab: BrowserFns['closeTab'];
  activateTab: BrowserFns['activateTab'];
  reloadTab: BrowserFns['reloadTab'];
  broadcastSpacesSnapshot: BrowserFns['broadcastSpacesSnapshot'];
  createPinnedFolder: BrowserFns['createPinnedFolder'];
  createPinnedTab: BrowserFns['createPinnedTab'];
  movePinnedItem: BrowserFns['movePinnedItem'];
  removePinnedItem: BrowserFns['removePinnedItem'];
  updatePinnedItem: BrowserFns['updatePinnedItem'];
  exportSpaceBookmarks: BrowserFns['exportSpaceBookmarks'];
  importSpaceBookmarks: BrowserFns['importSpaceBookmarks'];
  getFavorites: FavoritesFns['getFavorites'];
  addToFavorites: FavoritesFns['addToFavorites'];
  removeFromFavorites: FavoritesFns['removeFromFavorites'];
  toggleFavorite: FavoritesFns['toggleFavorite'];
  reorderFavorites: FavoritesFns['reorderFavorites'];
};

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

type FavoriteTab = { url: string; title: string; addedAt: number };

function isFavoriteTabArray(value: unknown): value is FavoriteTab[] {
  return (
    Array.isArray(value) &&
    value.every(
      (fav) =>
        fav &&
        typeof fav === 'object' &&
        typeof (fav as FavoriteTab).url === 'string' &&
        typeof (fav as FavoriteTab).title === 'string' &&
        typeof (fav as FavoriteTab).addedAt === 'number'
    )
  );
}

const respondAsync = (handler: () => Promise<void>): boolean => {
  void handler();
  return true;
};

export function createCommandHandlers(deps: CommandHandlersDeps): Record<string, CommandHandler> {
  return {
    requestUiMode: (_message, sendResponse) =>
      respondAsync(async () => {
        try {
          const result = await chrome.storage.local.get(deps.uiModeKey);
          const fallbackMode = await deps.detectUiMode();
          const storedMode = (result[deps.uiModeKey] as UiMode) ?? fallbackMode;
          const modeToSend = deps.getCurrentUiMode() ?? storedMode;
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
          const spaces = await deps.getSpacesSnapshot();
          sendResponse({ command: 'spacesSnapshot', spaces });
        } catch (error) {
          console.error('Failed to respond with spaces snapshot', error);
          sendResponse({ command: 'spacesSnapshot', spaces: [] });
        }
      }),
    getActiveTab: (_message, sendResponse) =>
      respondAsync(async () => {
        try {
          const tab = await deps.getActiveTabEntry();
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
          const nextPinned = await deps.toggleTabPinned(tabId, pinned);
          await deps.broadcastSpacesSnapshot();
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
          const groupId = await deps.moveTabToSpace(tabId, spaceId);
          await deps.broadcastSpacesSnapshot();
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
          const groupId = await deps.createSpace(name, color);
          await deps.broadcastSpacesSnapshot();
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
          await deps.removeSpace(spaceId);
          await deps.broadcastSpacesSnapshot();
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
          await deps.closeTab(tabId);
          await deps.broadcastSpacesSnapshot();
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
          await deps.activateTab(tabId);
          console.log('[Arcline] ✅ activateTab completed successfully');
          sendResponse({ ok: true });
        } catch (error) {
          console.error('[Arcline] ❌ activateTab handler failed:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : 'No stack available',
            tabId,
            isAtlas,
          });
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
    reloadTab: (message, sendResponse) => {
      const { tabId } = message as { tabId?: number };

      return respondAsync(async () => {
        try {
          await deps.reloadTab(tabId);
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
          const spaces = await deps.getSpacesSnapshot();
          sendResponse(spaces);
        } catch (error) {
          sendResponse({ ok: false, error: (error as Error).message });
        }
      }),
    getSettings: (_message, sendResponse) =>
      respondAsync(async () => {
        try {
          const settings = await deps.getSettings();
          sendResponse(settings);
        } catch (error) {
          sendResponse({ ok: false, error: (error as Error).message });
        }
      }),
    getArchivedTabs: (_message, sendResponse) =>
      respondAsync(async () => {
        try {
          const archivedTabs = await deps.getArchivedTabs();
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

            const spaces = await deps.getSpacesSnapshot();
            const targetSpace = spaces.find((space) => space.id === spaceId);
            if (!targetSpace) {
              sendResponse({ ok: false, error: `Space with id ${spaceId} not found` });
              return;
            }

            resolvedName = targetSpace.name;
          }

          const bookmarks = await deps.getBookmarksForSpace(resolvedName);
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
          await deps.archiveTab(tabId);
          await deps.broadcastSpacesSnapshot();
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
          await deps.restoreArchivedTab(archivedTab);
          await deps.broadcastSpacesSnapshot();
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
          await deps.updateSettings(settings);
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
          const favorites = await deps.getFavorites();
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
          await deps.addToFavorites(tab);
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
          await deps.removeFromFavorites(url);
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
          const isFavorite = await deps.toggleFavorite(tab);
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
          await deps.reorderFavorites(favorites);
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
    getZoomLevel: (_message, sendResponse, sender) => {
      return respondAsync(async () => {
        const senderWithTab = sender as { tab?: { id?: number } } | undefined;
        let tabId = senderWithTab?.tab?.id;
        if (!tabId) {
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          tabId = tab?.id;
        }

        if (!tabId) {
          sendResponse({ ok: false, error: 'No active tab found' });
          return;
        }
        const zoom = await chrome.tabs.getZoom(tabId);
        sendResponse({ ok: true, zoom });
      });
    },
    createPinnedFolder: (message, sendResponse) => {
      const { spaceName, title, parentId } = message as {
        spaceName: string;
        title: string;
        parentId?: string;
      };
      if (!spaceName || !title)
        return respondAsync(async () => sendResponse({ ok: false, error: 'Missing params' }));
      return respondAsync(async () => {
        try {
          const folder = await deps.createPinnedFolder(spaceName, title, parentId);
          await deps.broadcastSpacesSnapshot();
          sendResponse({ ok: true, data: folder });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
      });
    },
    createPinnedTab: (message, sendResponse) => {
      const { spaceName, title, url, favIconUrl, parentId, index } = message as {
        spaceName: string;
        title: string;
        url: string;
        favIconUrl?: string;
        parentId?: string;
        index?: number;
      };
      if (!spaceName || !title || !url)
        return respondAsync(async () => sendResponse({ ok: false, error: 'Missing params' }));
      return respondAsync(async () => {
        try {
          const tab = await deps.createPinnedTab(
            spaceName,
            title,
            url,
            favIconUrl,
            parentId,
            index
          );
          await deps.broadcastSpacesSnapshot();
          sendResponse({ ok: true, data: tab });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
      });
    },
    movePinnedItem: (message, sendResponse) => {
      const { id, parentId, index, spaceName } = message as {
        id: string;
        parentId?: string;
        index?: number;
        spaceName?: string;
      };
      if (!id)
        return respondAsync(async () => sendResponse({ ok: false, error: 'Missing params' }));
      return respondAsync(async () => {
        try {
          await deps.movePinnedItem(id, { parentId, index, spaceName });
          await deps.broadcastSpacesSnapshot();
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
      });
    },
    removePinnedItem: (message, sendResponse) => {
      const { id } = message as { id: string };
      if (!id)
        return respondAsync(async () => sendResponse({ ok: false, error: 'Missing params' }));
      return respondAsync(async () => {
        try {
          await deps.removePinnedItem(id);
          await deps.broadcastSpacesSnapshot();
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
      });
    },
    updatePinnedItem: (message, sendResponse) => {
      const { id, changes } = message as { id: string; changes: { title?: string; url?: string } };
      if (!id)
        return respondAsync(async () => sendResponse({ ok: false, error: 'Missing params' }));
      return respondAsync(async () => {
        try {
          await deps.updatePinnedItem(id, changes);
          await deps.broadcastSpacesSnapshot();
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
      });
    },
    exportSpaceBookmarks: (message, sendResponse) => {
      const { spaceName } = message as { spaceName: string };
      if (!spaceName)
        return respondAsync(async () => sendResponse({ ok: false, error: 'Missing params' }));
      return respondAsync(async () => {
        try {
          const html = await deps.exportSpaceBookmarks(spaceName);
          sendResponse({ ok: true, data: html });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
      });
    },
    importSpaceBookmarks: (message, sendResponse) => {
      const { spaceName, htmlContent, parentId } = message as {
        spaceName: string;
        htmlContent: string;
        parentId?: string;
      };
      if (!spaceName || !htmlContent)
        return respondAsync(async () => sendResponse({ ok: false, error: 'Missing params' }));
      return respondAsync(async () => {
        try {
          await deps.importSpaceBookmarks(spaceName, htmlContent, parentId);
          await deps.broadcastSpacesSnapshot();
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
      });
    },
    searchHistory: (message, sendResponse) => {
      const { query, maxResults } = message as { query: string; maxResults?: number };
      return respondAsync(async () => {
        try {
          const results = await deps.searchHistory(query, maxResults);
          sendResponse({ ok: true, data: results });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
      });
    },
    searchBookmarks: (message, sendResponse) => {
      const { query, maxResults } = message as { query: string; maxResults?: number };
      return respondAsync(async () => {
        try {
          const results = await deps.searchBookmarks(query, maxResults);
          sendResponse({ ok: true, data: results });
        } catch (e) {
          sendResponse({ ok: false, error: String(e) });
        }
      });
    },
  };
}
