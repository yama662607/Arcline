import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TabGroupColor } from '@/shared/chrome-types';
import { getSpacesSnapshot } from './browser';

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
};

// @ts-expect-error - Mocking global chrome
global.chrome = mockChrome;

describe('getSpacesSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when no tab groups exist', async () => {
    mockChrome.tabGroups.query.mockResolvedValue([]);
    mockChrome.tabs.query.mockResolvedValue([]);

    const result = await getSpacesSnapshot();

    expect(result).toEqual([]);
  });

  it('should create space for each tab group', async () => {
    const mockTabGroups: chrome.tabGroups.TabGroup[] = [
      {
        id: 1,
        title: 'Work',
        color: 'blue' as TabGroupColor,
        windowId: 100,
        collapsed: false,
        shared: false,
      },
      {
        id: 2,
        title: 'Personal',
        color: 'red' as TabGroupColor,
        windowId: 100,
        collapsed: false,
        shared: false,
      },
    ];

    mockChrome.tabGroups.query.mockResolvedValue(mockTabGroups);
    mockChrome.tabs.query.mockResolvedValue([]);

    const result = await getSpacesSnapshot();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 1,
      name: 'Work',
      color: 'blue',
      tabs: [],
      pinnedTabs: [],
      temporaryTabs: [],
    });
    expect(result[1]).toMatchObject({
      id: 2,
      name: 'Personal',
      color: 'red',
      tabs: [],
      pinnedTabs: [],
      temporaryTabs: [],
    });
  });

  it('should distribute tabs to correct groups', async () => {
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
        id: 10,
        title: 'Tab 1',
        url: 'https://example.com',
        groupId: 1,
        pinned: false,
        active: true,
        windowId: 100,
        index: 0,
        highlighted: false,
        frozen: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: false,
      },
      {
        id: 11,
        title: 'Tab 2',
        url: 'https://example.org',
        groupId: 1,
        pinned: true,
        active: false,
        windowId: 100,
        index: 1,
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

    const result = await getSpacesSnapshot();

    expect(result).toHaveLength(1);
    expect(result[0]?.pinnedTabs).toHaveLength(1);
    expect(result[0]?.tabs).toHaveLength(1);
    expect(result[0]?.pinnedTabs[0]).toMatchObject({
      id: 11,
      title: 'Tab 2',
      pinned: true,
    });
    expect(result[0]?.tabs[0]).toMatchObject({
      id: 10,
      title: 'Tab 1',
      pinned: false,
    });
  });

  it('should create ungrouped space for tabs without group', async () => {
    const mockTabGroups: chrome.tabGroups.TabGroup[] = [];

    const mockTabs: chrome.tabs.Tab[] = [
      {
        id: 10,
        title: 'Ungrouped Tab',
        url: 'https://example.com',
        groupId: -1,
        pinned: false,
        active: true,
        windowId: 100,
        index: 0,
        highlighted: false,
        frozen: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: false,
      },
      {
        id: 11,
        title: 'Pinned Ungrouped',
        url: 'https://example.org',
        groupId: -1,
        pinned: true,
        active: false,
        windowId: 100,
        index: 1,
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

    const result = await getSpacesSnapshot();

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(-1);
    expect(result[0]?.name).toBe('Ungrouped');
    expect(result[0]?.temporaryTabs).toHaveLength(1);
    expect(result[0]?.pinnedTabs).toHaveLength(1);
  });

  it('should separate pinned and temporary tabs correctly', async () => {
    const mockTabGroups: chrome.tabGroups.TabGroup[] = [
      {
        id: 1,
        title: 'Mixed',
        color: 'green' as TabGroupColor,
        windowId: 100,
        collapsed: false,
        shared: false,
      },
    ];

    const mockTabs: chrome.tabs.Tab[] = [
      {
        id: 10,
        title: 'Pinned 1',
        url: 'https://pin1.com',
        groupId: 1,
        pinned: true,
        active: false,
        windowId: 100,
        index: 0,
        highlighted: false,
        frozen: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: false,
      },
      {
        id: 11,
        title: 'Temp 1',
        url: 'https://temp1.com',
        groupId: 1,
        pinned: false,
        active: false,
        windowId: 100,
        index: 1,
        highlighted: false,
        frozen: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: false,
      },
      {
        id: 12,
        title: 'Pinned 2',
        url: 'https://pin2.com',
        groupId: 1,
        pinned: true,
        active: false,
        windowId: 100,
        index: 2,
        highlighted: false,
        frozen: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: false,
      },
      {
        id: 13,
        title: 'Temp 2',
        url: 'https://temp2.com',
        groupId: 1,
        pinned: false,
        active: true,
        windowId: 100,
        index: 3,
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

    const result = await getSpacesSnapshot();

    expect(result).toHaveLength(1);
    expect(result[0]?.pinnedTabs).toHaveLength(2);
    expect(result[0]?.tabs).toHaveLength(2);
    expect(result[0]?.pinnedTabs.map((t) => t.id)).toEqual([10, 12]);
    expect(result[0]?.tabs.map((t) => t.id)).toEqual([11, 13]);
  });

  it('should handle tabs with undefined IDs gracefully', async () => {
    const mockTabGroups: chrome.tabGroups.TabGroup[] = [
      {
        id: 1,
        title: 'Test',
        color: 'blue' as TabGroupColor,
        windowId: 100,
        collapsed: false,
        shared: false,
      },
    ];

    const mockTabs: chrome.tabs.Tab[] = [
      {
        id: undefined as unknown as number,
        title: 'Invalid Tab',
        url: 'https://example.com',
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
      },
      {
        id: 11,
        title: 'Valid Tab',
        url: 'https://example.org',
        groupId: 1,
        pinned: false,
        active: true,
        windowId: 100,
        index: 1,
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

    const result = await getSpacesSnapshot();

    expect(result).toHaveLength(1);
    expect(result[0]?.tabs).toHaveLength(1);
    expect(result[0]?.tabs[0]?.id).toBe(11);
  });

  it('should handle API errors gracefully', async () => {
    mockChrome.tabGroups.query.mockRejectedValue(new Error('API Error'));

    const result = await getSpacesSnapshot();

    expect(result).toEqual([]);
  });
});
