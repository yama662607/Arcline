import { resolveSpaceMeta, spaceHue } from './colors';
import {
  bookmarkIds,
  favoritesFolder,
  isPinNode,
  spaceFolders,
  spaceOfGroup,
  tabUrl,
} from './snapshot';
import type {
  BookmarkNode,
  Favorite,
  LiveTab,
  PinnedNode,
  PinnedTab,
  SidebarState,
  Snapshot,
  Space,
  TabInfo,
} from './types';

export const EMPTY_STATE: Readonly<SidebarState> = Object.freeze({
  rootId: '',
  favoritesId: '',
  spaces: [],
  favorites: [],
  tabs: new Map<number, LiveTab>(),
  activeSpaceId: '',
  activeTabId: undefined,
  openFolders: new Set<string>(),
});

function toLiveTab(tab: TabInfo & { id: number }): LiveTab {
  const url = tabUrl(tab) ?? '';
  return {
    id: tab.id,
    title: tab.title || url || 'New Tab',
    url,
    status: tab.status === 'loading' ? 'loading' : 'complete',
    favIconUrl: tab.favIconUrl || undefined,
    audible: Boolean(tab.audible),
    muted: Boolean(tab.mutedInfo?.muted),
  };
}

function toPinnedNodes(nodes: BookmarkNode[], boundTabs: Map<string, number>): PinnedNode[] {
  return nodes.map((node) =>
    isPinNode(node)
      ? {
          kind: 'pin',
          id: node.id,
          title: node.title || node.url,
          url: node.url,
          tabId: boundTabs.get(node.id),
        }
      : {
          kind: 'folder',
          id: node.id,
          title: node.title || 'Folder',
          children: toPinnedNodes(node.children ?? [], boundTabs),
        },
  );
}

/** Pure derivation of the sidebar view state from a Chrome/Brave snapshot. */
export function deriveState(snapshot: Snapshot): SidebarState {
  const folders = spaceFolders(snapshot.root, snapshot.favoritesId);
  const liveBookmarkIds = bookmarkIds(snapshot.root);

  const tabs = new Map<number, LiveTab>();
  const boundTabs = new Map<string, number>();

  for (const tab of snapshot.tabs) {
    if (tab.id === undefined) continue;
    tabs.set(tab.id, toLiveTab({ ...tab, id: tab.id }));
    const binding = snapshot.bindings[tab.id];
    if (binding && liveBookmarkIds.has(binding.id) && !boundTabs.has(binding.id)) {
      boundTabs.set(binding.id, tab.id);
    }
  }

  const isBound = (tabId: number): boolean => {
    const binding = snapshot.bindings[tabId];
    return binding !== undefined && boundTabs.get(binding.id) === tabId;
  };

  const spaces: Space[] = folders.map((folder, index) => {
    const meta = resolveSpaceMeta(snapshot.spaceMeta, folder.title, folder.id);
    return {
      id: folder.id,
      name: folder.title || 'Space',
      hue: spaceHue(snapshot.spaceMeta, folder.title, index, folder.id),
      icon: meta?.icon,
      theme: meta?.theme,
      pinned: toPinnedNodes(folder.children ?? [], boundTabs),
      tabIds: [],
    };
  });

  const activeTab = snapshot.tabs.find((tab) => tab.active);
  const groupSpace = (groupId: number) =>
    spaceOfGroup(groupId, snapshot.groups, snapshot.groupSpaces, folders);
  const isKnownSpace = (id: string | undefined): id is string =>
    id !== undefined && spaces.some((space) => space.id === id);

  let activeSpaceId = snapshot.activeSpaces[snapshot.windowId];
  if (!isKnownSpace(activeSpaceId)) {
    const fromTab = activeTab ? groupSpace(activeTab.groupId) : undefined;
    activeSpaceId = isKnownSpace(fromTab) ? fromTab : (spaces[0]?.id ?? '');
  }

  for (const tab of snapshot.tabs) {
    if (tab.id === undefined || isBound(tab.id)) continue;
    if (tab.pinned) continue;
    const spaceId = groupSpace(tab.groupId) ?? activeSpaceId;
    spaces.find((s) => s.id === spaceId)?.tabIds.push(tab.id);
  }

  const collectOpenPinnedTabIds = (nodes: PinnedNode[]): number[] => {
    const out: number[] = [];
    for (const n of nodes) {
      if (n.kind === 'pin') {
        if (n.tabId !== undefined) out.push(n.tabId);
      } else {
        out.push(...collectOpenPinnedTabIds(n.children));
      }
    }
    return out;
  };

  for (const sp of spaces) {
    const pinnedOpenIds = collectOpenPinnedTabIds(sp.pinned);
    const allSpaceTabIds = [...pinnedOpenIds, ...sp.tabIds];
    const remembered = snapshot.lastActiveTabs?.[`${snapshot.windowId}:${sp.id}`];
    sp.lastActiveTabId =
      (remembered !== undefined && allSpaceTabIds.includes(remembered) ? remembered : undefined) ??
      sp.tabIds.at(-1) ??
      pinnedOpenIds.at(-1);
  }

  const favFolder = favoritesFolder(snapshot.root, snapshot.favoritesId);
  const favorites: Favorite[] = (favFolder?.children ?? []).filter(isPinNode).map((node) => ({
    id: node.id,
    title: node.title || node.url,
    url: node.url,
    tabId: boundTabs.get(node.id),
  }));

  return {
    rootId: snapshot.rootId,
    favoritesId: snapshot.favoritesId,
    spaces,
    favorites,
    tabs,
    activeSpaceId,
    activeTabId: activeTab?.id,
    openFolders: new Set(snapshot.openFolders),
  };
}

/** O(1) immutable patch for live tab metadata updates without reloading bookmarks/storage. */
export function patchLiveTab(
  state: SidebarState,
  tabId: number,
  patch: Partial<Omit<LiveTab, 'id'>>,
): SidebarState {
  const existing = state.tabs.get(tabId);
  if (!existing) return state;
  const nextTab: LiveTab = { ...existing, ...patch };
  if (
    nextTab.title === existing.title &&
    nextTab.url === existing.url &&
    nextTab.status === existing.status &&
    nextTab.favIconUrl === existing.favIconUrl &&
    nextTab.audible === existing.audible &&
    nextTab.muted === existing.muted
  ) {
    return state;
  }
  const nextTabs = new Map(state.tabs);
  nextTabs.set(tabId, nextTab);
  return { ...state, tabs: nextTabs };
}

export function hasOpenPin(node: PinnedNode): boolean {
  if (node.kind === 'pin') return node.tabId !== undefined;
  return node.children.some(hasOpenPin);
}

export function countOpenPins(nodes: PinnedNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === 'pin') {
      if (node.tabId !== undefined) count += 1;
    } else {
      count += countOpenPins(node.children);
    }
  }
  return count;
}

/** Returns all currently open pinned tabs nested inside a folder (in tree order). */
export function collectOpenPins(nodes: PinnedNode[]): PinnedTab[] {
  const result: PinnedTab[] = [];
  for (const node of nodes) {
    if (node.kind === 'pin') {
      if (node.tabId !== undefined) result.push(node);
    } else {
      result.push(...collectOpenPins(node.children));
    }
  }
  return result;
}
