import type { SwipeDirection } from '@/shared/gestures';
import type { SpaceSnapshot, TabEntry } from '@/shared/types';
import { broadcastSpacesSnapshot, getSpacesSnapshot } from './browser';

import { openFloatingUiOnTab, type SpaceTransitionOptions } from './ui-messaging';

// Constant for ungrouped tabs space
const UNGROUPED_SPACE_ID = -1;

type NavigationTarget = {
  space: SpaceSnapshot;
  tab: TabEntry;
  allSpaces: SpaceSnapshot[];
};

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

function determineTargetIndex(direction: SwipeDirection): number {
  return direction === 'left' ? -1 : 1;
}

async function resolveNavigationTarget(
  direction: SwipeDirection
): Promise<NavigationTarget | null> {
  const spaces = await getSpacesSnapshot();
  if (spaces.length <= 1) {
    return null;
  }

  const activeTab = await resolveActiveTab();
  const currentIndex = findCurrentSpaceIndex(spaces, activeTab);
  if (currentIndex < 0) {
    return null;
  }

  const targetIndex = normalizeIndex(currentIndex + determineTargetIndex(direction), spaces.length);
  const targetSpace = spaces[targetIndex];
  if (!targetSpace) {
    return null;
  }

  const activeTabId = typeof activeTab?.id === 'number' ? activeTab.id : undefined;
  const targetTab = selectTargetTab(targetSpace, activeTabId);
  if (!targetTab) {
    console.warn('[Arcline] No navigable tabs found for target space', targetSpace.id);
    return null;
  }

  return { space: targetSpace, tab: targetTab, allSpaces: spaces };
}

async function activateTargetTab(tab: TabEntry): Promise<boolean> {
  try {
    await chrome.tabs.update(tab.id, { active: true });
    return true;
  } catch (error) {
    console.warn('[Arcline] Failed to activate tab during swipe navigation:', error);
    return false;
  }
}

async function focusWindowIfNeeded(windowId: number | undefined): Promise<void> {
  if (typeof windowId !== 'number' || windowId < 0) {
    return;
  }

  try {
    await chrome.windows.update(windowId, { focused: true });
  } catch (error) {
    console.warn('[Arcline] Failed to focus target window during swipe navigation:', error);
  }
}

async function broadcastSpacesSafely(): Promise<void> {
  try {
    await broadcastSpacesSnapshot();
  } catch (error) {
    console.warn('[Arcline] Failed to broadcast spaces after swipe navigation:', error);
  }
}

async function notifyActiveSpaceChange(spaceId: number): Promise<void> {
  try {
    try {
      await chrome.runtime.sendMessage({ command: 'activeSpaceChanged', spaceId });
    } catch {
      // Ignore: Receivers (side panel/popup) might not be open
    }

    // Speculative Preloading: Prewarm neighbor spaces (left/right)
    const spaces = await getSpacesSnapshot();
    if (spaces.length <= 1) return;

    const currentIndex = spaces.findIndex((s) => s.id === spaceId);
    if (currentIndex === -1) return;

    // Calculate neighbor indices (cyclic)
    const prevIndex = (currentIndex - 1 + spaces.length) % spaces.length;
    const nextIndex = (currentIndex + 1) % spaces.length;

    const neighbors = [spaces[prevIndex], spaces[nextIndex]];
    // Deduplicate if length is 2 (prev == next)
    const uniqueNeighbors = [...new Set(neighbors)];

    // Send preload command to active tab of each neighbor space
    uniqueNeighbors
      .filter((space): space is SpaceSnapshot => !!space)
      .forEach((space) => {
        const activeTabId = space.tabs.find((t) => t.active)?.id || space.tabs[0]?.id;
        if (activeTabId) {
          chrome.tabs.sendMessage(activeTabId, { command: 'preloadFloatingUi' }).catch(() => {
            // Ignore errors (e.g. tab closed or no content script)
          });
        }
      });
  } catch (error) {
    console.warn('[Arcline] Failed to notify active space change:', error);
  }
}

export async function navigateSpace(
  direction: SwipeDirection,
  options?: SpaceTransitionOptions & { perfId?: string; t0?: number }
): Promise<boolean> {
  const t2 = Date.now();
  const { perfId, t0 } = options || {};
  if (perfId) {
    console.log(
      `[Arcline][Perf][${perfId}] T2: Message received in BG at ${new Date(t2).toISOString().split('T')[1]} (Delta T0-T2: ${t2 - (t0 || t2)}ms)`
    );
  }

  console.log(`[Arcline] navigateSpace called: direction=${direction}`);
  const target = await resolveNavigationTarget(direction);
  if (!target) {
    return false;
  }

  // Reuse spaces from resolveNavigationTarget instead of fetching again
  const spaces = target.allSpaces;

  // Optimistically update active state in the snapshot
  // This is faster than re-fetching and ensures the UI feels responsive
  // We do this BEFORE activating the tab so the UI receives the "future" state immediately
  for (const space of spaces) {
    const lists: TabEntry[][] = [space.tabs, space.temporaryTabs, space.pinnedTabs];
    for (const list of lists) {
      for (const tab of list) {
        tab.active = tab.id === target.tab.id;
      }
    }
  }

  // Parallelize tab activation, window focus, and UI data delivery
  const activationPromise = activateTargetTab(target.tab).then(async (activated) => {
    if (activated) {
      await focusWindowIfNeeded(target.tab.windowId);
    }
  });

  const openUiPromise = openFloatingUiOnTab(target.tab.id, spaces, target.space.id, {
    ...options,
    perfId,
    t0,
  });

  await Promise.all([activationPromise, openUiPromise]);

  await broadcastSpacesSafely();
  await notifyActiveSpaceChange(target.space.id);

  return true;
}

export async function activateSpace(
  spaceId: number,
  options?: SpaceTransitionOptions & { perfId?: string; t0?: number }
): Promise<boolean> {
  const t2 = Date.now();
  const { perfId, t0 } = options || {};
  if (perfId) {
    console.log(
      `[Arcline][Perf][${perfId}] T2: activateSpace received in BG at ${new Date(t2).toISOString().split('T')[1]} (Delta T0-T2: ${t2 - (t0 || t2)}ms)`
    );
  }

  const spaces = await getSpacesSnapshot();
  const targetSpace = spaces.find((space) => space.id === spaceId);
  if (!targetSpace) {
    return false;
  }

  const activeTab = await resolveActiveTab();
  const activeTabId = typeof activeTab?.id === 'number' ? activeTab.id : undefined;
  const targetTab = selectTargetTab(targetSpace, activeTabId);
  if (!targetTab) {
    console.warn('[Arcline] No navigable tabs found for target space', targetSpace.id);
    return false;
  }

  const activated = await activateTargetTab(targetTab);
  if (!activated) {
    return false;
  }

  await focusWindowIfNeeded(targetTab.windowId);

  const refreshed = await getSpacesSnapshot();
  await openFloatingUiOnTab(targetTab.id, refreshed, targetSpace.id, options);

  await broadcastSpacesSafely();
  await notifyActiveSpaceChange(targetSpace.id);

  return true;
}
