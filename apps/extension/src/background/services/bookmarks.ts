/// <reference types="chrome" />

import type { TabEntry } from '@/shared/types';

const ARCLINE_FOLDER_NAME = 'Arcline';
const BOOKMARK_SYNC_KEY = 'arclineBookmarkSync';

export interface BookmarkSyncStatus {
  lastSyncTime: number;
  isSyncing: boolean;
  error: string | null;
}

export interface SpaceBookmarkData {
  spaceId: number;
  spaceName: string;
  bookmarks: chrome.bookmarks.BookmarkTreeNode[];
}

/**
 * Arcifyフォルダを取得または作成する
 */
export async function getOrCreateArcifyFolder(): Promise<chrome.bookmarks.BookmarkTreeNode> {
  try {
    const bookmarkTree = await chrome.bookmarks.getTree();
    const rootNode = bookmarkTree[0];

    if (!rootNode?.children) {
      throw new Error('Bookmark tree structure not found');
    }

    const bookmarksBar = rootNode.children.find((node) => node.id === '1');

    if (!bookmarksBar) {
      throw new Error('Bookmarks bar not found');
    }

    const existingFolder = bookmarksBar.children?.find(
      (node) => node.title === ARCLINE_FOLDER_NAME
    );

    if (existingFolder) {
      return existingFolder;
    }

    const newFolder = await chrome.bookmarks.create({
      parentId: bookmarksBar.id,
      title: ARCLINE_FOLDER_NAME,
    });

    return newFolder;
  } catch (error) {
    console.error('[Arcline] Failed to get or create Arcify folder:', error);
    throw error;
  }
}

/**
 * スペース用のフォルダを取得または作成する
 */
export async function getOrCreateSpaceFolder(
  spaceName: string
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  try {
    const arclineFolder = await getOrCreateArcifyFolder();

    // 既存のスペースフォルダを検索
    const existingFolders = await chrome.bookmarks.getChildren(arclineFolder.id);
    let spaceFolder = existingFolders.find((folder) => folder.title === spaceName);

    // 重複するスペースフォルダがある場合はマージ
    const duplicateFolders = existingFolders.filter(
      (folder) => folder.title === spaceName && folder.id !== spaceFolder?.id
    );

    if (spaceFolder && duplicateFolders.length > 0) {
      console.warn(
        `[Arcline] Found ${duplicateFolders.length} duplicate folders for "${spaceName}"`
      );
      await mergeDuplicateSpaceFolders(spaceFolder, duplicateFolders);
    }

    if (!spaceFolder) {
      spaceFolder = await chrome.bookmarks.create({
        parentId: arclineFolder.id,
        title: spaceName,
      });
    }

    return spaceFolder;
  } catch (error) {
    console.error(`[Arcline] Failed to get or create space folder "${spaceName}":`, error);
    throw error;
  }
}

/**
 * 重複するスペースフォルダをマージする
 */
async function mergeDuplicateSpaceFolders(
  targetFolder: chrome.bookmarks.BookmarkTreeNode,
  duplicateFolders: chrome.bookmarks.BookmarkTreeNode[]
): Promise<void> {
  try {
    for (const duplicateFolder of duplicateFolders) {
      const children = await chrome.bookmarks.getChildren(duplicateFolder.id);

      // 子ブックマークをターゲットフォルダに移動
      for (const child of children) {
        await chrome.bookmarks.move(child.id, {
          parentId: targetFolder.id,
          index: undefined,
        });
      }

      // 重複フォルダを削除
      await chrome.bookmarks.removeTree(duplicateFolder.id);
    }

    console.error(`[Arcline] Merged ${duplicateFolders.length} duplicate folders`);
  } catch (error) {
    console.error('[Arcline] Failed to merge duplicate folders:', error);
    throw error;
  }
}

/**
 * スペースをブックマークに同期する
 */
