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

const TAB_GROUPS_SUPPORTED = typeof chrome.tabGroups !== 'undefined';
const TAB_GROUP_ID_NONE = TAB_GROUPS_SUPPORTED ? chrome.tabGroups!.TAB_GROUP_ID_NONE : -1;

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
    const [tabGroups, allTabs] = await Promise.all([
      TAB_GROUPS_SUPPORTED ? chrome.tabGroups!.query({}) : Promise.resolve<chrome.tabGroups.TabGroup[]>([]),
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

      if (!groupMap.has(targetGroupId) && targetGroupId !== TAB_GROUP_ID_NONE) {
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

export async function toggleTabPinned(tabId: number, nextPinned?: boolean): Promise<boolean> {
  const tab = await chrome.tabs.get(tabId);
  const pinned = nextPinned ?? !tab.pinned;
  await chrome.tabs.update(tabId, { pinned });
  return pinned;
}

export async function moveTabToSpace(tabId: number, spaceId: number): Promise<number | null> {
  if (!TAB_GROUPS_SUPPORTED) {
    await chrome.tabs.ungroup(tabId);
    return null;
  }

  if (spaceId === TAB_GROUP_ID_NONE) {
    await chrome.tabs.ungroup(tabId);
    return null;
  }

  const groupId = await chrome.tabs.group({ groupId: spaceId, tabIds: tabId });
  return groupId;
}

export async function createSpace(name: string, color?: chrome.tabGroups.ColorEnum): Promise<number> {
  if (!TAB_GROUPS_SUPPORTED) {
    throw new Error('Tab groups are not supported in this browser');
  }

  let tabId: number | undefined;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id) {
    tabId = activeTab.id;
  } else {
    const newTab = await chrome.tabs.create({ active: true });
    tabId = newTab.id;
  }

  if (typeof tabId !== 'number') {
    throw new Error('Failed to locate a tab for grouping');
  }

  const groupId = await chrome.tabs.group({ tabIds: tabId });
  await chrome.tabGroups.update(groupId, {
    title: name,
    color: color ?? 'blue'
  });
  return groupId;
}

export async function removeSpace(spaceId: number): Promise<void> {
  if (!TAB_GROUPS_SUPPORTED) return;

  const tabs = await chrome.tabs.query({ groupId: spaceId });
  if (!tabs.length) return;

  await chrome.tabs.ungroup(tabs.map((tab) => tab.id!).filter((id): id is number => typeof id === 'number'));
}

export async function broadcastSpacesSnapshot(): Promise<void> {
  const spaces = await getSpacesSnapshot();
  try {
    await chrome.runtime.sendMessage({ command: 'spacesSnapshot', spaces });
  } catch (error) {
    // Silently ignore if no listeners are connected (e.g., side panel is closed)
    // This is expected behavior and not an error
  }
}

export async function closeTab(tabId: number): Promise<void> {
  await chrome.tabs.remove(tabId);
}

export async function activateTab(tabId: number): Promise<void> {
  await chrome.tabs.update(tabId, { active: true });
}
