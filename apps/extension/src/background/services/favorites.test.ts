/// <reference types="chrome" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TabEntry } from '@/shared/types';
import {
  addToFavorites,
  getFavorites,
  isInFavorites,
  removeFromFavorites,
  reorderFavorites,
  toggleFavorite,
} from './favorites';

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn((keys) => {
        if (typeof keys === 'string') {
          return Promise.resolve({ [keys]: mockStorage[keys] });
        }
        return Promise.resolve(mockStorage);
      }),
      set: vi.fn((items) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
    },
  },
} as any;

const createMockTab = (id: number, url: string, title: string): TabEntry => ({
  id,
  url,
  title,
  pinned: false,
  active: false,
  windowId: 1,
  groupId: -1,
});

describe('Favorites Service', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach((key) => {
      delete mockStorage[key];
    });
    vi.clearAllMocks();
  });

  describe('getFavorites', () => {
    it('should return empty array when no favorites exist', async () => {
      const favorites = await getFavorites();
      expect(favorites).toEqual([]);
    });

    it('should return stored favorites', async () => {
      const mockFavorites = [
        {
          url: 'https://example.com',
          title: 'Example',
          addedAt: Date.now(),
        },
      ];
      mockStorage.arclineFavorites = mockFavorites;

      const favorites = await getFavorites();
      expect(favorites).toEqual(mockFavorites);
    });
  });

  describe('addToFavorites', () => {
    it('should add a tab to favorites', async () => {
      const tab = createMockTab(1, 'https://example.com', 'Example');

      await addToFavorites(tab);

      const favorites = await getFavorites();
      expect(favorites).toHaveLength(1);
      expect(favorites[0]?.url).toBe(tab.url);
      expect(favorites[0]?.title).toBe(tab.title);
      expect(favorites[0]?.addedAt).toBeDefined();
    });

    it('should not add duplicate favorites', async () => {
      const tab = createMockTab(1, 'https://example.com', 'Example');

      await addToFavorites(tab);
      await addToFavorites(tab);

      const favorites = await getFavorites();
      expect(favorites).toHaveLength(1);
    });

    it('should not add tab without URL', async () => {
      const tab = createMockTab(1, '', 'Example');

      await addToFavorites(tab);

      const favorites = await getFavorites();
      expect(favorites).toHaveLength(0);
    });
  });

  describe('removeFromFavorites', () => {
    it('should remove a favorite by URL', async () => {
      const tab = createMockTab(1, 'https://example.com', 'Example');

      await addToFavorites(tab);
      await removeFromFavorites(tab.url);

      const favorites = await getFavorites();
      expect(favorites).toHaveLength(0);
    });

    it('should do nothing if URL not found', async () => {
      await removeFromFavorites('https://nonexistent.com');

      const favorites = await getFavorites();
      expect(favorites).toHaveLength(0);
    });
  });

  describe('isInFavorites', () => {
    it('should return true if URL is in favorites', async () => {
      const tab = createMockTab(1, 'https://example.com', 'Example');

      await addToFavorites(tab);

      const result = await isInFavorites(tab.url);
      expect(result).toBe(true);
    });

    it('should return false if URL is not in favorites', async () => {
      const result = await isInFavorites('https://nonexistent.com');
      expect(result).toBe(false);
    });
  });

  describe('toggleFavorite', () => {
    it('should add tab if not in favorites', async () => {
      const tab = createMockTab(1, 'https://example.com', 'Example');

      const result = await toggleFavorite(tab);

      expect(result).toBe(true);
      const favorites = await getFavorites();
      expect(favorites).toHaveLength(1);
    });

    it('should remove tab if already in favorites', async () => {
      const tab = createMockTab(1, 'https://example.com', 'Example');

      await addToFavorites(tab);
      const result = await toggleFavorite(tab);

      expect(result).toBe(false);
      const favorites = await getFavorites();
      expect(favorites).toHaveLength(0);
    });
  });

  describe('reorderFavorites', () => {
    it('should reorder favorites', async () => {
      const tab1 = createMockTab(1, 'https://example1.com', 'Example 1');
      const tab2 = createMockTab(2, 'https://example2.com', 'Example 2');

      await addToFavorites(tab1);
      await addToFavorites(tab2);

      const favorites = await getFavorites();
      const fav1 = favorites[0];
      const fav2 = favorites[1];

      if (!fav1 || !fav2) {
        throw new Error('Favorites not found');
      }

      const reordered = [fav2, fav1];
      await reorderFavorites(reordered);

      const newFavorites = await getFavorites();
      expect(newFavorites[0]?.url).toBe(tab2.url);
      expect(newFavorites[1]?.url).toBe(tab1.url);
    });
  });
});
