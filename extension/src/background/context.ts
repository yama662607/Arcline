import { spaceHue } from '../core/colors';
import { bookmarkIds, spaceFolders, spaceOfBookmark, spaceOfGroup } from '../core/snapshot';
import type { BookmarkNode, SpaceMeta, TabBinding, TabGroupInfo, TabInfo } from '../core/types';
import { loadRoot } from './root';
import { type RootIds, storage } from './storage';

export interface WindowContext {
  windowId: number;
  ids: RootIds;
  root: BookmarkNode;
  spaces: BookmarkNode[];
  tabs: TabInfo[];
  groups: TabGroupInfo[];
  bindings: Record<number, TabBinding>;
  groupSpaces: Record<number, string>;
  activeSpaces: Record<number, string>;
  spaceMeta: Record<string, SpaceMeta>;
}

export async function loadContext(windowId: number): Promise<WindowContext> {
  const [{ ids, root }, tabs, groups, bindings, groupSpaces, activeSpaces, spaceMeta] =
    await Promise.all([
      loadRoot(),
      chrome.tabs.query({ windowId }),
      chrome.tabGroups.query({ windowId }),
      storage.getBindings(),
      storage.getGroupSpaces(),
      storage.getActiveSpaces(),
      storage.getSpaceMeta(),
    ]);

  return {
    windowId,
    ids,
    root,
    spaces: spaceFolders(root, ids.favoritesId),
    tabs: tabs as TabInfo[],
    groups: groups as TabGroupInfo[],
    bindings,
    groupSpaces,
    activeSpaces,
    spaceMeta,
  };
}

export async function reloadRoot(ctx: WindowContext): Promise<void> {
  const { root } = await loadRoot();
  ctx.root = root;
  ctx.spaces = spaceFolders(root, ctx.ids.favoritesId);
}

export async function reloadTabs(ctx: WindowContext): Promise<void> {
  ctx.tabs = (await chrome.tabs.query({ windowId: ctx.windowId })) as TabInfo[];
}

export function findSpace(ctx: WindowContext, spaceId: string): BookmarkNode | undefined {
  return ctx.spaces.find((s) => s.id === spaceId);
}

export function hueOf(ctx: WindowContext, spaceId: string): number {
  const idx = ctx.spaces.findIndex((s) => s.id === spaceId);
  const space = idx >= 0 ? ctx.spaces[idx] : undefined;
  return spaceHue(ctx.spaceMeta, space?.title ?? '', Math.max(0, idx), space?.id ?? spaceId);
}

export function groupSpaceOf(ctx: WindowContext, groupId: number): string | undefined {
  return spaceOfGroup(groupId, ctx.groups, ctx.groupSpaces, ctx.spaces);
}

export function groupOf(ctx: WindowContext, spaceId: string): number | undefined {
  for (const group of ctx.groups) {
    if (groupSpaceOf(ctx, group.id) === spaceId) return group.id;
  }
  return undefined;
}

export function liveBinding(ctx: WindowContext, tabId: number): TabBinding | undefined {
  const binding = ctx.bindings[tabId];
  if (!binding) return undefined;
  const liveIds = bookmarkIds(ctx.root);
  return liveIds.has(binding.id) ? binding : undefined;
}

export function boundIdsInWindow(ctx: WindowContext): Set<string> {
  const liveIds = bookmarkIds(ctx.root);
  const taken = new Set<string>();
  for (const tab of ctx.tabs) {
    if (tab.id === undefined) continue;
    const binding = ctx.bindings[tab.id];
    if (binding && liveIds.has(binding.id)) taken.add(binding.id);
  }
  return taken;
}

export function boundTab(ctx: WindowContext, bookmarkId: string): TabInfo | undefined {
  return ctx.tabs.find((t) => t.id !== undefined && ctx.bindings[t.id]?.id === bookmarkId);
}

export function boundTabIds(ctx: WindowContext, bookmarkId: string): number[] {
  return ctx.tabs
    .filter(
      (t): t is TabInfo & { id: number } =>
        t.id !== undefined && ctx.bindings[t.id]?.id === bookmarkId,
    )
    .map((t) => t.id);
}

export function activeSpaceOf(ctx: WindowContext): string {
  const current = ctx.activeSpaces[ctx.windowId];
  if (current && ctx.spaces.some((s) => s.id === current)) return current;
  return ctx.spaces[0]?.id ?? '';
}

export function spaceOfTab(ctx: WindowContext, tab: TabInfo): string | undefined {
  if (tab.id !== undefined) {
    const binding = liveBinding(ctx, tab.id);
    if (binding?.kind === 'pin') {
      return spaceOfBookmark(ctx.root, ctx.ids.favoritesId, binding.id);
    }
    if (binding?.kind === 'favorite') return undefined;
  }
  return groupSpaceOf(ctx, tab.groupId);
}

export function spaceTabs(ctx: WindowContext, spaceId: string): TabInfo[] {
  return ctx.tabs.filter((t) => !t.pinned && spaceOfTab(ctx, t) === spaceId);
}

export function temporaryTabs(ctx: WindowContext, spaceId: string): TabInfo[] {
  return ctx.tabs.filter(
    (t) =>
      t.id !== undefined &&
      !t.pinned &&
      !liveBinding(ctx, t.id) &&
      groupSpaceOf(ctx, t.groupId) === spaceId,
  );
}
