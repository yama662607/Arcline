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

import { getPinnedItemsForSpace } from './bookmarks';
import { clearCachedSnapshot, getSpacesSnapshot } from './browser';

describe('getSpacesSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPinnedItemsForSpace).mockResolvedValue([]);
    clearCachedSnapshot();
  });

  it('should return empty array when no tab groups exist', async () => {
    mockChrome.tabGroups.query.mockResolvedValue([]);
    mockChrome.tabs.query.mockResolvedValue([]);

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

    // Mock pinned items for Work space
    vi.mocked(getPinnedItemsForSpace).mockResolvedValue([
      { type: 'tab', id: 'b1', title: 'Start', url: 'http://start.com' },
    ]);

    const result = await getSpacesSnapshot();

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Work');
    expect(result[0]?.pinnedItems).toHaveLength(1);
    expect((result[0]?.pinnedItems[0] as PinnedTab).title).toBe('Start');
    expect(getPinnedItemsForSpace).toHaveBeenCalledWith('Work');
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

    // Pinned item matches the open tab URL
    vi.mocked(getPinnedItemsForSpace).mockResolvedValue([
      { type: 'tab', id: 'b1', title: 'Start', url: 'http://start.com' },
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
    const result = await getSpacesSnapshot();
    expect(result).toHaveLength(1);
    expect(result[0]?.tabs).toHaveLength(1);
  });
});
