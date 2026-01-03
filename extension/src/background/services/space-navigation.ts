import type { SwipeDirection } from '@/shared/gestures';
import type { SpaceSnapshot, TabEntry, SpaceTransitionHandoff } from '@/shared/types';
import { broadcastSpacesSnapshot, getSpacesSnapshot } from './browser';

const UNGROUPED_SPACE_ID = -1;

type NavigationTarget = {
  space: SpaceSnapshot;
  tab: TabEntry;
};

type SpaceTransitionOptions = {
  transition?: SpaceTransitionHandoff | null;
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

  return { space: targetSpace, tab: targetTab };
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
    await chrome.runtime.sendMessage({ command: 'activeSpaceChanged', spaceId });
  } catch (error) {
    console.warn('[Arcline] Failed to notify active space change:', error);
  }
}

export async function openFloatingUiOnTab(
  tabId: number,
  spaces: SpaceSnapshot[],
  options?: SpaceTransitionOptions
): Promise<void> {
  try {
    // まずスペースデータを送信してReact Queryのキャッシュを更新
    chrome.tabs.sendMessage(tabId, { command: 'spacesSnapshot', spaces }, () => {
      if (chrome.runtime.lastError) {
        // Silent fail
      }
    });

    const transition = options?.transition;
    if (transition) {
      chrome.tabs.sendMessage(tabId, { command: 'spaceTransition', transition }, () => {
        if (chrome.runtime.lastError) {
          // Silent fail - content script may not be ready yet
        }
      });
    }

    // 少し遅延してからFloating UIを開く（データが先に到着するように）
    setTimeout(() => {
      if (transition) {
        chrome.tabs.sendMessage(tabId, { command: 'spaceTransition', transition }, () => {
          if (chrome.runtime.lastError) {
            // Silent fail - content script may not be ready yet
          }
        });
      }
      chrome.tabs.sendMessage(tabId, { command: 'openFloatingUiInstantly' }, () => {
        if (chrome.runtime.lastError) {
          // Silent fail - content script may not be ready yet
        }
      });
    }, 50);
  } catch {
    // Silent fail
  }
}

export async function navigateSpace(
  direction: SwipeDirection,
  options?: SpaceTransitionOptions
): Promise<boolean> {
  console.log(`[Arcline] navigateSpace called: direction=${direction}`);
  const target = await resolveNavigationTarget(direction);
  if (!target) {
    return false;
  }

  const activated = await activateTargetTab(target.tab);
  if (!activated) {
    return false;
  }

  await focusWindowIfNeeded(target.tab.windowId);

  // スペースデータを取得して移動先タブに送信
  const spaces = await getSpacesSnapshot();

  // 移動先タブでFloating UIを即座に開く（スペースデータ付き）
  await openFloatingUiOnTab(target.tab.id, spaces, options);

  await broadcastSpacesSafely();
  await notifyActiveSpaceChange(target.space.id);

  return true;
}

export async function activateSpace(
  spaceId: number,
  options?: SpaceTransitionOptions
): Promise<boolean> {
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
  await openFloatingUiOnTab(targetTab.id, refreshed, options);

  await broadcastSpacesSafely();
  await notifyActiveSpaceChange(targetSpace.id);

  return true;
}
