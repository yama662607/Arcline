import { vi } from 'vitest';

// Mock Chrome APIs for testing
export const chromeMock = {
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue(undefined),
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
  },
};

export function resetChromeMock() {
  vi.clearAllMocks();
  // Reset all mock implementations
  Object.values(chromeMock).forEach((api) => {
    if (typeof api === 'object' && api !== null) {
      Object.values(api).forEach((method) => {
        if (typeof method === 'object' && method !== null && 'mockClear' in method) {
          (method as { mockClear: () => void }).mockClear();
        }
      });
    }
  });
}
