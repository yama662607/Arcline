/// <reference types="chrome" />
import type { SpaceSnapshot, TabEntry } from '@/shared/spaces';

const DEFAULT_COLORS: Record<string, string> = {
  grey: '#64748b',
  blue: '#3b82f6',
  red: '#ef4444',
  yellow: '#facc15',
  green: '#22c55e',
  pink: '#ec4899',
  purple: '#a855f7',
  cyan: '#06b6d4'
};

function mapTab(tab: chrome.tabs.Tab): TabEntry | null {
  if (typeof tab.id !== 'number') return null;

  return {
    id: tab.id,
    title: tab.title ?? 'Untitled',
    url: tab.url ?? undefined,
    pinned: Boolean(tab.pinned)
  };
}

function colorFromGroup(group: chrome.tabGroups.TabGroup): string {
  if (!group.color) return DEFAULT_COLORS.grey;
  return DEFAULT_COLORS[group.color] ?? DEFAULT_COLORS.grey;
}

export async function getSpacesSnapshot(): Promise<SpaceSnapshot[]> {
  try {
    const tabGroupsSupported = typeof chrome.tabGroups?.query === 'function';
    const TAB_GROUP_ID_NONE = chrome.tabGroups?.TAB_GROUP_ID_NONE ?? -1;

    const [tabGroups, allTabs] = await Promise.all([
      tabGroupsSupported ? chrome.tabGroups!.query({}) : Promise.resolve<chrome.tabGroups.TabGroup[]>([]),
      chrome.tabs.query({})
    ]);

    const groupMap = new Map<number, SpaceSnapshot>();

    tabGroups.forEach((group) => {
      groupMap.set(group.id, {
        id: group.id,
        name: group.title ?? 'Space',
        color: colorFromGroup(group),
        pinnedTabs: [],
        temporaryTabs: []
      });
    });

    const ungrouped: SpaceSnapshot = {
      id: TAB_GROUP_ID_NONE,
      name: 'Ungrouped',
      color: DEFAULT_COLORS.grey,
      pinnedTabs: [],
      temporaryTabs: []
    };

    allTabs.forEach((tab) => {
      const entry = mapTab(tab);
      if (!entry) return;

      const targetGroupId = tab.groupId ?? TAB_GROUP_ID_NONE;
      const targetSpace = groupMap.get(targetGroupId) ?? ungrouped;

      if (entry.pinned) {
        targetSpace.pinnedTabs.push(entry);
      } else {
        targetSpace.temporaryTabs.push(entry);
      }

      if (!groupMap.has(targetGroupId) && targetGroupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        // Group may have been removed between queries. Add placeholder entry.
        groupMap.set(targetGroupId, targetSpace);
      }
    });

    const spaces: SpaceSnapshot[] = [];

    groupMap.forEach((space) => {
      spaces.push(space);
    });

    if (ungrouped.pinnedTabs.length || ungrouped.temporaryTabs.length) {
      spaces.push(ungrouped);
    }

    return spaces.sort((a, b) => a.id - b.id);
  } catch (error) {
    console.warn('Failed to load spaces snapshot', error);
    return [];
  }
}
