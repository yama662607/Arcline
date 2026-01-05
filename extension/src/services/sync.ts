import { db, type ItemRecord, type SpaceRecord } from '@/db';
import { searchService } from '@/services/search';

/**
 * Sync service for keeping IndexedDB in sync with Chrome Bookmarks.
 * This enables:
 * 1. Fast full-text search via FlexSearch
 * 2. Offline access to bookmark data
 * 3. Future: Primary storage for spaces
 */

const ARCLINE_ROOT_FOLDER = 'Arcline';

/**
 * Initialize the sync service by loading data from Chrome Bookmarks into IndexedDB.
 * Should be called when the extension starts.
 */
export async function initializeSync(): Promise<void> {
  try {
    console.log('[Arcline] Starting bookmark sync initialization...');
    await syncBookmarksToDb();
    await searchService.buildIndex();
    setupBookmarkListeners();
    console.log('[Arcline] Bookmark sync initialization complete.');
  } catch (error) {
    console.error('[Arcline] Failed to initialize sync:', error);
  }
}

/**
 * Sync all Arcline bookmarks from Chrome to IndexedDB.
 */
async function syncBookmarksToDb(): Promise<void> {
  // Find the Arcline root folder
  const searchResults = await chrome.bookmarks.search({ title: ARCLINE_ROOT_FOLDER });
  const arclineFolder = searchResults.find((b) => !b.url && b.title === ARCLINE_ROOT_FOLDER);

  if (!arclineFolder) {
    console.log('[Arcline] No Arcline bookmark folder found, skipping sync.');
    return;
  }

  // Get all children (spaces)
  const children = await chrome.bookmarks.getChildren(arclineFolder.id);

  // Clear existing data (full sync)
  await db.transaction('rw', [db.spaces, db.items], async () => {
    await db.spaces.clear();
    await db.items.clear();

    for (const child of children) {
      if (!child.url) {
        // This is a space folder
        const spaceId = await syncSpaceFolder(child);
        if (spaceId) {
          await syncSpaceItems(child.id, spaceId);
        }
      }
    }
  });

  const spaceCount = await db.spaces.count();
  const itemCount = await db.items.count();
  console.log(`[Arcline] Synced ${spaceCount} spaces and ${itemCount} items to IndexedDB.`);
}

/**
 * Sync a space folder to IndexedDB.
 */
async function syncSpaceFolder(
  folder: chrome.bookmarks.BookmarkTreeNode
): Promise<number | undefined> {
  const now = new Date();
  const space: SpaceRecord = {
    uuid: folder.id, // Use Chrome bookmark ID as UUID for now
    name: folder.title,
    color: 'blue', // Default color, could be stored in metadata later
    sortOrder: folder.index ?? 0,
    isActive: false,
    createdAt: now,
    updatedAt: now,
  };

  return await db.spaces.add(space);
}

/**
 * Sync items (bookmarks/folders) within a space to IndexedDB.
 */
async function syncSpaceItems(folderId: string, spaceId: number, parentId?: number): Promise<void> {
  const children = await chrome.bookmarks.getChildren(folderId);
  let sortOrder = 0;

  for (const child of children) {
    const now = new Date();
    const item: ItemRecord = {
      spaceId,
      type: child.url ? 'bookmark' : 'folder',
      title: child.title,
      url: child.url,
      parentId,
      sortOrder: sortOrder++,
      bookmarkId: child.id,
      createdAt: now,
      updatedAt: now,
    };

    const itemId = await db.items.add(item);

    // Recursively sync folder contents
    if (!child.url && itemId) {
      await syncSpaceItems(child.id, spaceId, itemId as number);
    }
  }
}

/**
 * Set up listeners for Chrome bookmark events to keep IndexedDB in sync.
 */
function setupBookmarkListeners(): void {
  // Listen for bookmark creation
  chrome.bookmarks.onCreated.addListener(async (_id, bookmark) => {
    try {
      await handleBookmarkCreated(bookmark);
    } catch (error) {
      console.error('[Arcline] Error handling bookmark creation:', error);
    }
  });

  // Listen for bookmark changes
  chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
    try {
      await handleBookmarkChanged(id, changeInfo);
    } catch (error) {
      console.error('[Arcline] Error handling bookmark change:', error);
    }
  });

  // Listen for bookmark removal
  chrome.bookmarks.onRemoved.addListener(async (id, _removeInfo) => {
    try {
      await handleBookmarkRemoved(id);
    } catch (error) {
      console.error('[Arcline] Error handling bookmark removal:', error);
    }
  });

  // Listen for bookmark moves
  chrome.bookmarks.onMoved.addListener(async (id, moveInfo) => {
    try {
      await handleBookmarkMoved(id, moveInfo);
    } catch (error) {
      console.error('[Arcline] Error handling bookmark move:', error);
    }
  });

  console.log('[Arcline] Bookmark event listeners registered.');
}

