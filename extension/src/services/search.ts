import { Index } from 'flexsearch';
import { db, type ItemRecord, type SpaceRecord } from '@/db';

/**
 * Search result item returned by the search service.
 */
export interface SearchResultItem {
  id: number;
  type: 'space' | 'item';
  title: string;
  url?: string;
  spaceId?: number;
  spaceName?: string;
  itemType?: ItemRecord['type'];
}

/**
 * SearchService manages a FlexSearch index for fast full-text search
 * across spaces and items stored in IndexedDB.
 *
 * Uses separate indexes for spaces and items to support typed results.
 */
export class SearchService {
  private spaceIndex: Index;
  private itemIndex: Index;
  private spaceCache: Map<number, SpaceRecord> = new Map();
  private itemCache: Map<number, ItemRecord> = new Map();
  private isInitialized = false;

  constructor() {
    this.spaceIndex = new Index({
      tokenize: 'forward',
      resolution: 9,
    });

    this.itemIndex = new Index({
      tokenize: 'forward',
      resolution: 9,
    });
  }

  /**
   * Build the search index from IndexedDB data.
   * Call this on extension startup or when data changes significantly.
   */
  async buildIndex(): Promise<void> {
    // Clear existing indexes
    this.spaceIndex = new Index({
      tokenize: 'forward',
      resolution: 9,
    });
    this.itemIndex = new Index({
      tokenize: 'forward',
      resolution: 9,
    });
    this.spaceCache.clear();
    this.itemCache.clear();

    // Load all spaces from DB
    const spaces = await db.spaces.toArray();
    for (const space of spaces) {
      if (space.id !== undefined) {
        this.spaceCache.set(space.id, space);
        this.spaceIndex.add(space.id, space.name);
      }
    }

    // Load all items from DB
    const items = await db.items.toArray();
    for (const item of items) {
      if (item.id !== undefined) {
        this.itemCache.set(item.id, item);
        // Combine title and url for searching
        const content = [item.title, item.url].filter(Boolean).join(' ');
        this.itemIndex.add(item.id, content);
      }
    }

    this.isInitialized = true;
  }

  /** Add or update a space in the index. */
  updateSpace(space: SpaceRecord): void {
    if (space.id !== undefined) {
      this.spaceCache.set(space.id, space);
      this.spaceIndex.update(space.id, space.name);
    }
  }

  /** Remove a space from the index. */
  removeSpace(spaceId: number): void {
    this.spaceCache.delete(spaceId);
    this.spaceIndex.remove(spaceId);
  }

  /** Add or update an item in the index. */
  updateItem(item: ItemRecord): void {
    if (item.id !== undefined) {
      this.itemCache.set(item.id, item);
      const content = [item.title, item.url].filter(Boolean).join(' ');
      this.itemIndex.update(item.id, content);
    }
  }

  /** Remove an item from the index. */
  removeItem(itemId: number): void {
    this.itemCache.delete(itemId);
    this.itemIndex.remove(itemId);
  }

  /**
   * Search across both spaces and items.
   * @param query - The search query string
   * @param limit - Maximum number of results to return (default: 20)
   * @returns Array of search results
   */
  async search(query: string, limit = 20): Promise<SearchResultItem[]> {
    if (!query.trim()) {
      return [];
    }

    // Ensure index is ready
    if (!this.isInitialized) {
      await this.buildIndex();
    }

    const results: SearchResultItem[] = [];

    // Search spaces
    const spaceIds = this.spaceIndex.search(query, limit) as number[];
    for (const id of spaceIds) {
      const space = this.spaceCache.get(id);
      if (space) {
        results.push({
          id,
          type: 'space',
          title: space.name,
        });
      }
    }

    // Search items
    const itemIds = this.itemIndex.search(query, limit) as number[];
    for (const id of itemIds) {
      const item = this.itemCache.get(id);
      if (item) {
        const space = this.spaceCache.get(item.spaceId);
        results.push({
          id,
          type: 'item',
          title: item.title,
          url: item.url,
          spaceId: item.spaceId,
          spaceName: space?.name,
          itemType: item.type,
        });
      }
    }

    // Dedupe and limit
    const seen = new Set<string>();
    const deduped: SearchResultItem[] = [];
    for (const result of results) {
      const key = `${result.type}-${result.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(result);
        if (deduped.length >= limit) break;
      }
    }

    return deduped;
  }
}

// Singleton instance for background script
export const searchService = new SearchService();
