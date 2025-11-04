/// <reference types="chrome" />
import type { ArchivedTab, Settings, SpaceSnapshot, TabEntry } from '@/shared/types';

const _DEFAULT_COLORS: Record<string, string> = {
  grey: '#64748b',
  blue: '#3b82f6',
  red: '#ef4444',
  yellow: '#facc15',
  green: '#22c55e',
  pink: '#ec4899',
  purple: '#a855f7',
  cyan: '#06b6d4',
};

const TAB_GROUPS_SUPPORTED = typeof chrome.tabGroups !== 'undefined';
const TAB_GROUP_ID_NONE = TAB_GROUPS_SUPPORTED ? chrome.tabGroups?.TAB_GROUP_ID_NONE : -1;

function mapTab(tab: chrome.tabs.Tab): TabEntry | null {
  if (typeof tab.id !== 'number') return null;

  return {
    id: tab.id,
    title: tab.title ?? 'Untitled',
    url: tab.url ?? '',
    favIconUrl: tab.favIconUrl,
    pinned: Boolean(tab.pinned),
    active: Boolean(tab.active),
    windowId: tab.windowId ?? -1,
    groupId: tab.groupId ?? TAB_GROUP_ID_NONE,
    lastAccessed: tab.lastAccessed,
  };
}

function colorFromGroup(group: chrome.tabGroups.TabGroup): chrome.tabGroups.ColorEnum {
  return group.color ?? 'grey';
}