export async function syncSpaceToBookmarks(spaceName: string, tabs: TabEntry[]): Promise<void> {
  try {
    const spaceFolder = await getOrCreateSpaceFolder(spaceName);

    // 既存のブックマークを取得
    const existingBookmarks = await chrome.bookmarks.getChildren(spaceFolder.id);

    // 既存ブックマークを削除
    for (const bookmark of existingBookmarks) {
      await chrome.bookmarks.remove(bookmark.id);
    }

    // 新しいブックマークを作成
    for (const tab of tabs) {
      if (tab.url?.startsWith('http')) {
        await chrome.bookmarks.create({
          parentId: spaceFolder.id,
          title: tab.title,
          url: tab.url,
        });
      }
    }

    // 同期状態を更新
    await updateSyncStatus({
      lastSyncTime: Date.now(),
      isSyncing: false,
      error: null,
    });

    console.error(`[Arcline] Synced ${tabs.length} tabs to bookmarks for space "${spaceName}"`);
  } catch (error) {
    console.error(`[Arcline] Failed to sync space "${spaceName}" to bookmarks:`, error);
    await updateSyncStatus({
      lastSyncTime: Date.now(),
      isSyncing: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * ブックマークからスペースを復元する
 */
export async function restoreSpacesFromBookmarks(): Promise<SpaceBookmarkData[]> {
  try {
    const arclineFolder = await getOrCreateArcifyFolder();
    const spaceFolders = await chrome.bookmarks.getChildren(arclineFolder.id);

    const spacesData: SpaceBookmarkData[] = [];

    for (const spaceFolder of spaceFolders) {
      const bookmarks = await chrome.bookmarks.getChildren(spaceFolder.id);

      spacesData.push({
        spaceId: parseInt(spaceFolder.id, 10),
        spaceName: spaceFolder.title,
        bookmarks: bookmarks.filter((bookmark) => bookmark.url),
      });
    }

    console.error(`[Arcline] Restored ${spacesData.length} spaces from bookmarks`);
    return spacesData;
  } catch (error) {
    console.error('[Arcline] Failed to restore spaces from bookmarks:', error);
    throw error;
  }
}

/**
 * 同期状態を更新する
 */
async function updateSyncStatus(status: BookmarkSyncStatus): Promise<void> {
  try {
    await chrome.storage.local.set({ [BOOKMARK_SYNC_KEY]: status });
  } catch (error) {
    console.error('[Arcline] Failed to update sync status:', error);
  }
}

/**
 * 同期状態を取得する
 */
export async function getSyncStatus(): Promise<BookmarkSyncStatus> {
  try {
    const result = await chrome.storage.local.get([BOOKMARK_SYNC_KEY]);
    return (
      result[BOOKMARK_SYNC_KEY] || {
        lastSyncTime: 0,
        isSyncing: false,
        error: null,
      }
    );
  } catch (error) {
    console.error('[Arcline] Failed to get sync status:', error);
    return {
      lastSyncTime: 0,
      isSyncing: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * スペースフォルダを削除する
 */
export async function removeSpaceFolder(spaceName: string): Promise<void> {
  try {
    const spaceFolder = spaceFolders.find((folder) => folder.title === spaceName);
    if (spaceFolder) {
      await chrome.bookmarks.removeTree(spaceFolder.id);
      console.error(`[Arcline] Removed bookmark folder for space "${spaceName}"`);
    }
  } catch (error) {
    console.error(`[Arcline] Failed to remove space folder "${spaceName}":`, error);
    throw error;
  }
}

/**
 * スペースのブックマークを取得する
 */
export async function getBookmarksForSpace(spaceName: string): Promise<TabEntry[]> {
  try {
    const spaceFolder = await getOrCreateSpaceFolder(spaceName);

    // Get all bookmarks in the space folder (recursive)
    const bookmarks: TabEntry[] = [];
    const processFolder = async (folderId: string) => {
      const items = await chrome.bookmarks.getChildren(folderId);
      for (const item of items) {
        if (item.url) {
          // This is a bookmark, convert to TabEntry format
          bookmarks.push({
            id: 0, // Bookmarks don't have tab IDs
            url: item.url,
            title: item.title,
            favIconUrl: undefined, // Would need to fetch separately
            pinned: false, // Bookmarks are not pinned tabs
            active: false,
            windowId: 0,
            groupId: 0, // Will be set by caller
            last_accessed: item.dateAdded,
          });
        } else if (!item.url) {
          // This is a folder, process recursively
          await processFolder(item.id);
        }
      }
    };

    await processFolder(spaceFolder.id);
    return bookmarks;
  } catch (error) {
    console.error(`[Arcline] Failed to get bookmarks for space "${spaceName}":`, error);
    return [];
  }
}

/**
 * すべてのArclineブックマークをクリーンアップする
 */
export async function cleanupAllBookmarks(): Promise<void> {
  try {
    const arclineFolder = await getOrCreateArcifyFolder();
    await chrome.bookmarks.removeTree(arclineFolder.id);
    console.error('[Arcline] Cleaned up all Arcline bookmarks');
  } catch (error) {
    console.error('[Arcline] Failed to cleanup bookmarks:', error);
    throw error;
  }
}
