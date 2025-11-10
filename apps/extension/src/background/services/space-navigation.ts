import type { SpaceSnapshot, TabEntry } from '@/shared/types';
import { broadcastSpacesSnapshot, getSpacesSnapshot } from './browser';
import type { SwipeDirection } from './gestures';

const UNGROUPED_SPACE_ID = -1;

function containsTab(space: SpaceSnapshot, tabId: number): boolean {
  const lists: TabEntry[][] = [space.tabs, space.temporaryTabs, space.pinnedTabs];
  return lists.some((entries) => entries.some((entry) => entry.id === tabId));
}

function selectTargetTab(space: SpaceSnapshot, excludeTabId?: number): TabEntry | null {
  const orderedLists: TabEntry[][] = [space.tabs, space.temporaryTabs, space.pinnedTabs];

  for (const list of orderedLists) {
    for (const entry of list) {
      if (entry.id === excludeTabId) {
        continue;
      }
      return entry;
    }
  }

  return null;
}

function normalizeIndex(index: number, length: number): number {
  if (length === 0) {
    return -1;
  }
  return (index + length) % length;
}

async function resolveActiveTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const [{ active: isActiveCurrent, ...rest } = {} as chrome.tabs.Tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (isActiveCurrent) {
      return { active: true, ...rest };
    }
  } catch (error) {
    console.warn('[Arcline] Failed to query current window active tab:', error);
  }

  try {
    const [tab = null] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab ?? null;
  } catch (error) {
    console.warn('[Arcline] Failed to query last focused window active tab:', error);
    return null;
  }
}

function findCurrentSpaceIndex(spaces: SpaceSnapshot[], activeTab: chrome.tabs.Tab | null): number {
  if (!spaces.length) {
    return -1;
  }

  const activeTabId = typeof activeTab?.id === 'number' ? activeTab.id : null;
  const activeGroupId = typeof activeTab?.groupId === 'number' ? activeTab.groupId : null;

  if (activeTabId !== null) {
    const indexByTab = spaces.findIndex((space) => containsTab(space, activeTabId));
    if (indexByTab >= 0) {
      return indexByTab;
    }
  }

  if (activeGroupId !== null && activeGroupId >= 0) {
    const indexByGroup = spaces.findIndex((space) => space.id === activeGroupId);
    if (indexByGroup >= 0) {
      return indexByGroup;
    }
  }

  if (activeGroupId === UNGROUPED_SPACE_ID) {
    const ungroupedIndex = spaces.findIndex((space) => space.id === UNGROUPED_SPACE_ID);
    if (ungroupedIndex >= 0) {
      return ungroupedIndex;
    }
  }

  return 0;
}

export async function navigateSpace(direction: SwipeDirection): Promise<boolean> {
  const spaces = await getSpacesSnapshot();
  if (spaces.length <= 1) {
    return false;
  }

  const activeTab = await resolveActiveTab();
  const currentIndex = findCurrentSpaceIndex(spaces, activeTab);
  if (currentIndex < 0) {
    return false;
  }

  const offset = direction === 'left' ? -1 : 1;
  const targetIndex = normalizeIndex(currentIndex + offset, spaces.length);
  if (targetIndex < 0 || targetIndex >= spaces.length) {
    return false;
  }

  const targetSpace = spaces[targetIndex] ?? null;
  if (!targetSpace) {
    return false;
  }

  const activeTabId = typeof activeTab?.id === 'number' ? activeTab.id : undefined;
  const targetTab = selectTargetTab(targetSpace, activeTabId);
  if (!targetTab) {
    console.warn('[Arcline] No navigable tabs found for target space', targetSpace.id);
    return false;
  }

  try {
    await chrome.tabs.update(targetTab.id, { active: true });
  } catch (error) {
    console.warn('[Arcline] Failed to activate tab during swipe navigation:', error);
    return false;
  }

  if (typeof targetTab.windowId === 'number' && targetTab.windowId >= 0) {
    try {
      await chrome.windows.update(targetTab.windowId, { focused: true });
    } catch (error) {
      console.warn('[Arcline] Failed to focus target window during swipe navigation:', error);
    }
  }

  try {
    await broadcastSpacesSnapshot();
  } catch (error) {
    console.warn('[Arcline] Failed to broadcast spaces after swipe navigation:', error);
  }

  return true;
}
