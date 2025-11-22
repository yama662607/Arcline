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
  pinnedTabs: MockTab[];
  temporaryTabs: MockTab[];
}

export async function addServiceWorkerBridgeMock(page: Page) {
  await page.addInitScript(() => {
    // Extend window interface for Chrome APIs
    interface RuntimeOnMessageMock {
      addListener: (
        listener: (
          response: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void
        ) => void
      ) => void;
      removeListener: (
        listener: (
          response: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void
        ) => void
      ) => void;
      hasListeners: () => boolean;
    }

    interface ChromeRuntimeMock {
      sendMessage?: (
        message: {
          type?: string;
          method?: string;
          params?: { spaceId?: number; name?: string; color?: string; pinned?: boolean };
        },
        callback?: (response: unknown) => void
      ) => void;
      onMessage?: RuntimeOnMessageMock;
    }

    interface ChromeMock {
      runtime?: ChromeRuntimeMock;
    }

    interface ExtendedWindow extends Window {
      chrome?: ChromeMock;
    }

    const extendedWindow = window as ExtendedWindow;

    // Ensure chrome object exists and has runtime with sendMessage
    if (!extendedWindow.chrome) {
      extendedWindow.chrome = {};
    }

    if (!extendedWindow.chrome.runtime) {
      extendedWindow.chrome.runtime = {};
    }

    const chromeRuntime = extendedWindow.chrome.runtime;
    if (!chromeRuntime) {
      return;
    }

    // Store message listeners and mock state
    const messageListeners: ((
      response: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => void)[] = [];
    const mockSpaces: MockSpace[] = [
      {
        id: 1,
        name: 'Default Space',
        color: 'blue',
        windowId: 1,
        timestamp: Date.now(),
        pinnedTabs: [],
        temporaryTabs: [],
      },
    ];

    // Mock chrome.runtime.sendMessage for Service Worker Bridge
    const originalSendMessage = chromeRuntime.sendMessage;

    chromeRuntime.sendMessage = (
      message: {
        type?: string;
        method?: string;
        params?: { spaceId?: number; name?: string; color?: string; pinned?: boolean };
      },
      callback?: (response: unknown) => void
    ) => {
      // Handle Bridge messages
      if (message && (message.type === 'query' || message.type === 'mutation')) {
        // Mock responses for common methods
        setTimeout(() => {
          const response = handleMessage(message, mockSpaces);

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
      }

      // Call original sendMessage if it existed
      if (originalSendMessage) {
        return originalSendMessage(message, callback);
      }
    };

    // Helper function to handle message processing
    function handleMessage(
      message: {
        id?: string;
        method?: string;
        params?: { spaceId?: number; name?: string; color?: string; pinned?: boolean };
      },
      mockSpaces: MockSpace[]
    ) {
      const response: { id?: string; data?: unknown; error?: string } = { id: message.id };

      switch (message.method) {
        case 'getSpacesSnapshot':
          return handleGetSpacesSnapshot(response, mockSpaces);
        case 'getSettings':
          return handleGetSettings(response);
        case 'getArchivedTabs':
          return handleGetArchivedTabs(response);
        case 'getBookmarksForSpace':
          return handleGetBookmarksForSpace(response);
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
          return handleUnknownMethod(response, message);
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
      response.data = {};
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

    function handleCreateSpace(
      response: { id?: string; data?: unknown },
      message: { params?: { name?: string; color?: string } },
      mockSpaces: MockSpace[]
    ) {
      const newSpace: MockSpace = {
        id: Math.max(...mockSpaces.map((s) => s.id), 0) + 1,
        name: message.params?.name || 'New Space',
        color: message.params?.color || 'blue',
        windowId: 1,
        timestamp: Date.now(),
        pinnedTabs: [],
        temporaryTabs: [],
      };
      mockSpaces.push(newSpace);
      response.data = newSpace.id;
      return response;
    }

    function handleRemoveSpace(
      response: { id?: string; data?: unknown; error?: string },
      message: { params?: { spaceId?: number } },
      mockSpaces: MockSpace[]
    ) {
      const spaceIdToRemove = message.params?.spaceId;
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
      message: { params?: { pinned?: boolean } }
    ) {
      response.data = message.params?.pinned ?? true;
      return response;
    }

    function handleTabOperations(response: { id?: string; data?: unknown }) {
      response.data = null;
      return response;
    }

    function handleUnknownMethod(
      response: { id?: string; error?: string },
      message: { method?: string }
    ) {
      response.error = `Unknown method: ${message.method}`;
      return response;
    }

    // Mock onMessage to capture listeners
    const runtimeOnMessageMock: RuntimeOnMessageMock = {
      addListener: (
        listener: (
          response: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void
        ) => void
      ) => {
        messageListeners.push(listener);
      },
      removeListener: (
        listener: (
          response: unknown,
          sender: chrome.runtime.MessageSender,
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

    chromeRuntime.onMessage = runtimeOnMessageMock;
  });
}
