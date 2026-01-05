import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArclineDatabase } from '@/db/schema';

// Mock Chrome APIs
const mockBookmarks = {
  search: vi.fn(),
  getChildren: vi.fn(),
  getSubTree: vi.fn(),
  onCreated: { addListener: vi.fn() },
  onChanged: { addListener: vi.fn() },
  onRemoved: { addListener: vi.fn() },
  onMoved: { addListener: vi.fn() },
};

vi.stubGlobal('chrome', {
  bookmarks: mockBookmarks,
});

// Import after mocking
import { initializeSync, forceResync, getArclineRootFolderId } from './sync';

let db: ArclineDatabase;

beforeEach(async () => {
  db = new ArclineDatabase();
  await db.open();

  // Reset mocks
  vi.clearAllMocks();
});

afterEach(async () => {
  await db.delete();
});

describe('Sync Service', () => {
  describe('initializeSync', () => {
    it('should register bookmark event listeners', async () => {
      mockBookmarks.search.mockResolvedValue([]);
      mockBookmarks.getSubTree.mockResolvedValue([]);

      await initializeSync();

      expect(mockBookmarks.onCreated.addListener).toHaveBeenCalled();
      expect(mockBookmarks.onChanged.addListener).toHaveBeenCalled();
      expect(mockBookmarks.onRemoved.addListener).toHaveBeenCalled();
      expect(mockBookmarks.onMoved.addListener).toHaveBeenCalled();
    });

    it('should skip sync when Arcline folder not found', async () => {
      mockBookmarks.search.mockResolvedValue([]);
      mockBookmarks.getSubTree.mockResolvedValue([]);

      await initializeSync();

      const spaces = await db.spaces.toArray();
      expect(spaces).toHaveLength(0);
      expect(getArclineRootFolderId()).toBeNull();
    });

    it('should sync spaces and items when Arcline folder exists', async () => {
      // Mock Arcline root folder search (still needed to find ID)
      mockBookmarks.search.mockResolvedValue([
        { id: 'arcline-root', title: 'Arcline', url: undefined },
      ]);

      // Mock getSubTree returning full structure
      mockBookmarks.getSubTree.mockResolvedValue([
        {
          id: 'arcline-root',
          title: 'Arcline',
          children: [
            {
              id: 'space-1',
              title: 'Work',
              url: undefined,
              index: 0,
              children: [
                { id: 'bm-1', title: 'GitHub', url: 'https://github.com', index: 0, children: [] },
              ],
            },
            {
              id: 'space-2',
              title: 'Personal',
              url: undefined,
              index: 1,
              children: [],
            },
          ],
        },
      ]);

      await initializeSync();

      const spaces = await db.spaces.toArray();
      expect(spaces).toHaveLength(2);
      expect(spaces[0]?.name).toBe('Work');
      expect(spaces[1]?.name).toBe('Personal');

      const items = await db.items.toArray();
      expect(items).toHaveLength(1);
      expect(items[0]?.title).toBe('GitHub');

      // Should store root folder ID
      expect(getArclineRootFolderId()).toBe('arcline-root');
    });

    it('should sync nested folders correctly', async () => {
      mockBookmarks.search.mockResolvedValue([
        { id: 'arcline-root', title: 'Arcline', url: undefined },
      ]);

      mockBookmarks.getSubTree.mockResolvedValue([
        {
          id: 'arcline-root',
          title: 'Arcline',
          children: [
            {
              id: 'space-1',
              title: 'Work',
              index: 0,
              children: [
                {
                  id: 'folder-1',
                  title: 'Design',
                  index: 0,
                  children: [
                    {
                      id: 'bm-2',
                      title: 'Figma',
                      url: 'https://figma.com',
                      index: 0,
                      children: [],
                    },
                  ],
                },
                { id: 'bm-1', title: 'GitHub', url: 'https://github.com', index: 1, children: [] },
              ],
            },
          ],
        },
      ]);

      await initializeSync();

      const items = await db.items.toArray();
      expect(items).toHaveLength(3); // folder + 2 bookmarks

      const folder = items.find((i) => i.type === 'folder');
      expect(folder?.title).toBe('Design');

      const figma = items.find((i) => i.title === 'Figma');
      expect(figma?.parentId).toBe(folder?.id);
    });
  });

  describe('forceResync', () => {
    it('should clear and resync data', async () => {
      // Add some existing data
      await db.spaces.add({
        uuid: 'old-space',
        name: 'Old Space',
        color: 'red',
        sortOrder: 0,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockBookmarks.search.mockResolvedValue([
        { id: 'arcline-root', title: 'Arcline', url: undefined },
      ]);

      mockBookmarks.getSubTree.mockResolvedValue([
        {
          id: 'arcline-root',
          title: 'Arcline',
          children: [
            { id: 'new-space', title: 'New Space', url: undefined, index: 0, children: [] },
          ],
        },
      ]);

      await forceResync();

      const spaces = await db.spaces.toArray();
      expect(spaces).toHaveLength(1);
      expect(spaces[0]?.name).toBe('New Space');
    });
  });

  describe('bookmark event handlers', () => {
    // These tests verify the structure; actual event handling is tested via integration

    it('should have all event listeners registered', async () => {
      mockBookmarks.search.mockResolvedValue([]);

      await initializeSync();

      expect(mockBookmarks.onCreated.addListener).toHaveBeenCalledTimes(1);
      expect(mockBookmarks.onChanged.addListener).toHaveBeenCalledTimes(1);
      expect(mockBookmarks.onRemoved.addListener).toHaveBeenCalledTimes(1);
      expect(mockBookmarks.onMoved.addListener).toHaveBeenCalledTimes(1);
    });
  });
});
