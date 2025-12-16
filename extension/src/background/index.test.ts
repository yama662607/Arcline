import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./services/browser', () => {
  const fn = () => vi.fn();
  const asyncFn = (value?: unknown) => vi.fn().mockResolvedValue(value);

  return {
    toggleTabPinned: vi.fn(),
    broadcastSpacesSnapshot: vi.fn(),
    moveTabToSpace: vi.fn(),
    createSpace: vi.fn(),
    removeSpace: vi.fn(),
    closeTab: vi.fn(),
    activateTab: vi.fn(),
    reloadTab: vi.fn(),
    getActiveTabEntry: asyncFn(null),
    getSpacesSnapshot: asyncFn([]),
    getSettings: asyncFn({}),
    getArchivedTabs: asyncFn([]),
    getBookmarksForSpace: fn(),
    archiveTab: fn(),
    restoreArchivedTab: fn(),
    updateSettings: fn(),
    searchHistory: asyncFn([]),
    searchBookmarks: asyncFn([]),
    createPinnedFolder: fn(),
    createPinnedTab: fn(),
    movePinnedItem: fn(),
    removePinnedItem: fn(),
    updatePinnedItem: fn(),
    exportSpaceBookmarks: fn(),
    importSpaceBookmarks: fn(),
    reorderTab: fn(),
  };
});

import type { UiMode } from '@/lib/ui-mode';
import type { SpaceSnapshot } from '@/shared/types';
import { chromeMock } from '@/test/chrome-mock';
import { broadcastUiMode, commandHandlers } from './index';
import {
  broadcastSpacesSnapshot,
  getSpacesSnapshot,
  searchBookmarks,
  searchHistory,
  toggleTabPinned,
} from './services/browser';

const toggleTabPinnedMock = vi.mocked(toggleTabPinned);
const broadcastSpacesSnapshotMock = vi.mocked(broadcastSpacesSnapshot);
const getSpacesSnapshotMock = vi.mocked(getSpacesSnapshot);
const searchHistoryMock = vi.mocked(searchHistory);
const searchBookmarksMock = vi.mocked(searchBookmarks);

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('broadcastUiMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.runtime.lastError = undefined;
  });

  it('sends currentUiMode to every tab with a numeric id', async () => {
    chromeMock.tabs.query.mockResolvedValue([
      { id: 1 } as chrome.tabs.Tab,
      { id: 2 } as chrome.tabs.Tab,
      { id: undefined } as chrome.tabs.Tab,
    ]);

    await broadcastUiMode('floating');

    expect(chromeMock.tabs.query).toHaveBeenCalledWith({});
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledTimes(2);
    expect(chromeMock.tabs.sendMessage).toHaveBeenNthCalledWith(
      1,
      1,
      { command: 'currentUiMode', mode: 'floating' as UiMode },
      expect.any(Function)
    );
    expect(chromeMock.tabs.sendMessage).toHaveBeenNthCalledWith(
      2,
      2,
      { command: 'currentUiMode', mode: 'floating' as UiMode },
      expect.any(Function)
    );
  });

  it('suppresses runtime errors when a tab cannot receive the message', async () => {
    chromeMock.tabs.query.mockResolvedValue([{ id: 1 } as chrome.tabs.Tab]);

    chromeMock.tabs.sendMessage.mockImplementationOnce((_tabId, _message, callback) => {
      chromeMock.runtime.lastError = { message: 'No receiver' } as chrome.runtime.LastError;
      callback?.();
      chromeMock.runtime.lastError = undefined;
      return undefined;
    });

    await broadcastUiMode('popup');

    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
      1,
      { command: 'currentUiMode', mode: 'popup' as UiMode },
      expect.any(Function)
    );
  });
});

