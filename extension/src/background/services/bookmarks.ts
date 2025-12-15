/// <reference types="chrome" />

import type { PinnedFolder, PinnedItem, PinnedTab, SearchResult, TabEntry } from '@/shared/types';

const ARCLINE_FOLDER_NAME = 'Arcline';
const BOOKMARK_MIRROR_STATUS_KEY = 'arclineBookmarkSync';

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
    await updateBookmarkMirrorStatus({
      lastSyncTime: Date.now(),
      isSyncing: false,
      error: null,
    });

    console.error(`[Arcline] Synced ${tabs.length} tabs to bookmarks for space "${spaceName}"`);
  } catch (error) {
    console.error(`[Arcline] Failed to sync space "${spaceName}" to bookmarks:`, error);
    await updateBookmarkMirrorStatus({
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
async function updateBookmarkMirrorStatus(status: BookmarkSyncStatus): Promise<void> {
  try {
    await chrome.storage.local.set({ [BOOKMARK_MIRROR_STATUS_KEY]: status });
  } catch (error) {
    console.error('[Arcline] Failed to update sync status:', error);
  }
}

/**
 * 同期状態を取得する
 */
export async function getSyncStatus(): Promise<BookmarkSyncStatus> {
  try {
    const result = await chrome.storage.local.get([BOOKMARK_MIRROR_STATUS_KEY]);
    return (
      result[BOOKMARK_MIRROR_STATUS_KEY] || {
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
    const arclineFolder = await getOrCreateArcifyFolder();
    const existingFolders = await chrome.bookmarks.getChildren(arclineFolder.id);
    const spaceFolder = existingFolders.find(
      (folder: chrome.bookmarks.BookmarkTreeNode) => folder.title === spaceName
    );

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
/**
 * スペースのブックマーク(PinnedItems)を取得する (再帰的)
 */
export async function getPinnedItemsForSpace(spaceName: string): Promise<PinnedItem[]> {
  try {
    const spaceFolder = await getOrCreateSpaceFolder(spaceName);
    return convertNodesToPinnedItems(await chrome.bookmarks.getChildren(spaceFolder.id));
  } catch (error) {
    console.error(`[Arcline] Failed to get pinned items for space "${spaceName}":`, error);
    return [];
  }
}

async function convertNodesToPinnedItems(
  nodes: chrome.bookmarks.BookmarkTreeNode[]
): Promise<PinnedItem[]> {
  const items: PinnedItem[] = [];

  for (const node of nodes) {
    if (node.url) {
      // It's a tab/bookmark
      items.push({
        type: 'tab',
        id: node.id,
        url: node.url,
        title: node.title,
        favIconUrl: undefined, // Would fetch if needed
        parentId: node.parentId,
      } as PinnedTab);
    } else {
      // It's a folder
      const children = await chrome.bookmarks.getChildren(node.id);
      items.push({
        type: 'folder',
        id: node.id,
        title: node.title,
        children: await convertNodesToPinnedItems(children),
        parentId: node.parentId,
      } as PinnedFolder);
    }
  }

  return items;
}

/**
 * フォルダーを作成する
 */
export async function createPinnedFolder(
  spaceName: string,
  title: string,
  parentId?: string
): Promise<PinnedFolder> {
  const spaceFolder = await getOrCreateSpaceFolder(spaceName);
  // parentIdが指定されていればそれを使用、なければスペース直下
  const effectiveParentId = parentId ?? spaceFolder.id;

  const node = await chrome.bookmarks.create({
    parentId: effectiveParentId,
    title,
  });

  return {
    type: 'folder',
    id: node.id,
    title: node.title,
    children: [],
    parentId: node.parentId,
  };
}

/**
 * タブ（ブックマーク）を作成する
 */
export async function createPinnedTab(
  spaceName: string,
  title: string,
  url: string,
  favIconUrl?: string,
  parentId?: string,
  index?: number
): Promise<PinnedTab> {
  const spaceFolder = await getOrCreateSpaceFolder(spaceName);
  const effectiveParentId = parentId ?? spaceFolder.id;

  const node = await chrome.bookmarks.create({
    parentId: effectiveParentId,
    index,
    title,
    url,
  });

  return {
    type: 'tab',
    id: node.id,
    url: node.url ?? url,
    title: node.title,
    favIconUrl,
    parentId: node.parentId,
  };
}

/**
 * Export space bookmarks to Netscape Bookmark File Format (HTML)
 */
export async function exportSpaceBookmarks(spaceName: string): Promise<string> {
  const items = await getPinnedItemsForSpace(spaceName);

  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

  function itemToHtml(item: PinnedItem, indent: string): string {
    if (item.type === 'tab') {
      return `${indent}<DT><A HREF="${item.url}">${item.title}</A>\n`;
    } else {
      let folderHtml = `${indent}<DT><H3>${item.title}</H3>\n${indent}<DL><p>\n`;
      for (const child of item.children) {
        folderHtml += itemToHtml(child, `${indent}    `);
      }
      folderHtml += `${indent}</DL><p>\n`;
      return folderHtml;
    }
  }

  for (const item of items) {
    html += itemToHtml(item, '    ');
  }

  html += '</DL><p>';
  return html;
}

/**
 * Import bookmarks from HTML content
 * Note: A full HTML parser in service worker might be heavy or unavailable (DOMParser is not available in SW in some versions, but we are in extension environment so maybe).
 * Actually, chrome.bookmarks.import() is not available to extensions programmatically with content.
 * We need to parse basic Netscape HTML.
 */
export async function importSpaceBookmarks(
  spaceName: string,
  htmlContent: string,
  parentId?: string
): Promise<void> {
  const spaceFolder = await getOrCreateSpaceFolder(spaceName);
  const rootId = parentId ?? spaceFolder.id;

  // Basic Regex-based parser for Netscape format (robust enough for simple exports)
  // Limitation: This is a simple implementation. For production, a robust parser is needed.

  // Split by specific tags to find items
  // This is tricky without DOMParser.
  // We can use a service to offload parsing or simple regex.
  // Given constraints, we will assume simple structure or use a helper if possible.

  // Alternate approach: Pass to an offscreen document for parsing if needed, but let's try regex for <A> and <H3>.
  // Structure is <DT><A ...>...</A> or <DT><H3 ...>...</H3><DL>...</DL>

  // For now, let's just parse flat links for simplicity or basic list.
  // Actually, users might want folders.
  // Let's defer complex parsing logic or implement a basic stack-based parser.

  console.warn('Import logic is partial - implementing flat import for now or need a parser.');

  // Regex to match links: <A HREF="(.*?)">(.*?)</A>
  const linkRegex = /<A[^>]+HREF="([^"]+)"[^>]*>([^<]+)<\/A>/gi;
  let match: RegExpExecArray | null = linkRegex.exec(htmlContent);
  while (match !== null) {
    const url = match[1];
    const title = match[2];
    await chrome.bookmarks.create({
      parentId: rootId,
      title: title,
      url: url,
    });
    match = linkRegex.exec(htmlContent);
  }
}

/**
 * 古い getBookmarksForSpace (TabEntry[] を返す) - 後方互換性のため維持するか、新しいロジックを使うか
 * Existing calls in browser.ts expect TabEntry[]. We can adapt.
 */
export async function getBookmarksForSpace(spaceName: string): Promise<TabEntry[]> {
  const items = await getPinnedItemsForSpace(spaceName);
  // Flatten for backward compatibility
  const flatten = (items: PinnedItem[]): TabEntry[] => {
    let result: TabEntry[] = [];
    for (const item of items) {
      if (item.type === 'tab') {
        result.push({
          id: 0,
          url: item.url,
          title: item.title,
          active: false,
          pinned: false,
          windowId: 0,
          groupId: 0,
          last_accessed: 0,
        });
      } else {
        result = result.concat(flatten(item.children));
      }
    }
    return result;
  };
  return flatten(items);
}

export async function movePinnedItem(
  id: string,
  destination: { parentId?: string; index?: number; spaceName?: string }
): Promise<void> {
  let finalParentId = destination.parentId;

  if (!finalParentId && destination.spaceName) {
    const spaceFolder = await getOrCreateSpaceFolder(destination.spaceName);
    finalParentId = spaceFolder.id;
  }

  await chrome.bookmarks.move(id, { parentId: finalParentId, index: destination.index });
}

export async function removePinnedItem(id: string): Promise<void> {
  await chrome.bookmarks.removeTree(id); // Use removeTree to handle folders
}

export async function updatePinnedItem(
  id: string,
  updates: { title?: string; url?: string }
): Promise<void> {
  await chrome.bookmarks.update(id, updates);
}

export async function searchBookmarks(query: string, maxResults = 20): Promise<SearchResult[]> {
  const items = await chrome.bookmarks.search(query);
  return items
    .filter((item) => item.url)
    .slice(0, maxResults)
    .map((item) => ({
      type: 'bookmark',
      id: item.id,
      title: item.title,
      url: item.url,
      favIconUrl: undefined, // Need favicon fetcher if available
    }));
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
