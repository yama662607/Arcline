import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArclineDatabase } from '@/db/schema';

// Mock Chrome APIs
const mockBookmarks = {
  search: vi.fn(),
  getChildren: vi.fn(),
  onCreated: { addListener: vi.fn() },
  onChanged: { addListener: vi.fn() },
  onRemoved: { addListener: vi.fn() },
  onMoved: { addListener: vi.fn() },
};

vi.stubGlobal('chrome', {
  bookmarks: mockBookmarks,
});

// Import after mocking
import { initializeSync, forceResync } from './sync';

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

      await initializeSync();

      expect(mockBookmarks.onCreated.addListener).toHaveBeenCalled();
      expect(mockBookmarks.onChanged.addListener).toHaveBeenCalled();
      expect(mockBookmarks.onRemoved.addListener).toHaveBeenCalled();
      expect(mockBookmarks.onMoved.addListener).toHaveBeenCalled();
    });

    it('should skip sync when Arcline folder not found', async () => {
      mockBookmarks.search.mockResolvedValue([]);

      await initializeSync();

      const spaces = await db.spaces.toArray();
      expect(spaces).toHaveLength(0);
    });

    it('should sync spaces and items when Arcline folder exists', async () => {
      // Mock Arcline root folder
      mockBookmarks.search.mockResolvedValue([
        { id: 'arcline-root', title: 'Arcline', url: undefined },
      ]);

      // Mock space folders
      mockBookmarks.getChildren.mockImplementation((id: string) => {
        if (id === 'arcline-root') {
          return Promise.resolve([
            { id: 'space-1', title: 'Work', url: undefined, index: 0 },
            { id: 'space-2', title: 'Personal', url: undefined, index: 1 },
          ]);
        }
        if (id === 'space-1') {
          return Promise.resolve([
            { id: 'bm-1', title: 'GitHub', url: 'https://github.com', index: 0 },
          ]);
        }
        if (id === 'space-2') {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      await initializeSync();

      const spaces = await db.spaces.toArray();
      expect(spaces).toHaveLength(2);
      expect(spaces[0]?.name).toBe('Work');
      expect(spaces[1]?.name).toBe('Personal');

      const items = await db.items.toArray();
      expect(items).toHaveLength(1);
      expect(items[0]?.title).toBe('GitHub');
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
      mockBookmarks.getChildren.mockImplementation((id: string) => {
        if (id === 'arcline-root') {
          return Promise.resolve([
            { id: 'new-space', title: 'New Space', url: undefined, index: 0 },
          ]);
        }
        return Promise.resolve([]);
      });

      await forceResync();

      const spaces = await db.spaces.toArray();
      expect(spaces).toHaveLength(1);
      expect(spaces[0]?.name).toBe('New Space');
    });
  });
});
