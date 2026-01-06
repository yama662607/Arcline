import { Index } from 'flexsearch';
import type { SearchResult } from '@/shared/types';
import { getSpacesSnapshot } from './browser';

let index: Index | null = null;

/**
 * Initialize the search index by loading all data from Dexie.
 * This should be called on extension startup or when a full re-index is needed.
 */
export async function initializeSearch(): Promise<void> {
  await initializeSearchV2();
}

// Re-write to use internal ID counter
let internalIdCounter = 0;
const internalIdToResultMap = new Map<number, SearchResult>();

export async function buildIndex(): Promise<void> {
  await initializeSearchV2();
}

async function initializeSearchV2() {
  console.log('[Arcline] Building Search Index...');
  const t0 = performance.now();

  index = new Index({
    tokenize: 'forward',
    resolution: 9,
    cache: true,
  });

  internalIdCounter = 0;
  internalIdToResultMap.clear();

  const spaces = await getSpacesSnapshot();

  for (const space of spaces) {
    // Index Pinned Items
    for (const item of space.pinnedItems) {
      if (item.type === 'tab') {
        addItemToIndex({
          id: String(item.tabId || item.id), // This ID is what the UI expects
          title: item.title,
          url: item.url,
          type: 'tab',
          favIconUrl: item.favIconUrl,
          description: `Pinned in ${space.name}`,
        });
      }
    }

    // Tablets
    for (const tab of [...space.tabs, ...space.temporaryTabs]) {
      addItemToIndex({
        id: String(tab.id),
        title: tab.title,
        url: tab.url,
        type: 'tab',
        favIconUrl: tab.favIconUrl,
        description: space.name,
      });
    }

    // Space
    addItemToIndex({
      id: String(space.id),
      title: space.name,
      type: 'space',
      // url: null
      description: 'Space',
    });
  }

  const t1 = performance.now();
  console.log(
    `[Arcline] Search Index built in ${(t1 - t0).toFixed(2)}ms (${internalIdCounter} items)`
  );
}

function addItemToIndex(item: SearchResult) {
  if (!index) return;

  const internalId = internalIdCounter++;
  const content = [item.title, item.url, item.description].filter(Boolean).join(' ');

  index.add(internalId, content);
  internalIdToResultMap.set(internalId, item);
}

export async function searchLocal(query: string, limit = 50): Promise<SearchResult[]> {
  if (!index) {
    // Auto-initialize if not ready (e.g. service worker woke up)
    await initializeSearchV2();
  }

  if (!query.trim() || !index) return [];

  const results: SearchResult[] = [];
  // FlexSearch synchronous search
  const matchedIds = index.search(query, limit);

  for (const internalId of matchedIds) {
    const item = internalIdToResultMap.get(internalId as number);
    if (item) {
      results.push(item);
    }
  }

  return results;
}
