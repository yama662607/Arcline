import { vi } from 'vitest';

// Mock Chrome APIs for testing
export const chromeMock = {
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockImplementation((_tabId, _message, callback) => {
      if (typeof callback === 'function') {
        callback();
      }
      return undefined;
    }),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com' }),
  },
  tabGroups: {
    query: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
    move: vi.fn().mockResolvedValue({}),
  },
  windows: {
    getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
    WINDOW_ID_CURRENT: 1,
  },
  sidePanel: {
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  bookmarks: {
    getTree: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getURL: vi.fn().mockReturnValue('chrome-extension://test/'),
    onInstalled: {
      addListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
    },
    sendMessage: vi.fn().mockImplementation((_message, callback) => {
      if (typeof callback === 'function') {
        callback();
      }
      return undefined;
    }),
    lastError: undefined as chrome.runtime.LastError | undefined,
  },
  action: {
    setPopup: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  commands: {
    onCommand: {
      addListener: vi.fn(),
    },
  },
};

export function resetChromeMock() {
  const clear = (value: unknown) => {
    if (typeof value === 'function' && 'mockClear' in value) {
      (value as { mockClear: () => void }).mockClear();
      return;
    }

    if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach((child) => {
        clear(child);
      });
    }
  };

  clear(chromeMock);
  chromeMock.runtime.lastError = undefined;
}
