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

    // If the tab is already grouped, or if we don't have a valid active group, do nothing
    if (tab.groupId !== -1 || lastActiveGroupId === -1) {
      return;
    }

    // Check if the last active group still exists
    try {
      await chrome.tabGroups.get(lastActiveGroupId);
    } catch {
      // Group no longer exists, reset tracker
      lastActiveGroupId = -1;
      return;
    }

    // Move the new tab into the group
    try {
      if (tab.id) {
        console.log(
          `[Arcline] 🛡️ AutoGroup: moving new tab ${tab.id} to group ${lastActiveGroupId}`
        );
        await chrome.tabs.group({ tabIds: [tab.id], groupId: lastActiveGroupId });
      }
    } catch (error) {
      console.warn('[Arcline] Failed to auto-group new tab', error);
    }
  });

  // Initialize lastActiveGroupId from current state
  chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => {
    if (tab?.groupId !== -1 && tab?.groupId !== undefined) {
      lastActiveGroupId = tab.groupId;
      console.log('[Arcline] 🛡️ AutoGroup: initial lastActiveGroupId =', lastActiveGroupId);
    }
  });
}