export async function getSpacesSnapshot(): Promise<SpaceSnapshot[]> {
  try {
    const [tabGroups, allTabs] = await Promise.all([
      TAB_GROUPS_SUPPORTED
        ? chrome.tabGroups?.query({})
        : Promise.resolve<chrome.tabGroups.TabGroup[]>([]),
      chrome.tabs.query({}),
    ]);

    const groupMap = new Map<number, SpaceSnapshot>();

    for (const group of tabGroups) {
      groupMap.set(group.id, {
        id: group.id,
        name: group.title,
        color: group.color || 'grey',
        tabs: [],
        pinnedTabs: [],
        temporaryTabs: [],
        windowId: group.windowId,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      });
    }

    const ungrouped: SpaceSnapshot = {
      id: TAB_GROUP_ID_NONE,
      name: 'Ungrouped',
      color: 'grey' as chrome.tabGroups.ColorEnum,
      pinnedTabs: [],
      temporaryTabs: [],
      windowId: -1,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    for (const tab of allTabs) {
      const entry = mapTab(tab);
      
      if (typeof tab.groupId === 'number' && tab.groupId >= 0) {
        const space = groupMap.get(tab.groupId);
        if (space) {
          if (entry.pinned) {
            space.pinnedTabs.push(entry);
          } else {
            space.tabs.push(entry);
          }
        }
      } else {
        if (entry.pinned) {
          ungrouped.pinnedTabs.push(entry);
        } else {
          ungrouped.temporaryTabs.push(entry);
        }
      }
    }

    const spaces: SpaceSnapshot[] = [];

    for (const space of groupMap.values()) {
      spaces.push(space);
    }

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

export async function createSpace(
  name: string,
  color?: chrome.tabGroups.ColorEnum
): Promise<number> {
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
    color: color ?? 'blue',
  });
  return groupId;
}

export async function removeSpace(spaceId: number): Promise<void> {
  if (!TAB_GROUPS_SUPPORTED) return;

  const tabs = await chrome.tabs.query({ groupId: spaceId });
  if (!tabs.length) return;

  await chrome.tabs.ungroup(
    tabs.map((tab) => tab.id!).filter((id): id is number => typeof id === 'number')
  );
}

export async function broadcastSpacesSnapshot(): Promise<void> {
  const spaces = await getSpacesSnapshot();
  try {
    await chrome.runtime.sendMessage({ command: 'spacesSnapshot', spaces });
  } catch (_error) {
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

// Settings management
export async function getSettings(): Promise<Settings> {
  const defaultSettings: Settings = {
    defaultSpaceName: 'Home',
    autoArchiveEnabled: false,
    autoArchiveIdleMinutes: 30,
    uiMode: 'side-panel',
    showFavicons: true,
    compactMode: false,
    enableAnimations: true,
    theme: 'auto',
  };

  const result = await chrome.storage.sync.get(defaultSettings);
  return result as Settings;
}

export async function updateSettings(settings: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(settings);
}

// Archive functionality
const ARCHIVED_TABS_KEY = 'archivedTabs';
const MAX_ARCHIVED_TABS = 100;

export async function getArchivedTabs(): Promise<ArchivedTab[]> {
  const result = await chrome.storage.local.get(ARCHIVED_TABS_KEY);
  return result[ARCHIVED_TABS_KEY] || [];
}

export async function addArchivedTab(
  tabData: Omit<ArchivedTab, 'id' | 'archivedAt'>
): Promise<void> {
  if (!tabData || !tabData.url || !tabData.title || !tabData.spaceId) return;

  const archivedTabs = await getArchivedTabs();

  // Check for duplicates
  const exists = archivedTabs.some((t) => t.url === tabData.url && t.spaceId === tabData.spaceId);
  if (exists) return;

  // Add new tab with timestamp and ID
  const newArchiveEntry: ArchivedTab = {
    ...tabData,
    id: `archive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    archivedAt: Date.now(),
  };

  archivedTabs.push(newArchiveEntry);

  // Sort by timestamp (newest first)
  archivedTabs.sort((a, b) => b.archivedAt - a.archivedAt);

  // Enforce limit (remove oldest if over limit)
  if (archivedTabs.length > MAX_ARCHIVED_TABS) {
    archivedTabs.splice(MAX_ARCHIVED_TABS);
  }

  await chrome.storage.local.set({ [ARCHIVED_TABS_KEY]: archivedTabs });
}

export async function removeArchivedTab(url: string, spaceId: number): Promise<void> {
  if (!url || !spaceId) return;

  let archivedTabs = await getArchivedTabs();
  archivedTabs = archivedTabs.filter((tab) => !(tab.url === url && tab.spaceId === spaceId));
  await chrome.storage.local.set({ [ARCHIVED_TABS_KEY]: archivedTabs });
}

export async function archiveTab(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || !tab.title) return;

    // Get current active space
    const spaces = await getSpacesSnapshot();
    const activeSpace = spaces.find((s) => s.windowId === tab.windowId);
    if (!activeSpace) return;

    const tabData = {
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      spaceId: activeSpace.id,
      spaceName: activeSpace.name,
      originalTabId: tabId,
    };

    await addArchivedTab(tabData);
    await chrome.tabs.remove(tabId);
  } catch (error) {
    console.error(`Error archiving tab ${tabId}:`, error);
    throw error;
  }
}

export async function restoreArchivedTab(archivedTab: ArchivedTab): Promise<void> {
  try {
    // Create the tab
    const newTab = await chrome.tabs.create({
      url: archivedTab.url,
      active: true,
    });

    // Group the new tab into the correct space
    const spaces = await getSpacesSnapshot();
    const targetSpace = spaces.find((s) => s.id === archivedTab.spaceId);
    if (targetSpace) {
      await chrome.tabs.group({
        tabIds: [newTab.id],
        groupId: targetSpace.id,
      });
    }

    // Remove from archive
    await removeArchivedTab(archivedTab.url, archivedTab.spaceId);
  } catch (error) {
    console.error(`Error restoring archived tab ${archivedTab.url}:`, error);
    throw error;
  }
}

// Bookmark functionality
export async function getOrCreateArcifyFolder(): Promise<chrome.bookmarks.BookmarkTreeNode> {
  let [folder] = await chrome.bookmarks.search({ title: 'Arcline' });
  if (!folder) {
    folder = await chrome.bookmarks.create({ title: 'Arcline' });
  }
  return folder;
}

export async function getOrCreateSpaceFolder(
  spaceName: string
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  const arcifyFolder = await getOrCreateArcifyFolder();
  const children = await chrome.bookmarks.getChildren(arcifyFolder.id);
  let spaceFolder = children.find((f) => f.title === spaceName);

  if (!spaceFolder) {
    spaceFolder = await chrome.bookmarks.create({
      parentId: arcifyFolder.id,
      title: spaceName,
    });
  }
  return spaceFolder;
}

export async function getBookmarksForSpace(spaceId: number): Promise<TabEntry[]> {
  try {
    // Get space info
    const spaces = await getSpacesSnapshot();
    const space = spaces.find((s) => s.id === spaceId);
    if (!space) return [];

    // Get space bookmark folder
    const spaceFolder = await getOrCreateSpaceFolder(space.name);

    // Get all bookmarks in the space folder (recursive)
    const bookmarks: TabEntry[] = [];
    const processFolder = async (folderId: string) => {
      const items = await chrome.bookmarks.getChildren(folderId);
      for (const item of items) {
        if (item.url) {
          // This is a bookmark, convert to TabEntry format
          bookmarks.push({
            id: 0, // Bookmarks don't have tab IDs
            url: item.url,
            title: item.title,
            favIconUrl: undefined, // Would need to fetch separately
            pinned: false, // Bookmarks are not pinned tabs
            active: false,
            windowId: 0,
            groupId: spaceId,
            lastAccessed: item.dateAdded,
          });
        } else if (!item.url) {
          // This is a folder, process recursively
          await processFolder(item.id);
        }
      }
    };

    await processFolder(spaceFolder.id);
    return bookmarks;
  } catch (error) {
    console.error(`Error getting bookmarks for space ${spaceId}:`, error);
    return [];
  }
}

export async function processBookmarkFolder(
  folder: chrome.bookmarks.BookmarkTreeNode,
  groupId: number
): Promise<number[]> {
  const bookmarks: number[] = [];
  const items = await chrome.bookmarks.getChildren(folder.id);
  const tabs = await chrome.tabs.query({ groupId });

  for (const item of items) {
    if (item.url) {
      // This is a bookmark
      const tab = tabs.find((t) => t.url === item.url);
      if (tab) {
        bookmarks.push(tab.id);
        // Set tab name override with the bookmark's title
        if (item.title && item.title !== tab.title) {
          await setTabNameOverride(tab.id, tab.url, item.title);
        }
      }
    } else {
      // This is a folder, recursively process it
      const subFolderBookmarks = await processBookmarkFolder(item, groupId);
      bookmarks.push(...subFolderBookmarks);
    }
  }

  return bookmarks;
}

// Tab name overrides
const TAB_NAME_OVERRIDES_KEY = 'tabNameOverridesById';

export async function getTabNameOverrides(): Promise<
  Record<number, { name: string; originalDomain: string }>
> {
  const result = await chrome.storage.local.get(TAB_NAME_OVERRIDES_KEY);
  return result[TAB_NAME_OVERRIDES_KEY] || {};
}

export async function saveTabNameOverrides(
  overrides: Record<number, { name: string; originalDomain: string }>
): Promise<void> {
  await chrome.storage.local.set({ [TAB_NAME_OVERRIDES_KEY]: overrides });
}

export async function setTabNameOverride(tabId: number, url: string, name: string): Promise<void> {
  if (!tabId || !url || !name) return;

  const overrides = await getTabNameOverrides();
  try {
    const originalDomain = new URL(url).hostname;
    overrides[tabId] = { name, originalDomain };
    await saveTabNameOverrides(overrides);
  } catch (e) {
    console.error('Error setting tab name override:', e);
  }
}

export async function removeTabNameOverride(tabId: number): Promise<void> {
  if (!tabId) return;

  const overrides = await getTabNameOverrides();
  if (overrides[tabId]) {
    delete overrides[tabId];
    await saveTabNameOverrides(overrides);
  }
}

// Tab activity tracking for auto-archive
const TAB_ACTIVITY_STORAGE_KEY = 'tabLastActivity';

export async function updateTabLastActivity(tabId: number): Promise<void> {
  if (!tabId) return;
  try {
    const result = await chrome.storage.local.get(TAB_ACTIVITY_STORAGE_KEY);
    const activityData = result[TAB_ACTIVITY_STORAGE_KEY] || {};
    activityData[tabId] = Date.now();
    await chrome.storage.local.set({ [TAB_ACTIVITY_STORAGE_KEY]: activityData });
  } catch (error) {
    console.error('Error updating tab activity:', error);
  }
}

export async function removeTabLastActivity(tabId: number): Promise<void> {
  if (!tabId) return;
  try {
    const result = await chrome.storage.local.get(TAB_ACTIVITY_STORAGE_KEY);
    const activityData = result[TAB_ACTIVITY_STORAGE_KEY] || {};
    delete activityData[tabId];
    await chrome.storage.local.set({ [TAB_ACTIVITY_STORAGE_KEY]: activityData });
  } catch (error) {
    console.error('Error removing tab activity:', error);
  }
}

export async function getTabActivity(): Promise<Record<number, number>> {
  const result = await chrome.storage.local.get(TAB_ACTIVITY_STORAGE_KEY);
  return result[TAB_ACTIVITY_STORAGE_KEY] || {};
}
