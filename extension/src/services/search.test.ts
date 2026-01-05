import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArclineDatabase } from '@/db/schema';
import { SearchService } from './search';

// Use fresh instances for each test
let db: ArclineDatabase;
let searchService: SearchService;

beforeEach(async () => {
  db = new ArclineDatabase();
  await db.open();
  searchService = new SearchService();
});

afterEach(async () => {
  await db.delete();
});

describe('SearchService', () => {
  describe('buildIndex', () => {
    it('should build index from database contents', async () => {
      // Add test data
      const spaceId = await db.spaces.add({
        uuid: 'space-1',
        name: 'Work Projects',
        color: 'blue',
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.items.add({
        spaceId: spaceId as number,
        type: 'tab',
        title: 'GitHub Repository',
        url: 'https://github.com',
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Build index
      await searchService.buildIndex();

      // Search for spaces
      const spaceResults = await searchService.search('Work');
      expect(spaceResults.length).toBeGreaterThan(0);
      expect(spaceResults.some((r) => r.type === 'space' && r.title === 'Work Projects')).toBe(
        true
      );

      // Search for items
      const itemResults = await searchService.search('GitHub');
      expect(itemResults.length).toBeGreaterThan(0);
      expect(itemResults.some((r) => r.type === 'item' && r.title === 'GitHub Repository')).toBe(
        true
      );
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      // Add test data
      const spaceId = await db.spaces.add({
        uuid: 'space-1',
        name: 'Personal',
        color: 'green',
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.items.bulkAdd([
        {
          spaceId: spaceId as number,
          type: 'tab',
          title: 'Google Search',
          url: 'https://google.com',
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          spaceId: spaceId as number,
          type: 'bookmark',
          title: 'Stack Overflow',
          url: 'https://stackoverflow.com',
          sortOrder: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await searchService.buildIndex();
    });

    it('should return empty array for empty query', async () => {
      const results = await searchService.search('');
      expect(results).toEqual([]);
    });

    it('should return empty array for whitespace-only query', async () => {
      const results = await searchService.search('   ');
      expect(results).toEqual([]);
    });

    it('should find items by title', async () => {
      const results = await searchService.search('Google');
      expect(results.length).toBe(1);
      expect(results[0]?.title).toBe('Google Search');
    });

    it('should find items by URL', async () => {
      const results = await searchService.search('stackoverflow');
      expect(results.length).toBe(1);
      expect(results[0]?.title).toBe('Stack Overflow');
    });

    it('should find spaces by name', async () => {
      const results = await searchService.search('Personal');
      expect(results.length).toBe(1);
      expect(results[0]?.type).toBe('space');
    });

    it('should respect limit parameter', async () => {
      // Add more items
      const space = await db.spaces.where('name').equals('Personal').first();
      await db.items.bulkAdd(
        Array.from({ length: 30 }, (_, i) => ({
          spaceId: space?.id ?? 1,
          type: 'bookmark' as const,
          title: `Result ${i}`,
          url: `https://example${i}.com`,
          sortOrder: i + 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      );

      await searchService.buildIndex();

      const results = await searchService.search('Result', 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('incremental updates', () => {
    beforeEach(async () => {
      await searchService.buildIndex();
    });

    it('should update space in the index', async () => {
      const spaceId = await db.spaces.add({
        uuid: 'space-new',
        name: 'NewSpace',
        color: 'red',
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const space = await db.spaces.get(spaceId);
      if (space) {
        searchService.updateSpace(space);
      }

      const results = await searchService.search('NewSpace');
      expect(results.length).toBe(1);
    });

    it('should remove space from the index', async () => {
      const spaceId = await db.spaces.add({
        uuid: 'space-temp',
        name: 'TempSpace',
        color: 'red',
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const space = await db.spaces.get(spaceId);
      if (space) {
        searchService.updateSpace(space);
      }

      // Verify it's findable
      let results = await searchService.search('TempSpace');
      expect(results.length).toBe(1);

      // Remove it
      searchService.removeSpace(spaceId as number);

      // Verify it's gone
      results = await searchService.search('TempSpace');
      expect(results.length).toBe(0);
    });
  });
});
