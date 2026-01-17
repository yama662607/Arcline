import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TabGroupColor } from '@/shared/chrome-types';
import type { PinnedTab } from '@/shared/types';

// Mock Chrome APIs
const mockChrome = {
  tabGroups: {
    query: vi.fn(),
  },
  tabs: {
    query: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    group: vi.fn(),
    ungroup: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
};

vi.stubGlobal('chrome', mockChrome);

// Mock bookmarks service
vi.mock('./bookmarks', () => ({
  getPinnedItemsForSpace: vi.fn().mockResolvedValue([]),
  createPinnedFolder: vi.fn(),
  exportSpaceBookmarks: vi.fn(),
  importSpaceBookmarks: vi.fn(),
  movePinnedItem: vi.fn(),
  removePinnedItem: vi.fn(),

  updatePinnedItem: vi.fn(),
  getBookmarksForSpace: vi.fn(),
  removeSpaceFolder: vi.fn(),
  syncSpaceToBookmarks: vi.fn(),
}));

// Mock Dexie db
vi.mock('@/db', () => ({
  db: {
    spaces: {
      orderBy: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(undefined),
    },
    items: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(undefined),
    },
    transaction: vi.fn().mockImplementation((_mode, _tables, callback) => callback()),
  },
}));

import { clearCachedSnapshot, getSpacesSnapshot } from './browser';

import { db } from '@/db';

// Helper to mock DB data
function mockDbSpace(name: string, id: number, color: TabGroupColor = 'blue') {
  return {
    id,
    uuid: `uuid-${id}`,
    name,
    color,
    sortOrder: 0,
    windowId: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    tabGroupId: id,
  };
}

describe('getSpacesSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset DB mocks
    vi.mocked(db.spaces.orderBy).mockReturnThis();
    vi.mocked(db.spaces.toArray).mockResolvedValue([]);
    vi.mocked(db.items.where).mockReturnThis();
    // biome-ignore lint/suspicious/noExplicitAny: mocking Dexie chain
    vi.mocked((db.items as any).equals).mockReturnThis();
    vi.mocked(db.items.toArray).mockResolvedValue([]);

    clearCachedSnapshot();
  });

  it('should return empty array when no tab groups exist', async () => {
    mockChrome.tabGroups.query.mockResolvedValue([]);
    mockChrome.tabs.query.mockResolvedValue([]);
    // DB is empty by default

    const result = await getSpacesSnapshot();

    expect(result).toEqual([]);
  });

  it('should create space for each tab group and fetch pinned items', async () => {
    const mockTabGroups: chrome.tabGroups.TabGroup[] = [
      {
        id: 1,
        title: 'Work',
        color: 'blue' as TabGroupColor,
        windowId: 100,
        collapsed: false,
        shared: false,
      },
    ];

    mockChrome.tabGroups.query.mockResolvedValue(mockTabGroups);
    mockChrome.tabs.query.mockResolvedValue([]);

    // Mock DB space
    const dbSpace = mockDbSpace('Work', 1);
    vi.mocked(db.spaces.toArray).mockResolvedValue([dbSpace]);

    // Mock pinned items for Work space
    vi.mocked(db.items.toArray).mockResolvedValue([
      {
        id: 100,
        spaceId: 1,
        type: 'tab',
        title: 'Start',
        url: 'http://start.com',
        sortOrder: 0,
        parentId: undefined,
        createdAt: new Date(),
        // biome-ignore lint/suspicious/noExplicitAny: mock data for test
      } as any,
    ]);

    const result = await getSpacesSnapshot();

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Work');
    expect(result[0]?.pinnedItems).toHaveLength(1);
    expect((result[0]?.pinnedItems[0] as PinnedTab).title).toBe('Start');
    // We expect DB to be queried
    expect(db.spaces.orderBy).toHaveBeenCalledWith('sortOrder');
  });

  it('should link pinned items to open tabs in the space', async () => {
    const mockTabGroups: chrome.tabGroups.TabGroup[] = [
      {
        id: 1,
        title: 'Work',
        color: 'blue' as TabGroupColor,
        windowId: 100,
        collapsed: false,
        shared: false,
      },
    ];

    const mockTabs: chrome.tabs.Tab[] = [
      {
        id: 101,
        title: 'Start',
        url: 'http://start.com',
        groupId: 1,
        active: false,
        pinned: false,
        windowId: 100,
        index: 0,
        highlighted: false,
        frozen: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: false,
      },
    ];

    mockChrome.tabGroups.query.mockResolvedValue(mockTabGroups);
    mockChrome.tabs.query.mockResolvedValue(mockTabs);

    // Mock DB space
    vi.mocked(db.spaces.toArray).mockResolvedValue([mockDbSpace('Work', 1)]);

    // Pinned item matches the open tab URL
    vi.mocked(db.items.toArray).mockResolvedValue([
      {
        id: 100,
        spaceId: 1,
        type: 'tab',
        title: 'Start',
        url: 'http://start.com',
        sortOrder: 0,
        parentId: undefined,
        createdAt: new Date(),
        // biome-ignore lint/suspicious/noExplicitAny: mock data for test
      } as any,
    ]);

    const result = await getSpacesSnapshot();

    expect(result[0]?.tabs).toHaveLength(1);
    expect(result[0]?.pinnedItems).toHaveLength(1);

    // Check if tabId was linked
    const pinnedItem = result[0]?.pinnedItems[0] as PinnedTab;
    expect(pinnedItem.tabId).toBe(101);
  });

  // existing tests...
  it('should distribute tabs to correct groups', async () => {
    // ... same logic as before, just asserting basics ...
    mockChrome.tabGroups.query.mockResolvedValue([
      { id: 1, title: 'G', color: 'blue', windowId: 100, collapsed: false, shared: false },
    ]);

    mockChrome.tabs.query.mockResolvedValue([
      {
        id: 10,
        groupId: 1,
        pinned: false,
        active: false,
        windowId: 100,
        index: 0,
        highlighted: false,
        frozen: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: false,
        title: 'T',
        url: 'u',
      },
    ]);

    // Mock DB space
    vi.mocked(db.spaces.toArray).mockResolvedValue([mockDbSpace('G', 1)]);

    const result = await getSpacesSnapshot();
    expect(result).toHaveLength(1);
    expect(result[0]?.tabs).toHaveLength(1);
  });
});
