import type { Page } from '@playwright/test';

export interface MockTab {
  id: number;
  title: string;
  url: string;
  pinned: boolean;
}

export interface MockSpace {
  id: number;
  name: string;
  color: string;
  windowId: number;
  timestamp: number;
  tabs: MockTab[];
  pinnedTabs: MockTab[];
  pinnedItems: unknown[];
  temporaryTabs: MockTab[];
}

export async function addServiceWorkerBridgeMock(
  page: Page,
  options: { skipOnboarding?: boolean } = { skipOnboarding: true }
) {
  await page.addInitScript(
    ({ skipOnboarding }) => {
      if (skipOnboarding) {
        try {
          const win = window as unknown as {
            chrome?: { storage?: { local?: { set: (d: unknown) => void } } };
          };
          if (win.chrome?.storage?.local) {
            win.chrome.storage.local.set({ 'arcline.hasSeenOnboarding': true });
          }
        } catch (_e) {
          // Ignore errors during init
        }
      }

      const extendedWindow = window as unknown as {
        chrome?: { runtime?: Record<string, unknown> };
      };

      // Ensure chrome object exists and has runtime with sendMessage
      if (!extendedWindow.chrome) {
        extendedWindow.chrome = {};
      }

      const chromeObj = extendedWindow.chrome as { runtime?: Record<string, unknown> };
      if (!chromeObj.runtime) {
        chromeObj.runtime = {};
      }

      const runtime = chromeObj.runtime;

      // Store message listeners and mock state
      const messageListeners: ((
        response: unknown,
        sender: unknown,
        sendResponse: (r?: unknown) => void
      ) => void)[] = [];

      const mockSettings = {
        defaultSpaceName: 'Home',
        autoArchiveEnabled: false,
        autoArchiveIdleMinutes: 30,
        uiMode: 'floating',
        showFavicons: true,
        compactMode: false,
        enableAnimations: true,
        theme: 'auto',
        gesturesEnabled: true,
        gestureSensitivity: 100,
      };
      const mockSpaces: MockSpace[] = [
        {
          id: 1,
          name: 'Default Space',
          color: 'blue',
          windowId: 1,
          timestamp: Date.now(),
          tabs: [
            {
              id: 101,
              title: 'Example Tab',
              url: 'https://example.com',
              pinned: false,
            },
            {
              id: 102,
              title: 'Google',
              url: 'https://google.com',
              pinned: false,
            },
          ],
          pinnedTabs: [
            {
              id: 201,
              title: 'Pinned Tab',
              url: 'https://pinned.example.com',
              pinned: true,
            },
          ],
          pinnedItems: [],
          temporaryTabs: [
            {
              id: 101,
              title: 'Example Tab',
              url: 'https://example.com',
              pinned: false,
            },
            {
              id: 301,
              title: 'Temporary Tab',
              url: 'https://temp.example.com',
              pinned: false,
            },
          ],
        },
      ];

      const mockArchivedTabs = [
        {
          id: 'archived-1',
          url: 'https://archived.example.com',
          title: 'Archived Tab',
          spaceId: 1,
          spaceName: 'Default Space',
          archivedAt: Date.now() - 86400000,
        },
      ];

      const mockFavorites = [
        {
          url: 'https://favorite.example.com',
          title: 'Favorite Site',
          favIconUrl: '',
          addedAt: Date.now() - 3600000,
        },
      ];

      // Mock chrome.runtime.sendMessage for Service Worker Bridge
      const originalSendMessage = runtime.sendMessage as
        | ((message: unknown, callback?: (response: unknown) => void) => unknown)
        | undefined;

      const isRecord = (value: unknown): value is Record<string, unknown> =>
        Boolean(value) && typeof value === 'object';

      const notifyMessageListeners = (response: unknown) => {
        messageListeners.forEach((listener) => {
          try {
            listener(response, {}, () => {});
          } catch (_e) {
            // Silently handle listener errors
          }
        });
      };

      const callOriginalSendMessage = (
        message: unknown,
        callback?: (response: unknown) => void
      ) => {
        if (originalSendMessage) {
          return originalSendMessage(message, callback);
        }
        return undefined;
      };

      const handleBridgeMessage = (
        payload: Record<string, unknown>,
        callback?: (response: unknown) => void
      ) => {
        setTimeout(() => {
          const response = handleMessage(payload, mockSpaces);
          if (callback) {
            callback(response);
          }
          notifyMessageListeners(response);
        }, 10);
      };

      const handleLegacyCommand = (
        payload: Record<string, unknown>,
        callback?: (response: unknown) => void
      ): boolean => {
        if (typeof payload.command !== 'string') return false;
        setTimeout(() => {
          if (payload.command === 'requestUiMode') {
            if (callback) callback({ mode: mockSettings.uiMode });
          }
          // Add other legacy commands if needed
        }, 10);
        return true;
      };

      runtime.sendMessage = ((message: unknown, callback?: (response: unknown) => void) => {
        if (!isRecord(message)) {
          return callOriginalSendMessage(message, callback);
        }

        const payloadType = message.type;
        if (payloadType === 'query' || payloadType === 'mutation') {
          handleBridgeMessage(message, callback);
          return;
        }

        if (handleLegacyCommand(message, callback)) {
          return;
        }

        return callOriginalSendMessage(message, callback);
      }) as unknown as Record<string, unknown>['sendMessage'];

      // Helper function to handle message processing
      function handleMessage(message: Record<string, unknown>, mockSpaces: MockSpace[]) {
        const response: { id?: string; data?: unknown; error?: string } = {
          id: typeof message.id === 'string' ? message.id : undefined,
        };

        const method = typeof message.method === 'string' ? message.method : undefined;

        switch (method) {
          case 'getSpacesSnapshot':
            return handleGetSpacesSnapshot(response, mockSpaces);
          case 'getSettings':
            return handleGetSettings(response);
          case 'updateSettings':
            return handleUpdateSettings(response, message);
          case 'getArchivedTabs':
            return handleGetArchivedTabs(response);
          case 'getBookmarksForSpace':
            return handleGetBookmarksForSpace(response);
          case 'getFavorites':
            return handleGetFavorites(response);
          case 'addToFavorites':
            return handleAddToFavorites(response, message);
          case 'removeFromFavorites':
            return handleRemoveFromFavorites(response, message);
          case 'getActiveTab':
            return handleGetActiveTab(response);
          case 'createSpace':
            return handleCreateSpace(response, message, mockSpaces);
          case 'removeSpace':
            return handleRemoveSpace(response, message, mockSpaces);
          case 'toggleTabPinned':
            return handleToggleTabPinned(response, message);
          case 'moveTabToSpace':
          case 'closeTab':
          case 'activateTab':
          case 'archiveTab':
            return handleTabOperations(response);
          case 'navigateSpace':
            return handleNavigateSpace(response, message);
          default:
            return handleUnknownMethod(response, method);
        }
      }

      function handleNavigateSpace(
        response: { id?: string; data?: unknown },
        message: Record<string, unknown>
      ) {
        if ((window as { onNavigateSpace?: (params: unknown) => void }).onNavigateSpace) {
          (window as { onNavigateSpace?: (params: unknown) => void }).onNavigateSpace(
            message.params
          );
        }
        response.data = true;
        return response;
      }

      function handleGetSpacesSnapshot(
        response: { id?: string; data?: unknown },
        mockSpaces: MockSpace[]
      ) {
        response.data = [...mockSpaces];
        return response;
      }

      function handleGetSettings(response: { id?: string; data?: unknown }) {
        response.data = { ...mockSettings };
        return response;
      }

      function handleUpdateSettings(
        response: { id?: string; data?: unknown },
        message: Record<string, unknown>
      ) {
        const params = message.params;
        if (params && typeof params === 'object') {
          const settings = (params as Record<string, unknown>).settings;
          if (settings && typeof settings === 'object') {
            Object.assign(mockSettings, settings);
          }
        }
        response.data = null;
        return response;
      }

      function handleGetArchivedTabs(response: { id?: string; data?: unknown }) {
        response.data = [...mockArchivedTabs];
        return response;
      }

      function handleGetBookmarksForSpace(response: { id?: string; data?: unknown }) {
        response.data = [];
        return response;
      }

      function handleGetFavorites(response: { id?: string; data?: unknown }) {
        response.data = [...mockFavorites];
        return response;
      }

      function handleAddToFavorites(
        response: { id?: string; data?: unknown },
        message: Record<string, unknown>
      ) {
        const params = message.params;
        const paramsObj =
          params && typeof params === 'object' ? (params as Record<string, unknown>) : undefined;
        const tab = paramsObj?.tab as MockTab | undefined;

        if (tab) {
          mockFavorites.push({
            url: tab.url,
            title: tab.title,
            favIconUrl: '',
            addedAt: Date.now(),
          });
        }
        response.data = null;
        return response;
      }

      function handleRemoveFromFavorites(
        response: { id?: string; data?: unknown },
        message: Record<string, unknown>
      ) {
        const params = message.params;
        const paramsObj =
          params && typeof params === 'object' ? (params as Record<string, unknown>) : undefined;
        const url = typeof paramsObj?.url === 'string' ? paramsObj.url : undefined;

        if (url) {
          const index = mockFavorites.findIndex((f) => f.url === url);
          if (index > -1) {
            mockFavorites.splice(index, 1);
          }
        }
        response.data = null;
        return response;
      }

      function handleGetActiveTab(response: { id?: string; data?: unknown }) {
        response.data = {
          id: 101,
          title: 'Example Tab',
          url: 'https://example.com',
          pinned: false,
        };
        return response;
      }

      function handleCreateSpace(
        response: { id?: string; data?: unknown },
        message: Record<string, unknown>,
        mockSpaces: MockSpace[]
      ) {
        const params = message.params;
        const paramsObj =
          params && typeof params === 'object' ? (params as Record<string, unknown>) : undefined;
        const name = typeof paramsObj?.name === 'string' ? paramsObj.name : undefined;
        const color = typeof paramsObj?.color === 'string' ? paramsObj.color : undefined;

        const newSpace: MockSpace = {
          id: Math.max(...mockSpaces.map((s) => s.id), 0) + 1,
          name: name || 'New Space',
          color: color || 'blue',
          windowId: 1,
          timestamp: Date.now(),
          tabs: [],
          pinnedTabs: [],
          pinnedItems: [],
          temporaryTabs: [],
        };
        mockSpaces.push(newSpace);
        response.data = newSpace.id;
        return response;
      }

      function handleRemoveSpace(
        response: { id?: string; data?: unknown; error?: string },
        message: Record<string, unknown>,
        mockSpaces: MockSpace[]
      ) {
        const params = message.params;
        const paramsObj =
          params && typeof params === 'object' ? (params as Record<string, unknown>) : undefined;
        const spaceIdToRemove =
          typeof paramsObj?.spaceId === 'number' ? paramsObj.spaceId : undefined;
        if (spaceIdToRemove && mockSpaces.length > 1) {
          // Filter out the space to remove
          const filteredSpaces = mockSpaces.filter((s) => s.id !== spaceIdToRemove);
          // Update the original array by clearing and pushing filtered items
          mockSpaces.length = 0;
          mockSpaces.push(...filteredSpaces);
          response.data = null;
        } else {
          response.error = 'Cannot remove space or last space';
        }
        return response;
      }

      function handleToggleTabPinned(
        response: { id?: string; data?: unknown },
        message: Record<string, unknown>
      ) {
        const params = getTogglePinnedParams(message);
        if (!params) return response;

        togglePinnedAcrossSpaces(mockSpaces, params);
        response.data = true;
        return response;
      }

      function getTogglePinnedParams(message: Record<string, unknown>) {
        const params = message.params;
        const paramsObj =
          params && typeof params === 'object' ? (params as Record<string, unknown>) : undefined;
        const tabId = typeof paramsObj?.tabId === 'number' ? paramsObj.tabId : undefined;
        const pinned = typeof paramsObj?.pinned === 'boolean' ? paramsObj.pinned : undefined;
        if (tabId === undefined || pinned === undefined) return null;
        return { tabId, pinned };
      }

      function togglePinnedAcrossSpaces(
        spaces: MockSpace[],
        params: { tabId: number; pinned: boolean }
      ) {
        for (const space of spaces) {
          if (applyTogglePinned(space, params.tabId, params.pinned)) {
            return true;
          }
        }
        return false;
      }

      function applyTogglePinned(space: MockSpace, tabId: number, pinned: boolean): boolean {
        const moveTab = (fromList: MockTab[], toList: MockTab[], nextPinned: boolean): boolean => {
          const index = fromList.findIndex((tab) => tab.id === tabId);
          if (index === -1) return false;
          const tab = fromList.splice(index, 1)[0];
          if (!tab) return false;
          tab.pinned = nextPinned;
          toList.push(tab);
          return true;
        };

        const updateTabPinnedFlag = (list: MockTab[], nextPinned: boolean): boolean => {
          const tab = list.find((item) => item.id === tabId);
          if (!tab) return false;
          tab.pinned = nextPinned;
          return true;
        };

        const actions = pinned
          ? [
              () => moveTab(space.temporaryTabs, space.pinnedTabs, true),
              () => moveTab(space.tabs, space.pinnedTabs, true),
            ]
          : [
              () => moveTab(space.pinnedTabs, space.temporaryTabs, false),
              () => updateTabPinnedFlag(space.tabs, false),
            ];

        for (const action of actions) {
          if (action()) return true;
        }

        return false;
      }

      function handleTabOperations(response: { id?: string; data?: unknown }) {
        response.data = null;
        return response;
      }

      function handleUnknownMethod(response: { id?: string; error?: string }, method?: string) {
        response.error = `Unknown method: ${method ?? 'unknown'}`;
        return response;
      }

      // Mock onMessage to capture listeners
      const runtimeOnMessageMock = {
        addListener: (
          listener: (
            response: unknown,
            sender: unknown,
            sendResponse: (response?: unknown) => void
          ) => void
        ) => {
          messageListeners.push(listener);
        },
        removeListener: (
          listener: (
            response: unknown,
            sender: unknown,
            sendResponse: (response?: unknown) => void
          ) => void
        ) => {
          const index = messageListeners.indexOf(listener);
          if (index > -1) {
            messageListeners.splice(index, 1);
          }
        },
        hasListeners: () => messageListeners.length > 0,
      };

      (runtime as unknown as { onMessage?: unknown }).onMessage = runtimeOnMessageMock;
    },
    { skipOnboarding: options.skipOnboarding }
  );
}

export async function bypassOnboarding(page: Page) {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      if (window.chrome?.storage?.local) {
        window.chrome.storage.local.set({ 'arcline.hasSeenOnboarding': true }, resolve);
      } else {
        resolve();
      }
    });
  });
  await page.reload();
}
