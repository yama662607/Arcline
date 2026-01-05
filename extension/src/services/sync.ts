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

// Store the Arcline root folder ID for event handling
let arclineRootFolderId: string | null = null;

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
    arclineRootFolderId = null;
    return;
  }

  // Store the root folder ID for event handling
  arclineRootFolderId = arclineFolder.id;

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
    uuid: folder.id, // Use Chrome bookmark ID as UUID
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

/**
 * Handle bookmark creation.
 * Handles both:
 * 1. New space folder (direct child of Arcline root)
 * 2. New item (bookmark/folder within a space)
 */
async function handleBookmarkCreated(bookmark: chrome.bookmarks.BookmarkTreeNode): Promise<void> {
  const parentId = bookmark.parentId ?? '';

  // Case 1: New space folder created under Arcline root
  if (arclineRootFolderId && parentId === arclineRootFolderId && !bookmark.url) {
    const now = new Date();
    const newSpace: SpaceRecord = {
      uuid: bookmark.id,
      name: bookmark.title,
      color: 'blue',
      sortOrder: bookmark.index ?? 0,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    };

    const spaceId = await db.spaces.add(newSpace);
    if (spaceId) {
      const addedSpace = await db.spaces.get(spaceId);
      if (addedSpace) {
        searchService.updateSpace(addedSpace);
      }
    }
    console.log(`[Arcline] New space synced: ${bookmark.title}`);
    return;
  }

  // Case 2: Check if parent is directly in items table
  const parentItem = await db.items.where('bookmarkId').equals(parentId).first();

  if (parentItem && parentItem.id) {
    // Add item with parent reference
    const now = new Date();
    const newItem: ItemRecord = {
      spaceId: parentItem.spaceId,
      type: bookmark.url ? 'bookmark' : 'folder',
      title: bookmark.title,
      url: bookmark.url,
      parentId: parentItem.id,
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

  // Case 3: Check if parent is a space folder (item at root of space)
  const space = await db.spaces.where('uuid').equals(parentId).first();
  if (!space || !space.id) return;

  // Add item to the space (no parentId since it's at the root of the space)
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
}

/**
 * Handle bookmark changes.
 * Handles both:
 * 1. Space folder rename
 * 2. Item title/URL change
 */
async function handleBookmarkChanged(
  id: string,
  changeInfo: { title?: string; url?: string }
): Promise<void> {
  // Case 1: Check if it's a space folder
  const space = await db.spaces.where('uuid').equals(id).first();
  if (space && space.id) {
    const now = new Date();
    await db.spaces.update(space.id, {
      name: changeInfo.title ?? space.name,
      updatedAt: now,
    });

    const updatedSpace = await db.spaces.get(space.id);
    if (updatedSpace) {
      searchService.updateSpace(updatedSpace);
    }
    console.log(`[Arcline] Space renamed: ${changeInfo.title}`);
    return;
  }

  // Case 2: Check if it's an item
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

/**
 * Handle bookmark removal.
 * Handles both:
 * 1. Space folder deletion (removes space and all items)
 * 2. Item deletion (removes item and all children)
 */
async function handleBookmarkRemoved(id: string): Promise<void> {
  // Case 1: Check if it's a space folder
  const space = await db.spaces.where('uuid').equals(id).first();
  if (space && space.id) {
    // Remove all items in this space
    const items = await db.items.where('spaceId').equals(space.id).toArray();
    for (const item of items) {
      if (item.id) {
        searchService.removeItem(item.id);
      }
    }
    await db.items.where('spaceId').equals(space.id).delete();

    // Remove the space
    searchService.removeSpace(space.id);
    await db.spaces.delete(space.id);

    console.log(`[Arcline] Space deleted: ${space.name}`);
    return;
  }

  // Case 2: Check if it's an item
  const item = await db.items.where('bookmarkId').equals(id).first();
  if (!item || !item.id) return;

  // Remove from search index
  searchService.removeItem(item.id);

  // Remove all children recursively
  await removeItemChildren(item.id);

  // Remove the item itself
  await db.items.delete(item.id);
}

/**
 * Recursively remove all children of an item.
 */
async function removeItemChildren(parentId: number): Promise<void> {
  const children = await db.items.where('parentId').equals(parentId).toArray();
  for (const child of children) {
    if (child.id) {
      searchService.removeItem(child.id);
      await removeItemChildren(child.id);
      await db.items.delete(child.id);
    }
  }
}

/**
 * Handle bookmark moves.
 * Updates the parent reference and sort order.
 */
async function handleBookmarkMoved(
  id: string,
  moveInfo: { parentId: string; index: number; oldParentId: string; oldIndex: number }
): Promise<void> {
  // Check if it's an item (not a space)
  const item = await db.items.where('bookmarkId').equals(id).first();
  if (!item || !item.id) return;

  // Find new parent
  let newParentId: number | undefined;
  let newSpaceId = item.spaceId;

  const parentItem = await db.items.where('bookmarkId').equals(moveInfo.parentId).first();
  if (parentItem) {
    newParentId = parentItem.id;
    newSpaceId = parentItem.spaceId;
  } else {
    // Check if parent is a space
    const space = await db.spaces.where('uuid').equals(moveInfo.parentId).first();
    if (space && space.id) {
      // Moving to space root, no parentId but update spaceId
      newParentId = undefined;
      newSpaceId = space.id;
    }
  }

  const now = new Date();
  await db.items.update(item.id, {
    parentId: newParentId,
    spaceId: newSpaceId,
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

/**
 * Get the Arcline root folder ID (for testing).
 */
export function getArclineRootFolderId(): string | null {
  return arclineRootFolderId;
}
