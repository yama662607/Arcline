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
    };
    const mockSpaces: MockSpace[] = [
      {
        id: 1,
        name: 'Default Space',
        color: 'blue',
        windowId: 1,
        timestamp: Date.now(),
        tabs: [],
        pinnedTabs: [],
        pinnedItems: [],
        temporaryTabs: [],
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
              listener(response, {}, () => {});
            } catch (_e) {
              // Silently handle listener errors
            }
          });
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
        default:
          return handleUnknownMethod(response, method);
      }
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
      response.data = [];
      return response;
    }

    function handleGetBookmarksForSpace(response: { id?: string; data?: unknown }) {
      response.data = [];
      return response;
    }

    function handleGetFavorites(response: { id?: string; data?: unknown }) {
      response.data = [];
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
      const pinned = typeof paramsObj?.pinned === 'boolean' ? paramsObj.pinned : undefined;
      response.data = pinned ?? true;
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
