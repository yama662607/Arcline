import { groupColorForHue } from '../core/colors';
import type { TabGroupColor, TabGroupInfo } from '../core/types';
import {
  activeSpaceOf,
  findSpace,
  groupOf,
  groupSpaceOf,
  hueOf,
  type WindowContext,
} from './context';
import { retry } from './queue';
import { setGroupSpace, storage } from './storage';

export async function groupTabs(
  ctx: WindowContext,
  spaceId: string,
  tabIds: number[],
): Promise<number | undefined> {
  if (tabIds.length === 0) return groupOf(ctx, spaceId);
  const space = findSpace(ctx, spaceId);
  if (!space) return undefined;

  const existing = groupOf(ctx, spaceId);
  const ids = tabIds as [number, ...number[]];
  const groupId = await retry(() =>
    chrome.tabs.group(
      existing !== undefined
        ? { tabIds: ids, groupId: existing }
        : { tabIds: ids, createProperties: { windowId: ctx.windowId } },
    ),
  );

  if (existing === undefined) {
    const updated = await retry(() =>
      chrome.tabGroups.update(groupId, {
        title: space.title,
        color: groupColorForHue(hueOf(ctx, spaceId)),
        collapsed: spaceId !== activeSpaceOf(ctx),
      }),
    );
    if (updated) ctx.groups.push(updated as TabGroupInfo);
  }

  ctx.groupSpaces = await setGroupSpace(groupId, spaceId);
  for (const tab of ctx.tabs) {
    if (tab.id !== undefined && tabIds.includes(tab.id)) tab.groupId = groupId;
  }
  return groupId;
}

/**
 * Collapses all Space groups except the active Space and the group holding the active tab
 * (to avoid Chrome automatically switching or spawning tabs).
 */
export async function collapseOtherSpaces(
  ctx: WindowContext,
  activeSpaceId: string,
): Promise<void> {
  const [front] = await chrome.tabs.query({ windowId: ctx.windowId, active: true });
  for (const group of ctx.groups) {
    const spaceId = groupSpaceOf(ctx, group.id);
    if (spaceId === undefined) continue;
    const shouldCollapse = spaceId !== activeSpaceId && group.id !== front?.groupId;
    if (group.collapsed !== shouldCollapse) {
      await retry(() => chrome.tabGroups.update(group.id, { collapsed: shouldCollapse })).catch(
        () => undefined,
      );
      group.collapsed = shouldCollapse;
    }
  }
}

export async function updateSpaceGroups(
  spaceId: string,
  change: { title?: string; color?: TabGroupColor },
): Promise<void> {
  const groupSpaces = await storage.getGroupSpaces();
  for (const [groupIdStr, mapped] of Object.entries(groupSpaces)) {
    if (mapped !== spaceId) continue;
    await retry(() => chrome.tabGroups.update(Number(groupIdStr), change)).catch(() => undefined);
  }
}
