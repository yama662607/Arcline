import { groupColorForHue } from '../core/colors';
import {
  bookmarkIds,
  favoritesFolder,
  isPinNode,
  NO_GROUP,
  ownerOf,
  pinsIn,
  spaceOfBookmark,
  tabUrl,
  uniqueName,
} from '../core/snapshot';
import {
  activeSpaceOf,
  boundIdsInWindow,
  findSpace,
  groupSpaceOf,
  hueOf,
  liveBinding,
  loadContext,
  spaceOfTab,
  spaceTabs,
  type WindowContext,
} from './context';
import { collapseOtherSpaces, groupTabs } from './groups';
import { retry } from './queue';
import {
  getParkedTab,
  pruneLastPages,
  setActiveSpace,
  setBinding,
  setGroupSpace,
  storage,
} from './storage';

/**
 * Idempotently aligns Chrome's window tabs & tab groups with the Arcline bookmark model.
 */
export async function reconcile(
  windowId: number,
  options: { recover?: boolean } = {},
): Promise<void> {
  const win = await chrome.windows.get(windowId).catch(() => undefined);
  if (win?.type !== 'normal') return;

  const ctx = await loadContext(windowId);
  const lastPages = await storage.getLastPages();

  await mapGroupsToSpaces(ctx);
  await syncFavorites(ctx, lastPages);

  if (options.recover) {
    await recoverPins(ctx, lastPages);
    await pruneLastPages(bookmarkIds(ctx.root));
  }

  const activeSpace = await followActiveTab(ctx);
  await adoptLooseTabs(ctx, activeSpace);
}

async function mapGroupsToSpaces(ctx: WindowContext): Promise<void> {
  for (const group of ctx.groups) {
    const mapped = groupSpaceOf(ctx, group.id);
    let space = mapped ? findSpace(ctx, mapped) : undefined;
    if (!space) {
      const title = uniqueName(
        group.title || 'Space',
        ctx.spaces.map((s) => s.title),
      );
      const created = await chrome.bookmarks.create({ parentId: ctx.ids.rootId, title });
      space = { id: created.id, title, children: [] };
      ctx.spaces.push(space);
    }
    ctx.groupSpaces = await setGroupSpace(group.id, space.id);
    const desiredTitle = space.title;
    const desiredColor = groupColorForHue(hueOf(ctx, space.id));
    if (group.title !== desiredTitle || group.color !== desiredColor) {
      await retry(() =>
        chrome.tabGroups.update(group.id, { title: desiredTitle, color: desiredColor }),
      ).catch(() => undefined);
    }
  }
}

async function syncFavorites(ctx: WindowContext, lastPages: Record<string, string>): Promise<void> {
  const liveIds = bookmarkIds(ctx.root);
  const favorites = (favoritesFolder(ctx.root, ctx.ids.favoritesId)?.children ?? []).filter(
    isPinNode,
  );

  for (const tab of ctx.tabs) {
    if (tab.id === undefined) continue;
    const binding = ctx.bindings[tab.id];
    const live = binding && liveIds.has(binding.id) ? binding : undefined;
    if (binding && !live) {
      ctx.bindings = await setBinding(tab.id, undefined);
    }

    if (tab.pinned && live?.kind !== 'favorite') {
      const url = tabUrl(tab);
      if (!url) continue;
      const existing = ownerOf(favorites, url, lastPages, boundIdsInWindow(ctx));
      let favoriteId = existing?.id;
      if (!favoriteId) {
        const created = await chrome.bookmarks.create({
          parentId: ctx.ids.favoritesId,
          title: tab.title || url,
          url,
        });
        favoriteId = created.id;
      }
      ctx.bindings = await setBinding(tab.id, { kind: 'favorite', id: favoriteId });
    } else if (!tab.pinned && live?.kind === 'favorite') {
      ctx.bindings = await setBinding(tab.id, undefined);
    }
  }
}

async function recoverPins(ctx: WindowContext, lastPages: Record<string, string>): Promise<void> {
  for (const space of ctx.spaces) {
    const pins = pinsIn(space);
    for (const tab of spaceTabs(ctx, space.id)) {
      const url = tabUrl(tab);
      if (tab.id === undefined || liveBinding(ctx, tab.id) || !url) continue;
      const matched = ownerOf(pins, url, lastPages, boundIdsInWindow(ctx));
      if (matched) {
        ctx.bindings = await setBinding(tab.id, { kind: 'pin', id: matched.id });
      }
    }
  }
}

async function followActiveTab(ctx: WindowContext): Promise<string> {
  let activeSpace = activeSpaceOf(ctx);
  const activeTab = ctx.tabs.find((t) => t.active);
  const tabSpace = activeTab ? spaceOfTab(ctx, activeTab) : undefined;
  const parked = activeTab?.id !== undefined && activeTab.id === (await getParkedTab(ctx.windowId));

  if (tabSpace && tabSpace !== activeSpace && !parked) {
    activeSpace = tabSpace;
    await collapseOtherSpaces(ctx, activeSpace);
  }
  await setActiveSpace(ctx.windowId, activeSpace);
  return activeSpace;
}

async function adoptLooseTabs(ctx: WindowContext, activeSpace: string): Promise<void> {
  const bySpace = new Map<string, number[]>();
  for (const tab of ctx.tabs) {
    if (tab.id === undefined || tab.pinned || tab.groupId !== NO_GROUP) continue;
    const binding = liveBinding(ctx, tab.id);
    const targetSpace =
      (binding?.kind === 'pin' && spaceOfBookmark(ctx.root, ctx.ids.favoritesId, binding.id)) ||
      activeSpace;
    if (!targetSpace) continue;
    bySpace.set(targetSpace, [...(bySpace.get(targetSpace) ?? []), tab.id]);
  }
  for (const [spaceId, tabIds] of bySpace) {
    await groupTabs(ctx, spaceId, tabIds);
  }
}
