import type { SwipeDirection } from '@/shared/gestures';
import type { SpaceSnapshot, TabEntry } from '@/shared/types';
import type { TabGroupColor } from '@/shared/chrome-types';
import { broadcastSpacesSnapshot, getSpacesSnapshot, restoreSpaceByFolderName } from './browser';
import { setSkipNextAutoGroup, updateLastActiveGroupId } from './auto-group';

import { openFloatingUiOnTab, type SpaceTransitionOptions } from './ui-messaging';

// Constant for ungrouped tabs space
const UNGROUPED_SPACE_ID = -1;

type NavigationTarget = {
  space: SpaceSnapshot;
  tab: TabEntry | null;
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

  // Even if no target tab is found, we return the space so the caller can decide
  // to create an empty space placeholder.
  return { space: targetSpace, tab: targetTab, allSpaces: spaces };
}

async function activateTargetTab(tab: TabEntry): Promise<boolean> {
  console.log(`[Arcline] 🔄 activateTargetTab calling chrome.tabs.update for tabId=${tab.id}`);
  try {
    await chrome.tabs.update(tab.id, { active: true });
    console.log(`[Arcline] ✓ chrome.tabs.update SUCCESS for tabId=${tab.id}`);
    return true;
  } catch (error) {
    console.warn('[Arcline] ❌ Failed to activate tab during swipe navigation:', error);
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

interface EmptySpaceHandleResult {
  handled: boolean;
  tabId?: number;
  spaceId?: number;
}

async function handleEmptyOrVirtualSpace(
  targetSpace: SpaceSnapshot,
  options?: SpaceTransitionOptions & { perfId?: string; t0?: number }
): Promise<EmptySpaceHandleResult> {
  // Virtual space (inactive folder) -> Restore it
  if (targetSpace.id < 0) {
    console.log(`[Arcline] 🔄 Restoring virtual space: "${targetSpace.name}"`);
    let newGroupId: number;
    try {
      newGroupId = await restoreSpaceByFolderName(targetSpace.name);
      console.log(`[Arcline] ✓ restoreSpaceByFolderName completed: newGroupId=${newGroupId}`);
    } catch (error) {
      console.error('[Arcline] ❌ restoreSpaceByFolderName FAILED:', error);
      return { handled: false };
    }

    console.log(`[Arcline] 🔍 Querying tabs for group ${newGroupId}...`);
    const tabs = await chrome.tabs.query({ groupId: newGroupId });
    console.log(`[Arcline] ✓ Found ${tabs.length} tabs in group ${newGroupId}`);

    const activeTab = tabs.find((t) => t.active) || tabs[0];
    if (activeTab?.id) {
      console.log(
        `[Arcline] ✓ Virtual space restored. New ID: ${newGroupId}, Tab: ${activeTab.id}. Opening UI.`
      );
      const refreshedSpaces = await getSpacesSnapshot();

      // Robustly wait for the tab and retry sending the message
      let attempts = 0;
      while (attempts < 20) {
        try {
          const tab = await chrome.tabs.get(activeTab.id!);
          if (tab.status === 'complete') {
            try {
              await openFloatingUiOnTab(activeTab.id, refreshedSpaces, newGroupId, options);
              console.log(
                `[Arcline] ✅ Floating UI opened successfully on attempt ${attempts + 1}`
              );
              break;
            } catch (_error) {
              console.log(
                `[Arcline] ⏳ Message send failed (attempt ${attempts + 1}), retrying...`
              );
            }
          }
        } catch (_e) {
          // Tab might not be ready yet
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }
    } else {
      console.warn(
        `[Arcline] ⚠️ Virtual space restored but no active tab found in new group ${newGroupId}`
      );
    }
    return { handled: true, tabId: activeTab?.id, spaceId: newGroupId };
  }

  // Existing space but empty -> Create placeholder tab
  console.log(
    `[Arcline] Creating empty-space.html for empty space: "${targetSpace.name}" (id: ${targetSpace.id})`
  );

  // Prevent auto-grouping from putting this tab in the previous space
  setSkipNextAutoGroup(true);
  // Update lastActiveGroupId to the target space (if it exists)
  if (targetSpace.id > 0) {
    updateLastActiveGroupId(targetSpace.id);
  }

  const url = chrome.runtime.getURL(
    `empty-space.html?color=${encodeURIComponent(targetSpace.color)}`
  );
  const newTab = await chrome.tabs.create({ url, active: true });

  if (newTab.id) {
    // Check if the tab group still exists
    let finalGroupId = targetSpace.id;
    if (targetSpace.id !== -1) {
      try {
        // Try to get the existing tab group to verify it exists
        await chrome.tabGroups.get(targetSpace.id);
        // Group exists, add the new tab to it
        await chrome.tabs.group({ tabIds: [newTab.id], groupId: targetSpace.id });
      } catch {
        // Tab group doesn't exist anymore - create a new group
        console.log(
          `[Arcline] Tab group ${targetSpace.id} doesn't exist, creating new group for "${targetSpace.name}"`
        );
        finalGroupId = await chrome.tabs.group({ tabIds: [newTab.id] });
        // Update the group title and color
        await chrome.tabGroups.update(finalGroupId, {
          title: targetSpace.name,
          color: targetSpace.color as TabGroupColor,
        });
      }
    }
    const refreshed = await getSpacesSnapshot();

    // Robustly wait for the tab and retry sending the message
    let attempts = 0;
    while (attempts < 20) {
      try {
        const tab = await chrome.tabs.get(newTab.id);
        if (tab.status === 'complete') {
          try {
            await openFloatingUiOnTab(newTab.id, refreshed, finalGroupId, options);
            console.log(`[Arcline] ✅ Floating UI opened successfully on attempt ${attempts + 1}`);
            break;
          } catch (_error) {
            console.log(`[Arcline] ⏳ Message send failed (attempt ${attempts + 1}), retrying...`);
          }
        }
      } catch (_e) {
        // Tab might not be ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    return { handled: true, tabId: newTab.id, spaceId: finalGroupId };
  }

  return { handled: true };
}

function optimisticallyUpdateActiveStates(
  spaces: SpaceSnapshot[],
  targetTabId: number | undefined
): void {
  for (const space of spaces) {
    const lists: TabEntry[][] = [space.tabs, space.temporaryTabs, space.pinnedTabs];
    for (const list of lists) {
      for (const tab of list) {
        tab.active = targetTabId !== undefined ? tab.id === targetTabId : false;
      }
    }
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

// Debounce state for navigation
let lastNavigationTime = 0;
const NAVIGATION_DEBOUNCE_MS = 100;

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

  console.log(`[Arcline] 🚀 navigateSpace START: direction=${direction}, perfId=${perfId}`);
  const target = await resolveNavigationTarget(direction);
  if (!target) {
    console.warn('[Arcline] ❌ navigateSpace FAILED: No navigation target resolved');
    return false;
  }

  console.log(
    `[Arcline] ✓ Target resolved: space="${target.space.name}" (id=${target.space.id}), hasTab=${!!target.tab}`
  );
  const spaces = target.allSpaces;
  let finalTargetTabId = target.tab?.id;
  const finalTargetTab = target.tab;
  let finalTargetSpaceId = target.space.id;

  // Optimistically update active state for UI responsiveness
  optimisticallyUpdateActiveStates(spaces, finalTargetTabId);

  if (finalTargetTabId && finalTargetTab) {
    console.log(
      `[Arcline] ✓ Navigating to existing tab: tabId=${finalTargetTabId}, spaceId=${finalTargetSpaceId}`
    );
    // Parallelize tab activation, window focus, and UI data delivery
    const activationPromise = activateTargetTab(finalTargetTab).then(async (activated) => {
      if (activated) {
        console.log(`[Arcline] ✓ Tab activated successfully`);
        await focusWindowIfNeeded(finalTargetTab?.windowId);
      } else {
        console.warn(`[Arcline] ⚠️ Tab activation failed`);
      }
    });

    const openUiPromise = openFloatingUiOnTab(finalTargetTabId, spaces, finalTargetSpaceId, {
      ...options,
      perfId,
      t0,
    })
      .then(() => {
        console.log(`[Arcline] ✓ openFloatingUiOnTab message SENT to tabId=${finalTargetTabId}`);
      })
      .catch((err) => {
        console.error(
          `[Arcline] ❌ openFloatingUiOnTab message FAILED for tabId=${finalTargetTabId}:`,
          err
        );
      });

    await Promise.all([activationPromise, openUiPromise]);
    console.log(`[Arcline] ✓ Tab activation and UI opening promises resolved (or failed)`);
  } else {
    console.log(
      `[Arcline] ⚙️ Handling empty/virtual space: "${target.space.name}" (id=${target.space.id})`
    );
    // Empty space or Virtual Space
    const result = await handleEmptyOrVirtualSpace(target.space, { ...options, perfId, t0 });
    if (!result.handled) {
      console.error('[Arcline] ❌ handleEmptyOrVirtualSpace FAILED');
      return false;
    }
    console.log(
      `[Arcline] ✓ Empty/virtual space handled: newSpaceId=${result.spaceId}, newTabId=${result.tabId}`
    );
    // Update tracking variables with results from restoration/creation
    finalTargetSpaceId = result.spaceId ?? finalTargetSpaceId;
    finalTargetTabId = result.tabId;
  }

  console.log(
    `[Arcline] 📡 Broadcasting state and notifying UI: finalSpaceId=${finalTargetSpaceId}`
  );
  await broadcastSpacesSafely();
  await notifyActiveSpaceChange(finalTargetSpaceId);

  console.log(
    `[Arcline] ✅ navigateSpace COMPLETE: direction=${direction}, spaceId=${finalTargetSpaceId}, targetTabId=${finalTargetTabId}`
  );
  return true;
}

export async function activateSpace(
  spaceIdOrUuid: number | string,
  options?: SpaceTransitionOptions & { perfId?: string; t0?: number }
): Promise<boolean> {
  const t2 = Date.now();

  // Debounce rapid consecutive navigations (gesture inertia)
  if (t2 - lastNavigationTime < NAVIGATION_DEBOUNCE_MS) {
    console.log(`[Arcline] ⏭️ Navigation debounced (too soon: ${t2 - lastNavigationTime}ms)`);
    return false;
  }
  lastNavigationTime = t2;

  const { perfId, t0 } = options || {};
  if (perfId) {
    console.log(
      `[Arcline][Perf][${perfId}] T2: activateSpace received in BG at ${new Date(t2).toISOString().split('T')[1]} (Delta T0-T2: ${t2 - (t0 || t2)}ms)`
    );
  }

  console.log(`[Arcline] 🚀 activateSpace START: spaceIdOrUuid=${spaceIdOrUuid}`);
  const spaces = await getSpacesSnapshot();
  const targetSpace = findTargetSpace(spaces, spaceIdOrUuid);

  if (!targetSpace) {
    console.warn(`[Arcline] ❌ activateSpace FAILED: Target space not found for ${spaceIdOrUuid}`);
    return false;
  }

  console.log(`[Arcline] 🎯 Target resolved: "${targetSpace.name}" (id=${targetSpace.id})`);
  const activeTab = await resolveActiveTab();
  const activeTabId = typeof activeTab?.id === 'number' ? activeTab.id : undefined;
  const targetTab = selectTargetTab(targetSpace, activeTabId);

  if (targetTab) {
    console.log(`[Arcline] 🔄 Activating existing tab: ${targetTab.id} in space ${targetSpace.id}`);
    const activated = await activateTargetTab(targetTab);
    if (!activated) {
      console.warn(`[Arcline] ❌ Tab activation FAILED for tabId=${targetTab.id}`);
      return false;
    }
    await focusWindowIfNeeded(targetTab.windowId);

    const refreshed = await getSpacesSnapshot();
    console.log(`[Arcline] 📡 Sending openFloatingUiOnTab to tabId=${targetTab.id}`);
    await openFloatingUiOnTab(targetTab.id, refreshed, targetSpace.id, options);
  } else {
    console.log(`[Arcline] ⚙️ Target space "${targetSpace.name}" is empty/virtual. Handling...`);
    // Empty space or Virtual Space
    await handleEmptyOrVirtualSpace(targetSpace, options);
    return true;
  }

  await broadcastSpacesSafely();
  await notifyActiveSpaceChange(targetSpace.id);

  console.log(`[Arcline] ✅ activateSpace COMPLETE for spaceId=${targetSpace.id}`);
  return true;
}

function findTargetSpace(
  spaces: SpaceSnapshot[],
  spaceIdOrUuid: number | string
): SpaceSnapshot | undefined {
  if (typeof spaceIdOrUuid === 'number') {
    return spaces.find((space) => space.id === spaceIdOrUuid);
  }
  return spaces.find((space) => space.uuid === spaceIdOrUuid);
}

/**
 * Activate a space by its index (0-based) in the spaces list.
 * Used for keyboard shortcuts like Control+1-9.
 */
export async function activateSpaceByIndex(
  index: number,
  options?: { perfId?: string; t0?: number }
): Promise<boolean> {
  const spaces = await getSpacesSnapshot();

  if (index < 0 || index >= spaces.length) {
    console.log(`[Arcline] Space index ${index} out of range (0-${spaces.length - 1})`);
    return false;
  }

  const targetSpace = spaces[index];
  if (!targetSpace) {
    return false;
  }

  console.log(`[Arcline] Activating space by index ${index}: "${targetSpace.name}"`);
  return activateSpace(targetSpace.uuid ?? targetSpace.id, options);
}