describe('commandHandlers.requestUiMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('responds with stored mode when available', async () => {
    chromeMock.storage.local.get.mockResolvedValueOnce({ 'arcline.uiMode.current': 'popup' });
    const handler = commandHandlers.requestUiMode;
    const sendResponse = vi.fn();

    const handled = handler?.({}, sendResponse);

    expect(handled).toBe(true);
    await flushAsync();

    expect(chromeMock.storage.local.get).toHaveBeenCalledWith('arcline.uiMode.current');
    expect(sendResponse).toHaveBeenCalledWith({ command: 'currentUiMode', mode: 'popup' });
  });

  it('falls back to floating mode when storage fails', async () => {
    chromeMock.storage.local.get.mockRejectedValueOnce(new Error('boom'));
    const handler = commandHandlers.requestUiMode;
    const sendResponse = vi.fn();

    handler?.({}, sendResponse);
    await flushAsync();

    expect(sendResponse).toHaveBeenCalledWith({ command: 'currentUiMode', mode: 'floating' });
  });
});

describe('commandHandlers.requestSpacesSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns spaces snapshot on success', async () => {
    const spaces: SpaceSnapshot[] = [
      {
        id: 123,
        name: 'Work',
        tabs: [],
        pinnedTabs: [],
        temporaryTabs: [],
        pinnedItems: [],
        color: 'blue',
        windowId: 1,
        created_at: 0,
        last_active_at: 0,
      },
    ];
    getSpacesSnapshotMock.mockResolvedValueOnce(spaces);
    const handler = commandHandlers.requestSpacesSnapshot;
    const sendResponse = vi.fn();

    const handled = handler?.({}, sendResponse);

    expect(handled).toBe(true);
    await flushAsync();

    expect(getSpacesSnapshotMock).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ command: 'spacesSnapshot', spaces });
  });

  it('sends empty list when snapshot fails', async () => {
    getSpacesSnapshotMock.mockRejectedValueOnce(new Error('nope'));
    const handler = commandHandlers.requestSpacesSnapshot;
    const sendResponse = vi.fn();

    handler?.({}, sendResponse);
    await flushAsync();

    expect(sendResponse).toHaveBeenCalledWith({ command: 'spacesSnapshot', spaces: [] });
  });
});

describe('commandHandlers.toggleTabPinned', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when tabId is missing', () => {
    const handler = commandHandlers.toggleTabPinned;
    const sendResponse = vi.fn();

    const handled = handler?.({}, sendResponse);

    expect(handled).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'tabId is required' });
  });

  it('toggles pin state and broadcasts snapshot', async () => {
    toggleTabPinnedMock.mockResolvedValueOnce(true);
    const handler = commandHandlers.toggleTabPinned;
    const sendResponse = vi.fn();

    const handled = handler?.({ tabId: 42, pinned: false }, sendResponse);

    expect(handled).toBe(true);
    await flushAsync();

    expect(toggleTabPinnedMock).toHaveBeenCalledWith(42, false);
    expect(broadcastSpacesSnapshotMock).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, pinned: true });
  });

  it('reports errors when toggleTabPinned rejects', async () => {
    toggleTabPinnedMock.mockRejectedValueOnce(new Error('failure'));
    const handler = commandHandlers.toggleTabPinned;
    const sendResponse = vi.fn();

    handler?.({ tabId: 7 }, sendResponse);
    await flushAsync();

    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'failure' });
  });
});

describe('commandHandlers.searchHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls searchHistory with query and returns results', async () => {
    const mockResults = [
      { id: 'h1', title: 'Test History', type: 'history' as const, url: 'http://test.com' },
    ];
    searchHistoryMock.mockResolvedValueOnce(mockResults);
    const handler = commandHandlers.searchHistory;
    const sendResponse = vi.fn();

    handler?.({ query: 'test' }, sendResponse);
    await flushAsync();

    expect(searchHistoryMock).toHaveBeenCalledWith('test', undefined);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: mockResults });
  });
});

describe('commandHandlers.searchBookmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls searchBookmarks with query and returns results', async () => {
    const mockResults = [
      { id: 'b1', title: 'Test Bookmark', type: 'bookmark' as const, url: 'http://bookmark.com' },
    ];
    searchBookmarksMock.mockResolvedValueOnce(mockResults);
    const handler = commandHandlers.searchBookmarks;
    const sendResponse = vi.fn();

    handler?.({ query: 'bookmark' }, sendResponse);
    await flushAsync();

    expect(searchBookmarksMock).toHaveBeenCalledWith('bookmark', undefined);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: mockResults });
  });
});
