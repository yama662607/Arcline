import { isSpaceFolder } from '../core/snapshot';
import type { BookmarkNode } from '../core/types';
import { DEFAULT_SPACE_NAME, FAVORITES_TITLE, ROOT_TITLE, type RootIds, storage } from './storage';

async function findStorageParent(): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const [tree] = await chrome.bookmarks.getTree();
  const top = tree?.children ?? [];
  const other =
    top.find((n) => n.folderType === 'other' && n.syncing) ??
    top.find((n) => n.folderType === 'other') ??
    top[1] ??
    top[0];
  if (!other) throw new Error('No bookmark parent folder available');
  return other;
}

async function verifySavedRoot(ids: RootIds): Promise<boolean> {
  try {
    const nodes = await chrome.bookmarks.get([ids.rootId, ids.favoritesId]);
    const root = nodes[0];
    const fav = nodes[1];
    return Boolean(root && fav && fav.parentId === root.id);
  } catch {
    return false;
  }
}

export async function ensureRoot(): Promise<RootIds> {
  const saved = await storage.getRootIds();
  if (saved && (await verifySavedRoot(saved))) {
    return saved;
  }

  const parent = await findStorageParent();
  const children = await chrome.bookmarks.getChildren(parent.id);
  const root =
    children.find((n) => n.url === undefined && n.title === ROOT_TITLE) ??
    (await chrome.bookmarks.create({ parentId: parent.id, title: ROOT_TITLE }));

  const rootChildren = await chrome.bookmarks.getChildren(root.id);
  const favorites =
    rootChildren.find((n) => n.url === undefined && n.title === FAVORITES_TITLE) ??
    (await chrome.bookmarks.create({ parentId: root.id, title: FAVORITES_TITLE, index: 0 }));

  if (!rootChildren.some((n) => isSpaceFolder(n as BookmarkNode, favorites.id))) {
    await chrome.bookmarks.create({ parentId: root.id, title: DEFAULT_SPACE_NAME });
  }

  const ids: RootIds = { rootId: root.id, favoritesId: favorites.id };
  await storage.setRootIds(ids);
  return ids;
}

export async function loadRoot(): Promise<{ ids: RootIds; root: BookmarkNode }> {
  const ids = await ensureRoot();
  const [tree] = await chrome.bookmarks.getSubTree(ids.rootId);
  if (!tree) throw new Error('Arcline bookmark folder missing');
  const root = tree as BookmarkNode;
  if (!root.children?.some((n) => isSpaceFolder(n, ids.favoritesId))) {
    await chrome.bookmarks.create({ parentId: ids.rootId, title: DEFAULT_SPACE_NAME });
    const [refreshed] = await chrome.bookmarks.getSubTree(ids.rootId);
    if (!refreshed) throw new Error('Arcline bookmark folder missing after create');
    return { ids, root: refreshed as BookmarkNode };
  }
  return { ids, root };
}
