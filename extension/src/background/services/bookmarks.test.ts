import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PinnedFolder, PinnedTab } from '@/shared/types';

// Mock Chrome APIs
const mockChrome = {
  bookmarks: {
    getTree: vi.fn(),
    getChildren: vi.fn(),
    create: vi.fn(),
    move: vi.fn(),
    removeTree: vi.fn(),
    update: vi.fn(),
    search: vi.fn(),
  },
};

// @ts-expect-error - Mocking global chrome
global.chrome = mockChrome;

// Import functions to test - IMPORTANT: Import AFTER mocking chrome
import {
  createPinnedFolder,
  createPinnedTab,
  exportSpaceBookmarks,
  getPinnedItemsForSpace,
  importSpaceBookmarks,
  movePinnedItem,
  removePinnedItem,
  searchBookmarks,
  updatePinnedItem,
} from './bookmarks';

describe('Bookmarks Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPinnedItemsForSpace', () => {
    it('should return empty list if space folder creation fails', async () => {
      // Setup mock to fail
      mockChrome.bookmarks.getTree.mockRejectedValue(new Error('Fail'));
      const items = await getPinnedItemsForSpace('Space');
      expect(items).toEqual([]);
    });

    it('should return recursive pinned items with parentId', async () => {
      // Mock getTree to return root
      mockChrome.bookmarks.getTree.mockResolvedValue([
        {
          id: '0',
          children: [
            {
              id: '1',
              children: [
                {
                  id: 'arcline',
                  title: 'Arcline',
                  children: [{ id: 'space1', title: 'Space1' }],
                },
              ],
            },
          ],
        },
      ]);

      // Mock getChildren for space folder
      mockChrome.bookmarks.getChildren.mockImplementation(async (id) => {
        if (id === 'arcline') return [{ id: 's1', title: 'Space1' }];
        if (id === 'space1' || id === 's1')
          return [
            { id: 'f1', title: 'Folder1', parentId: 's1' }, // Folder
            { id: 'b1', title: 'Book1', url: 'http://b1.com', parentId: 's1' }, // Bookmark
          ];
        if (id === 'f1')
          return [{ id: 'b2', title: 'Book2', url: 'http://b2.com', parentId: 'f1' }];
        return [];
      });

      const items = await getPinnedItemsForSpace('Space1');

      expect(items).toHaveLength(2);

      // Check folder
      const folder = items[0] as PinnedFolder;
      expect(folder.type).toBe('folder');
      expect(folder.title).toBe('Folder1');
      expect(folder.parentId).toBe('s1');
      expect(folder.children).toHaveLength(1);

      const nestedTab = folder.children[0] as PinnedTab;
      expect(nestedTab.url).toBe('http://b2.com');
      expect(nestedTab.parentId).toBe('f1');

      // Check bookmark
      const tab = items[1] as PinnedTab;
      expect(tab.type).toBe('tab');
      expect(tab.title).toBe('Book1');
      expect(tab.parentId).toBe('s1');
    });
  });

  describe('createPinnedFolder', () => {
    it('should create a folder inside space folder via chrome.bookmarks.create', async () => {
      // Mock space folder existence
      mockChrome.bookmarks.getTree.mockResolvedValue([
        {
          id: '0',
          children: [
            {
              id: '1',
              children: [
                { id: 'arcline', title: 'Arcline', children: [{ id: 's1', title: 'Space1' }] },
              ],
            },
          ],
        },
      ]);

      mockChrome.bookmarks.getChildren.mockImplementation(async (id) => {
        if (id === 'arcline') return [{ id: 's1', title: 'Space1' }];
        return [];
      });
      mockChrome.bookmarks.create.mockResolvedValue({
        id: 'new-f',
        title: 'New Folder',
        parentId: 's1',
      });

      const folder = await createPinnedFolder('Space1', 'New Folder');

      expect(mockChrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: 's1',
        title: 'New Folder',
      });
      expect(folder.parentId).toBe('s1');
    });
  });

  describe('createPinnedTab', () => {
    it('should create a tab with index if provided', async () => {
      // Mock space folder existence
      mockChrome.bookmarks.getTree.mockResolvedValue([
        {
          id: '0',
          children: [
            {
              id: '1',
              children: [
                { id: 'arcline', title: 'Arcline', children: [{ id: 's1', title: 'Space1' }] },
              ],
            },
          ],
        },
      ]);

      mockChrome.bookmarks.getChildren.mockImplementation(async (id) => {
        if (id === 'arcline') return [{ id: 's1', title: 'Space1' }];
        return [];
      });
      mockChrome.bookmarks.create.mockResolvedValue({
        id: 'new-t',
        title: 'Title',
        url: 'http://example.com',
        parentId: 's1',
      });

      await createPinnedTab('Space1', 'Title', 'http://example.com', undefined, undefined, 2);

      expect(mockChrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: 's1',
        title: 'Title',
        url: 'http://example.com',
        index: 2,
      });
    });
  });

  describe('exportSpaceBookmarks', () => {
    it('should generate HTML for bookmarks', async () => {
      // Setup simple structure
      mockChrome.bookmarks.getTree.mockResolvedValue([
        {
          id: '0',
          children: [
            {
              id: '1',
              children: [
                { id: 'arcline', title: 'Arcline', children: [{ id: 's1', title: 'Space1' }] },
              ],
            },
          ],
        },
      ]);

      mockChrome.bookmarks.getChildren.mockImplementation(async (id) => {
        if (id === 'arcline') return [{ id: 's1', title: 'Space1' }];
        if (id === 's1') return [{ id: 'b1', title: 'B1', url: 'http://b1.com' }];
        return [];
      });

      const html = await exportSpaceBookmarks('Space1');
      expect(html).toContain('<H1>Bookmarks</H1>');
      expect(html).toContain('<A HREF="http://b1.com">B1</A>');
    });
  });

  describe('importSpaceBookmarks', () => {
    it('should parse HTML and create bookmarks', async () => {
      mockChrome.bookmarks.getChildren.mockImplementation(async (id) => {
        if (id === 'arcline') return [{ id: 's1', title: 'Space1' }];
        return [];
      });

      const html = '<DT><A HREF="http://imported.com">Imported</A>';
      await importSpaceBookmarks('Space1', html);

      expect(mockChrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: 's1',
        title: 'Imported',
        url: 'http://imported.com',
      });
    });
  });

  describe('Manipulation functions', () => {
    // Re-setup mocks for simple calls
    beforeEach(() => {
      mockChrome.bookmarks.getTree.mockResolvedValue([
        {
          id: '0',
          children: [
            {
              id: '1',
              children: [
                { id: 'arcline', title: 'Arcline', children: [{ id: 's1', title: 'Space1' }] },
              ],
            },
          ],
        },
      ]);
      mockChrome.bookmarks.getChildren.mockImplementation(async (id) => {
        if (id === 'arcline') return [{ id: 's1', title: 'Space1' }];
        return [];
      });
    });

    it('movePinnedItem should call chrome.bookmarks.move with object dest', async () => {
      await movePinnedItem('id1', { parentId: 'parent1', index: 2 });
      expect(mockChrome.bookmarks.move).toHaveBeenCalledWith('id1', {
        parentId: 'parent1',
        index: 2,
      });
    });

    it('movePinnedItem should resolve space folder if parentId is missing but spaceName is provided', async () => {
      await movePinnedItem('id1', { spaceName: 'Space1', index: 0 });
      // It should look up 'Space1' -> 's1'
      expect(mockChrome.bookmarks.move).toHaveBeenCalledWith('id1', { parentId: 's1', index: 0 });
    });

    it('removePinnedItem should call chrome.bookmarks.removeTree', async () => {
      await removePinnedItem('id1');
      expect(mockChrome.bookmarks.removeTree).toHaveBeenCalledWith('id1');
    });

    it('updatePinnedItem should call chrome.bookmarks.update', async () => {
      await updatePinnedItem('id1', { title: 'New' });
      expect(mockChrome.bookmarks.update).toHaveBeenCalledWith('id1', { title: 'New' });
    });
  });
  describe('searchBookmarks', () => {
    it('searches bookmarks and returns mapping', async () => {
      mockChrome.bookmarks.search.mockResolvedValue([
        { id: '1', title: 'Result 1', url: 'http://res1.com' },
        { id: '2', title: 'Result 2', url: 'http://res2.com' },
      ]);
      const results = await searchBookmarks('query');
      expect(mockChrome.bookmarks.search).toHaveBeenCalledWith('query');
      expect(results).toHaveLength(2);
      expect(results[0]?.type).toBe('bookmark');
      expect(results[0]?.url).toBe('http://res1.com');
    });

    it('filters out folders (without url)', async () => {
      mockChrome.bookmarks.search.mockResolvedValue([
        { id: '1', title: 'Folder', dateAdded: 123 }, // no url -> folder
        { id: '2', title: 'Page', url: 'http://page.com' },
      ]);
      const results = await searchBookmarks('query');
      expect(results).toHaveLength(1);
      expect(results[0]?.title).toBe('Page');
    });
  });
});