async function handleBookmarkCreated(bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<void> {
  // Check if this bookmark is within an Arcline space
  const item = await db.items
    .where('bookmarkId')
    .equals(bookmark.parentId ?? '')
    .first();

  if (!item) {
    // Parent not found in our DB, might be a space-level item
    // Check if parent is an Arcline space folder
    const space = await db.spaces
      .where('uuid')
      .equals(bookmark.parentId ?? '')
      .first();
    if (!space || !space.id) return;

    // Add item to the space
    const now = new Date();
    const newItem: ItemRecord = {
      spaceId: space.id,
      type: bookmark.url ? 'bookmark' : 'folder',
      title: bookmark.title,
      url: bookmark.url,
      sortOrder: bookmark.index ?? 0,
      bookmarkId: bookmark.id,
      createdAt: now,
      updatedAt: now,
    };

    const itemId = await db.items.add(newItem);
    if (itemId) {
      const addedItem = await db.items.get(itemId);
      if (addedItem) {
        searchService.updateItem(addedItem);
      }
    }
    return;
  }

  // Add item with parent reference
  const now = new Date();
  const newItem: ItemRecord = {
    spaceId: item.spaceId,
    type: bookmark.url ? 'bookmark' : 'folder',
    title: bookmark.title,
    url: bookmark.url,
    parentId: item.id,
    sortOrder: bookmark.index ?? 0,
    bookmarkId: bookmark.id,
    createdAt: now,
    updatedAt: now,
  };

  const itemId = await db.items.add(newItem);
  if (itemId) {
    const addedItem = await db.items.get(itemId);
    if (addedItem) {
      searchService.updateItem(addedItem);
    }
  }
}

async function handleBookmarkChanged(
  id: string,
  changeInfo: { title?: string; url?: string }
): Promise<void> {
  const item = await db.items.where('bookmarkId').equals(id).first();
  if (!item || !item.id) return;

  const now = new Date();
  await db.items.update(item.id, {
    title: changeInfo.title ?? item.title,
    url: changeInfo.url ?? item.url,
    updatedAt: now,
  });

  const updatedItem = await db.items.get(item.id);
  if (updatedItem) {
    searchService.updateItem(updatedItem);
  }
}

async function handleBookmarkRemoved(id: string): Promise<void> {
  const item = await db.items.where('bookmarkId').equals(id).first();
  if (!item || !item.id) return;

  // Remove from search index
  searchService.removeItem(item.id);

  // Remove all children recursively
  const children = await db.items.where('parentId').equals(item.id).toArray();
  for (const child of children) {
    if (child.bookmarkId) {
      await handleBookmarkRemoved(child.bookmarkId);
    }
  }

  // Remove the item itself
  await db.items.delete(item.id);
}

async function handleBookmarkMoved(
  id: string,
  moveInfo: { parentId: string; index: number; oldParentId: string; oldIndex: number }
): Promise<void> {
  const item = await db.items.where('bookmarkId').equals(id).first();
  if (!item || !item.id) return;

  // Find new parent
  let newParentId: number | undefined;
  const parentItem = await db.items.where('bookmarkId').equals(moveInfo.parentId).first();
  if (parentItem) {
    newParentId = parentItem.id;
  } else {
    // Check if parent is a space
    const space = await db.spaces.where('uuid').equals(moveInfo.parentId).first();
    if (space) {
      // Moving to space root, no parentId
      newParentId = undefined;
    }
  }

  const now = new Date();
  await db.items.update(item.id, {
    parentId: newParentId,
    sortOrder: moveInfo.index,
    updatedAt: now,
  });
}

/**
 * Force a full resync of bookmarks to IndexedDB.
 */
export async function forceResync(): Promise<void> {
  await syncBookmarksToDb();
  await searchService.buildIndex();
}
