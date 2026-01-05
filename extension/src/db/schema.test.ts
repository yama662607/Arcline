import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArclineDatabase, type ItemRecord, type SpaceRecord } from './schema';

// Use a fresh database instance for each test
let db: ArclineDatabase;

beforeEach(async () => {
  db = new ArclineDatabase();
  await db.open();
});

afterEach(async () => {
  await db.delete();
});

describe('ArclineDatabase', () => {
  describe('spaces table', () => {
    it('should add and retrieve a space', async () => {
      const space: SpaceRecord = {
        uuid: 'test-uuid-1',
        name: 'Work',
        color: 'blue',
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const id = await db.spaces.add(space);
      const retrieved = await db.spaces.get(id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Work');
      expect(retrieved?.uuid).toBe('test-uuid-1');
    });

    it('should find space by uuid index', async () => {
      await db.spaces.add({
        uuid: 'unique-uuid',
        name: 'Personal',
        color: 'green',
        sortOrder: 1,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const found = await db.spaces.where('uuid').equals('unique-uuid').first();
      expect(found?.name).toBe('Personal');
    });

    it('should list active spaces', async () => {
      await db.spaces.bulkAdd([
        {
          uuid: 'uuid-1',
          name: 'Active1',
          color: 'red',
          sortOrder: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          uuid: 'uuid-2',
          name: 'Inactive',
          color: 'gray',
          sortOrder: 1,
          isActive: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          uuid: 'uuid-3',
          name: 'Active2',
          color: 'blue',
          sortOrder: 2,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      // Note: Boolean fields cannot be queried directly via index in IndexedDB.
      // Use filter on the collection or store isActive as 0/1.
      const activeSpaces = await db.spaces.filter((s) => s.isActive === true).toArray();
      expect(activeSpaces.length).toBe(2);
    });
  });

  describe('items table', () => {
    it('should add and retrieve an item', async () => {
      const spaceId = await db.spaces.add({
        uuid: 'space-uuid',
        name: 'Test Space',
        color: 'blue',
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const item: ItemRecord = {
        spaceId: spaceId as number,
        type: 'tab',
        title: 'GitHub',
        url: 'https://github.com',
        faviconUrl: 'https://github.com/favicon.ico',
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const itemId = await db.items.add(item);
      const retrieved = await db.items.get(itemId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('GitHub');
      expect(retrieved?.url).toBe('https://github.com');
    });

    it('should query items by spaceId using compound index', async () => {
      const spaceId = 1;

      await db.items.bulkAdd([
        {
          spaceId,
          type: 'tab',
          title: 'Tab 1',
          url: 'https://example1.com',
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          spaceId,
          type: 'bookmark',
          title: 'Bookmark 1',
          url: 'https://example2.com',
          sortOrder: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          spaceId: 2, // Different space
          type: 'tab',
          title: 'Tab 2',
          url: 'https://example3.com',
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const space1Items = await db.items.where('spaceId').equals(spaceId).toArray();
      expect(space1Items.length).toBe(2);

      // Use compound index to get only tabs from space 1
      const space1Tabs = await db.items.where('[spaceId+type]').equals([spaceId, 'tab']).toArray();
      expect(space1Tabs.length).toBe(1);
      expect(space1Tabs[0]?.title).toBe('Tab 1');
    });

    it('should support bulk operations efficiently', async () => {
      const items: ItemRecord[] = Array.from({ length: 100 }, (_, i) => ({
        spaceId: 1,
        type: 'bookmark' as const,
        title: `Bookmark ${i}`,
        url: `https://example${i}.com`,
        sortOrder: i,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await db.items.bulkAdd(items);
      const count = await db.items.count();
      expect(count).toBe(100);
    });
  });
});
