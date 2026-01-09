/// <reference types="chrome" />

/**
 * State for auto-grouping logic to prevent infinite loops or
 * undesired grouping of system-created tabs.
 */
let lastActiveGroupId = -1;
let skipNextAutoGroup = false;

/**
 * Set flag to skip auto-grouping for the next tab creation.
 */
export function setSkipNextAutoGroup(skip: boolean): void {
  console.log('[Arcline] 🛡️ AutoGroup: setting skipNextAutoGroup =', skip);
  skipNextAutoGroup = skip;
}

/**
 * Update the last active group ID.
 */
export function updateLastActiveGroupId(groupId: number): void {
  console.log('[Arcline] 🛡️ AutoGroup: updating lastActiveGroupId =', groupId);
  lastActiveGroupId = groupId;
}

/**
 * Get the current skip flag status (and reset it if needed).
 */
export function shouldSkipAutoGroup(): boolean {
  const current = skipNextAutoGroup;
  if (current) {
    skipNextAutoGroup = false; // Auto-reset after one use
    console.log('[Arcline] 🛡️ AutoGroup: skip consumed (reset to false)');
  }
  return current;
}

/**
 * Get the last active group ID.
 */
export function getLastActiveGroupId(): number {
  return lastActiveGroupId;
}

/**
 * Get the first available tab group as a fallback.
 * Returns the group ID or -1 if no groups exist.
 */
async function getFirstAvailableGroupId(): Promise<number> {
  try {
    const tabGroups = await chrome.tabGroups.query({});
    if (tabGroups.length > 0 && tabGroups[0]) {
      return tabGroups[0].id;
    }
  } catch (_error) {
    // Ignore errors
  }
  return -1;
}

/**
 * Assign all ungrouped tabs to the first available space.
 * Called on browser startup to ensure all tabs belong to a space.
 */
async function assignUngroupedTabsToFirstSpace(): Promise<void> {
  console.log('[Arcline] 🛡️ AutoGroup: checking for ungrouped tabs...');

  try {
    // Get the first available tab group
    const tabGroups = await chrome.tabGroups.query({});
    if (tabGroups.length === 0) {
      console.log('[Arcline] 🛡️ AutoGroup: no tab groups exist, skipping ungrouped tab assignment');
      return;
    }

    const firstGroup = tabGroups[0];
    if (!firstGroup) {
      return;
    }

    // Get all tabs and filter ungrouped ones (excluding pinned tabs)
    const allTabs = await chrome.tabs.query({});
    const ungroupedTabs = allTabs.filter(
      (tab) => tab.groupId === -1 && !tab.pinned && tab.id !== undefined
    );

    if (ungroupedTabs.length === 0) {
      console.log('[Arcline] 🛡️ AutoGroup: no ungrouped tabs found');
      return;
    }

    console.log(
      `[Arcline] 🛡️ AutoGroup: assigning ${ungroupedTabs.length} ungrouped tabs to first space (groupId=${firstGroup.id})`
    );

    // Move each ungrouped tab to the first group
    for (const tab of ungroupedTabs) {
      if (tab.id) {
        try {
          await chrome.tabs.group({ tabIds: [tab.id], groupId: firstGroup.id });
          console.log(`[Arcline] 🛡️ AutoGroup: moved tab ${tab.id} to group ${firstGroup.id}`);
        } catch (error) {
          console.warn(`[Arcline] Failed to move tab ${tab.id} to group:`, error);
        }
      }
    }

    console.log('[Arcline] 🛡️ AutoGroup: ungrouped tabs assignment complete');
  } catch (error) {
    console.warn('[Arcline] Failed to assign ungrouped tabs:', error);
  }
}

/**
 * Initialize listeners for auto-grouping.
 * This part is called from index.ts.
 */
export function initializeAutoGrouping() {
  console.log('[Arcline] 🛡️ AutoGroup: initializing listeners...');

  // Track the last active group
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab.groupId !== -1) {
        lastActiveGroupId = tab.groupId;
      }
    } catch (_error) {
      // Ignore errors for closed tabs
    }
  });

  // Auto-group new tabs into the active space
  chrome.tabs.onCreated.addListener(async (tab) => {
    // Skip if flagged (system-created tabs like empty-space.html)
    if (shouldSkipAutoGroup()) {
      return;
    }

    // If the tab is already grouped, do nothing
    if (tab.groupId !== -1) {
      return;
    }

    // If we don't have a valid active group, try to get the first available one
    let targetGroupId = lastActiveGroupId;
    if (targetGroupId === -1) {
      targetGroupId = await getFirstAvailableGroupId();
      if (targetGroupId !== -1) {
        console.log(
          `[Arcline] 🛡️ AutoGroup: no active group, falling back to first space (groupId=${targetGroupId})`
        );
        lastActiveGroupId = targetGroupId;
      }
    }

    // Still no valid group, skip auto-grouping
    if (targetGroupId === -1) {
      return;
    }

    // Check if the target group still exists
    try {
      await chrome.tabGroups.get(targetGroupId);
    } catch {
      // Group no longer exists, try to get the first available one
      targetGroupId = await getFirstAvailableGroupId();
      if (targetGroupId === -1) {
        lastActiveGroupId = -1;
        return;
      }
      lastActiveGroupId = targetGroupId;
    }

    // Move the new tab into the group
    try {
      if (tab.id) {
        console.log(`[Arcline] 🛡️ AutoGroup: moving new tab ${tab.id} to group ${targetGroupId}`);
        await chrome.tabs.group({ tabIds: [tab.id], groupId: targetGroupId });
      }
    } catch (error) {
      console.warn('[Arcline] Failed to auto-group new tab', error);
    }
  });

  // Initialize lastActiveGroupId from current state, with fallback to first space
  chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(async ([tab]) => {
    if (tab?.groupId !== -1 && tab?.groupId !== undefined) {
      lastActiveGroupId = tab.groupId;
      console.log('[Arcline] 🛡️ AutoGroup: initial lastActiveGroupId =', lastActiveGroupId);
    } else {
      // Fallback to first available group if active tab is not in a group
      const firstGroupId = await getFirstAvailableGroupId();
      if (firstGroupId !== -1) {
        lastActiveGroupId = firstGroupId;
        console.log(
          '[Arcline] 🛡️ AutoGroup: active tab not in group, defaulting to first space:',
          lastActiveGroupId
        );
      }
    }

    // Assign any existing ungrouped tabs to the first space
    await assignUngroupedTabsToFirstSpace();
  });
}
