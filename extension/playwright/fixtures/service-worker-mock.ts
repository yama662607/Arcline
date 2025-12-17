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

export async function addServiceWorkerBridgeMock(page: Page) {
  await page.addInitScript(() => {
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

    runtime.sendMessage = ((message: unknown, callback?: (response: unknown) => void) => {
      // Handle Bridge messages
      if (!message || typeof message !== 'object') {
        if (originalSendMessage) {
          return originalSendMessage(message, callback);
        }
        return;
      }

      const payload = message as Record<string, unknown>;
      const payloadType = payload.type;

      if (payloadType === 'query' || payloadType === 'mutation') {
        // Mock responses for common methods
        setTimeout(() => {
          const response = handleMessage(payload, mockSpaces);

          // Call callback if provided
          if (callback) {
            callback(response);
          }

          // Notify message listeners
          messageListeners.forEach((listener) => {
            try {
              listener(response, {}, () => { });
            } catch (_e) {
              // Silently handle listener errors
            }
          });
        }, 10);

        return;
        return;
      }

      // Handle legacy commands
      if (typeof payload.command === 'string') {
        setTimeout(() => {
          if (payload.command === 'requestUiMode') {
            if (callback) callback({ mode: mockSettings.uiMode });
          }
          // Add other legacy commands if needed
        }, 10);
        return;
      }

      // Call original sendMessage if it existed
      if (originalSendMessage) {
        return originalSendMessage(message, callback);
      }
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
      if ((window as any).onNavigateSpace) {
        (window as any).onNavigateSpace(message.params);
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
      response.data = null;
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
      const params = message.params;
      const paramsObj =
        params && typeof params === 'object' ? (params as Record<string, unknown>) : undefined;
      const tabId = typeof paramsObj?.tabId === 'number' ? paramsObj.tabId : undefined;
      const pinned = typeof paramsObj?.pinned === 'boolean' ? paramsObj.pinned : undefined;

      if (tabId === undefined || pinned === undefined) {
        return response;
      }

      for (const space of mockSpaces) {
        // Try to find in pinnedTabs
        const pinnedIndex = space.pinnedTabs.findIndex((t) => t.id === tabId);
        if (pinnedIndex !== -1) {
          const tab = space.pinnedTabs[pinnedIndex];
          if (!pinned) {
            // Unpin: Move to temporaryTabs
            space.pinnedTabs.splice(pinnedIndex, 1);
            tab.pinned = false;
            space.temporaryTabs.push(tab);
          }
          response.data = true;
          return response;
        }

        // Try to find in temporaryTabs
        const tempIndex = space.temporaryTabs.findIndex((t) => t.id === tabId);
        if (tempIndex !== -1) {
          const tab = space.temporaryTabs[tempIndex];
          if (pinned) {
            // Pin: Move to pinnedTabs
            space.temporaryTabs.splice(tempIndex, 1);
            tab.pinned = true;
            space.pinnedTabs.push(tab);
          }
          response.data = true;
          return response;
        }

        // Try to find in tabs (general tabs)
        const tabIndex = space.tabs.findIndex((t) => t.id === tabId);
        if (tabIndex !== -1) {
          const tab = space.tabs[tabIndex];
          if (pinned) {
            // Pin: Move to pinnedTabs
            space.tabs.splice(tabIndex, 1);
            tab.pinned = true;
            space.pinnedTabs.push(tab);
          } else {
            // Already unpinned logic not needed if in 'tabs' which implies unpinned usually?
            // But valid to ensure property
            tab.pinned = false;
          }
          response.data = true;
          return response;
        }
      }

      response.data = true;
      return response;
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
  });
}
