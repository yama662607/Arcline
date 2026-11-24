import type { BookmarkNode, TabGroupInfo, TabInfo } from './types';

export const NO_GROUP = -1;

export function tabUrl(tab: Pick<TabInfo, 'url' | 'pendingUrl'>): string | undefined {
  const raw = tab.url || tab.pendingUrl;
  return raw && raw.length > 0 ? raw : undefined;
}

const ALLOWED_NAVIGABLE_PROTOCOLS = new Set([
  'http:',
  'https:',
  'chrome-extension:',
  'chrome:',
  'brave:',
  'edge:',
  'about:',
]);

export function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Validates URLs via WHATWG `new URL()` with control-character rejection and an explicit protocol
 * allowlist, blocking `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, and control-char bypasses.
 */
export function isSafeNavigableUrl(url: string | undefined): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed || hasControlChar(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return ALLOWED_NAVIGABLE_PROTOCOLS.has(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

export function isPinNode(node: BookmarkNode): node is BookmarkNode & { url: string } {
  return typeof node.url === 'string' && node.url.length > 0;
}

export function isSpaceFolder(node: BookmarkNode, favoritesId: string): boolean {
  return node.url === undefined && node.id !== favoritesId;
}

export function spaceFolders(root: BookmarkNode, favoritesId: string): BookmarkNode[] {
  return (root.children ?? []).filter((node) => isSpaceFolder(node, favoritesId));
}

export function favoritesFolder(root: BookmarkNode, favoritesId: string): BookmarkNode | undefined {
  return (root.children ?? []).find((node) => node.id === favoritesId && node.url === undefined);
}

export function findBookmark(node: BookmarkNode, id: string): BookmarkNode | undefined {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findBookmark(child, id);
    if (found) return found;
  }
  return undefined;
}

export function bookmarkIds(root: BookmarkNode): Set<string> {
  const ids = new Set<string>();
  const visit = (node: BookmarkNode) => {
    ids.add(node.id);
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return ids;
}

export function pinsIn(node: BookmarkNode): Array<BookmarkNode & { url: string }> {
  const result: Array<BookmarkNode & { url: string }> = [];
  const visit = (cur: BookmarkNode) => {
    if (isPinNode(cur)) {
      result.push(cur);
      return;
    }
    for (const child of cur.children ?? []) visit(child);
  };
  visit(node);
  return result;
}

export function spaceOfBookmark(
  root: BookmarkNode,
  favoritesId: string,
  targetId: string,
): string | undefined {
  for (const space of spaceFolders(root, favoritesId)) {
    if (findBookmark(space, targetId)) return space.id;
  }
  return undefined;
}

export function spaceOfGroup(
  groupId: number,
  groups: TabGroupInfo[],
  groupSpaces: Record<number, string>,
  spaces: BookmarkNode[],
): string | undefined {
  if (groupId === NO_GROUP) return undefined;
  const mapped = groupSpaces[groupId];
  if (mapped && spaces.some((s) => s.id === mapped)) return mapped;
  const group = groups.find((g) => g.id === groupId);
  if (!group?.title) return undefined;
  return spaces.find((s) => s.title === group.title)?.id;
}

function normalizeUrlForMatch(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

/**
 * Recover which pin/favorite owns a live tab after browser restart.
 * Prefers exact URL match, then normalized URL, then recorded lastPages URL.
 */
export function ownerOf(
  pins: Array<BookmarkNode & { url: string }>,
  url: string,
  lastPages: Record<string, string>,
  takenIds: Set<string>,
): (BookmarkNode & { url: string }) | undefined {
  const available = pins.filter((pin) => !takenIds.has(pin.id));
  const exact = available.find((pin) => pin.url === url);
  if (exact) return exact;

  const norm = normalizeUrlForMatch(url);
  const normMatch = available.find((pin) => normalizeUrlForMatch(pin.url) === norm);
  if (normMatch) return normMatch;

  return available.find((pin) => {
    const last = lastPages[pin.id];
    return last !== undefined && (last === url || normalizeUrlForMatch(last) === norm);
  });
}

export function uniqueName(base: string, existing: string[]): string {
  const trimmed = base.trim() || 'Space';
  if (!existing.includes(trimmed)) return trimmed;
  let i = 2;
  while (existing.includes(`${trimmed} ${i}`)) i += 1;
  return `${trimmed} ${i}`;
}
