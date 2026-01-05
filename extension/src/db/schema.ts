import Dexie, { type EntityTable } from 'dexie';

/**
 * Represents a Space in the Arcline database.
 */
export interface SpaceRecord {
  id?: number;
  uuid: string;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  tabGroupId?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents a pinned item (tab, folder, or bookmark) in a Space.
 */
export interface ItemRecord {
  id?: number;
  spaceId: number;
  type: 'tab' | 'folder' | 'bookmark';
  title: string;
  url?: string;
  faviconUrl?: string;
  parentId?: number;
  sortOrder: number;
  bookmarkId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Arcline IndexedDB Database using Dexie.js
 */
export class ArclineDatabase extends Dexie {
  spaces!: EntityTable<SpaceRecord, 'id'>;
  items!: EntityTable<ItemRecord, 'id'>;

  constructor() {
    super('ArclineDB');

    this.version(1).stores({
      spaces: '++id, uuid, name, sortOrder, isActive, tabGroupId',
      items: '++id, spaceId, type, parentId, bookmarkId, [spaceId+type]',
    });
  }
}

// Singleton instance
export const db = new ArclineDatabase();
