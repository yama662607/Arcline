/// <reference types="chrome" />

import type { TabGroupColor } from '@/shared/chrome-types';
import {
  defaultSettings,
  SETTINGS_MIGRATED_TO_LOCAL_KEY,
  SETTINGS_MIGRATED_TO_NAMESPACED_KEY,
  SETTINGS_STORAGE_KEY,
  settingsSchema,
} from '@/shared/settings';
import {
  countArcifyBookmarks,
  createPinnedFolder,
  createPinnedTab,
  exportSpaceBookmarks,
  importSpaceBookmarks,
  movePinnedItem,
  removePinnedItem,
  updatePinnedItem,
} from './bookmarks';
import { openFloatingUiOnTab } from './ui-messaging';
import type {
  ArchivedTab,
  PinnedItem,
  Settings,
  SpaceSnapshot,
  TabEntry,
  PinnedFolder,
  PinnedTab,
} from '@/shared/types';
import { db } from '@/db';
import type { SpaceRecord } from '@/db/schema';

const TAB_GROUP_ID_NONE = -1;
const isTabGroupsSupported = () =>
  typeof chrome !== 'undefined' && typeof chrome.tabGroups !== 'undefined';

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
    last_accessed: tab.lastAccessed,
  };
}

type SpaceSnapshotInit = {
  id: number;
  name: string;
  color: TabGroupColor;
  windowId: number;
  timestamp: number;
};

// Helper to recursively link PinnedItems to open tabs

function linkPinnedItemsToOpenTabs(items: PinnedItem[], openTabs: TabEntry[]) {
  for (const item of items) {
    if (item.type === 'tab') {
      const matchingTab = openTabs.find((t) => t.url === item.url);
      if (matchingTab) {
        item.tabId = matchingTab.id;
      }
    } else {
      linkPinnedItemsToOpenTabs(item.children, openTabs);
    }
  }
}

async function queryChromeState(): Promise<{
  tabGroups: chrome.tabGroups.TabGroup[];
  allTabs: chrome.tabs.Tab[];
}> {
  const tabGroups = isTabGroupsSupported() ? await chrome.tabGroups.query({}) : [];
  const allTabs = await chrome.tabs.query({});
  return { tabGroups, allTabs };
}

function createEmptySpaceSnapshot({
  id,
  name,
  color,
  windowId,
  timestamp,
}: SpaceSnapshotInit): SpaceSnapshot {
  return {
    id,
    name,
    color,
    tabs: [],
    pinnedTabs: [],
    pinnedItems: [],
    temporaryTabs: [],
    windowId,
    created_at: timestamp,
    last_active_at: timestamp,
  };
}

type GlobalPinnedMap = Map<number, TabEntry>;

function getGroupedSpace(groupId: number | undefined, groupMap: Map<number, SpaceSnapshot>) {
  if (typeof groupId !== 'number' || groupId < 0) {
    return undefined;
  }
  return groupMap.get(groupId);
}

function addTabToGroupedSpace(entry: TabEntry, space: SpaceSnapshot) {
  if (entry.pinned) {
    space.pinnedTabs.push(entry);
  } else {
    space.tabs.push(entry);
  }
}

function addTabToUngroupedSpace(entry: TabEntry, ungrouped: SpaceSnapshot) {
  if (entry.pinned) {
    ungrouped.pinnedTabs.push(entry);
  } else {
    ungrouped.temporaryTabs.push(entry);
  }
}

function distributeTabs(
  tabs: chrome.tabs.Tab[],
  groupMap: Map<number, SpaceSnapshot>,
  ungrouped: SpaceSnapshot,
  globalPinned: GlobalPinnedMap
) {
  for (const tab of tabs) {
    const entry = mapTab(tab);
    if (!entry) {
      continue;
    }

    if (entry.pinned) {
      globalPinned.set(entry.id, { ...entry, pinned: true });
    }

    const space = getGroupedSpace(tab.groupId, groupMap);
    if (space) {
      addTabToGroupedSpace(entry, space);
      continue;
    }

    addTabToUngroupedSpace(entry, ungrouped);
  }
}

function hasUngroupedContent(ungrouped: SpaceSnapshot): boolean {
  return ungrouped.pinnedTabs.length > 0 || ungrouped.temporaryTabs.length > 0;
}

function mergeGlobalPinnedTabs(spaces: SpaceSnapshot[], globalPinned: GlobalPinnedMap) {
  if (globalPinned.size === 0) {
    return;
  }

  const globalPinnedEntries = Array.from(globalPinned.values());

  for (const space of spaces) {
    const dedupe = new Map<number, TabEntry>();

    for (const entry of globalPinnedEntries) {
      dedupe.set(entry.id, { ...entry, pinned: true });
    }

    for (const entry of space.pinnedTabs) {
      dedupe.set(entry.id, { ...entry, pinned: true });
    }

    space.pinnedTabs = Array.from(dedupe.values());
  }
}

export async function getActiveTabEntry(): Promise<TabEntry | null> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab ? mapTab(activeTab) : null;
}

// --- Helper types for getSpacesSnapshot ---
interface SnapshotBuildContext {
  snapshots: SpaceSnapshot[];
  groupMap: Map<number, SpaceSnapshot>;
  seenGroupIds: Set<number>;
  activeGroupMap: Map<string, chrome.tabGroups.TabGroup>;
  timestamp: number;
}

async function buildSnapshotsFromDbSpaces(
  dbSpaces: SpaceRecord[],
  ctx: SnapshotBuildContext
): Promise<void> {
  for (const dbSpace of dbSpaces) {
    const activeGroup = ctx.activeGroupMap.get(dbSpace.name);
    const snapshotId = activeGroup?.id ?? TAB_GROUP_ID_NONE;

    const snapshot = createEmptySpaceSnapshot({
      id: snapshotId,
      name: dbSpace.name,
      color: (activeGroup?.color as TabGroupColor) || (dbSpace.color as TabGroupColor) || 'grey',
      windowId: activeGroup?.windowId ?? -1,
      timestamp: dbSpace.updatedAt.getTime(),
    });

    snapshot.uuid = dbSpace.uuid;
    if (dbSpace.id !== undefined) {
      snapshot.pinnedItems = await getPinnedItemsFromDb(dbSpace.id);
    }

    ctx.snapshots.push(snapshot);

    if (snapshotId !== TAB_GROUP_ID_NONE) {
      ctx.groupMap.set(snapshotId, snapshot);
      ctx.seenGroupIds.add(snapshotId);
    }

    // Sync tabGroupId back to DB if it changed
    if (dbSpace.id !== undefined && dbSpace.tabGroupId !== activeGroup?.id) {
      await db.spaces.update(dbSpace.id, { tabGroupId: activeGroup?.id });
    }
  }
}

function addGhostGroupSnapshots(
  tabGroups: chrome.tabGroups.TabGroup[],
  ctx: SnapshotBuildContext
): void {
  for (const group of tabGroups) {
    if (ctx.seenGroupIds.has(group.id)) continue;

    const snapshot = createEmptySpaceSnapshot({
      id: group.id,
      name: group.title || 'Untitled',
      color: (group.color ?? 'grey') as TabGroupColor,
      windowId: group.windowId ?? -1,
      timestamp: ctx.timestamp,
    });

    snapshot.uuid = `ghost-group-${group.id}`;
    ctx.snapshots.push(snapshot);
    ctx.groupMap.set(group.id, snapshot);
  }
}

function linkAllPinnedItemsToTabs(finalSnapshots: SpaceSnapshot[]): void {
  for (const snapshot of finalSnapshots) {
    if (snapshot.pinnedItems.length > 0) {
      linkPinnedItemsToOpenTabs(snapshot.pinnedItems, [
        ...snapshot.temporaryTabs,
        ...snapshot.tabs,
      ]);
    }
  }
}

export async function getSpacesSnapshot(): Promise<SpaceSnapshot[]> {
  try {
    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    // 1. Get data from Dexie and Chrome
    const dbSpaces = await db.spaces.orderBy('sortOrder').toArray();
    const { tabGroups, allTabs } = await queryChromeState();
    const timestamp = Date.now();

    // Build active group lookup
    const activeGroupMap = new Map<string, chrome.tabGroups.TabGroup>();
    for (const tg of tabGroups) {
      if (tg.title) {
        activeGroupMap.set(tg.title, tg);
      }
    }

    // Initialize context
    const ctx: SnapshotBuildContext = {
      snapshots: [],
      groupMap: new Map(),
      seenGroupIds: new Set(),
      activeGroupMap,
      timestamp,
    };

    // 2. Build snapshots from DB spaces
    await buildSnapshotsFromDbSpaces(dbSpaces, ctx);

    // 3. Handle ghost groups (active in Chrome but not in DB)
    addGhostGroupSnapshots(tabGroups, ctx);

    // 4. Create ungrouped snapshot
    const ungrouped = createEmptySpaceSnapshot({
      id: TAB_GROUP_ID_NONE,
      name: 'Ungrouped',
      color: 'grey' as TabGroupColor,
      windowId: -1,
      timestamp,
    });
    ungrouped.uuid = 'ungrouped-space';

    // 5. Distribute tabs
    const globalPinned: GlobalPinnedMap = new Map();
    distributeTabs(allTabs, ctx.groupMap, ungrouped, globalPinned);

    // 6. Finalize list
    const finalSnapshots = [...ctx.snapshots];
    if (hasUngroupedContent(ungrouped)) {
      finalSnapshots.push(ungrouped);
    }
    mergeGlobalPinnedTabs(finalSnapshots, globalPinned);

    // 7. Link pinned items to open tabs
    linkAllPinnedItemsToTabs(finalSnapshots);

    cachedSnapshot = finalSnapshots;
    return finalSnapshots;
  } catch (error) {
    console.warn('[Arcline] Failed to load spaces snapshot from Dexie', error);
    return [];
  }
}

export async function toggleTabPinned(tabId: number, nextPinned?: boolean): Promise<boolean> {
  const tab = await chrome.tabs.get(tabId);
  const pinned = nextPinned ?? !tab.pinned;
  await chrome.tabs.update(tabId, { pinned });

  await broadcastSpacesSnapshot();
  return pinned;
}

export async function moveTabToSpace(tabId: number, spaceId: number): Promise<number | null> {
  let result: number | null = null;

  if (!isTabGroupsSupported()) {
    await chrome.tabs.ungroup(tabId);
  } else if (spaceId === TAB_GROUP_ID_NONE) {
    await chrome.tabs.ungroup(tabId);
  } else {
    result = await chrome.tabs.group({ groupId: spaceId, tabIds: [tabId] });
  }

  try {
    await chrome.tabs.get(tabId);
    // Note: We no longer manually update SpaceState in localStorage here,
    // getSpacesSnapshot will derive everything from live state and Dexie.
  } catch (error) {
    console.warn('[Arcline] Failed to update state for moved tab', error);
  }

  await broadcastSpacesSnapshot();
  return result;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: space creation flow has multiple branches
export async function createSpace(name: string, color?: TabGroupColor): Promise<number> {
  if (!isTabGroupsSupported()) {
    throw new Error('Tab groups are not supported in this browser');
  }

  let groupId: number;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id) {
    groupId = await chrome.tabs.group({ tabIds: [activeTab.id] });
  } else {
    // Create empty group by grouping a dummy tab and then ungrouping it
    const tempTab = await chrome.tabs.create({ url: 'about:blank', active: false });
    if (tempTab.id) {
      groupId = await chrome.tabs.group({ tabIds: [tempTab.id] });
      await chrome.tabs.remove(tempTab.id);
    } else {
      throw new Error('Failed to create temporary tab for group creation');
    }
  }

  await chrome.tabGroups.update(groupId, {
    title: name,
    color: (color ?? 'blue') as TabGroupColor,
  });

  // Sync new space to bookmarks
  try {
    await syncSpaceToBookmarks(name, []);
  } catch (error) {
    console.warn(`[Arcline] Failed to sync new space "${name}" to bookmarks:`, error);
  }

  await broadcastSpacesSnapshot();

  return groupId;
}

export async function removeSpace(spaceId: number): Promise<void> {
  if (!isTabGroupsSupported()) return;

  // Get space name for bookmark cleanup
  const spaces = await getSpacesSnapshot();
  const space = spaces.find((s) => s.id === spaceId);
  const spaceName = space?.name;

  const tabs = await chrome.tabs.query({ groupId: spaceId });
  if (!tabs.length) {
    await broadcastSpacesSnapshot();
    return;
  }

  const tabIds = tabs
    .map((tab) => tab.id)
    .filter((id): id is number => id !== undefined && typeof id === 'number');

  if (tabIds.length === 0) return;

  await chrome.tabs.ungroup(tabIds as [number, ...number[]]);

  // Remove space folder from bookmarks
  if (spaceName) {
    try {
      await removeSpaceFolder(spaceName);
    } catch (error) {
      console.warn(`[Arcline] Failed to remove bookmark folder for space "${spaceName}":`, error);
    }
  }

  await broadcastSpacesSnapshot();
}

export async function broadcastSpacesSnapshot(): Promise<void> {
  // Clear cache to ensure next call fetches fresh data
  cachedSnapshot = null;
  const spaces = await getSpacesSnapshot();
  try {
    await chrome.runtime.sendMessage({ command: 'spacesSnapshot', spaces });
  } catch (_error) {
    // Silently ignore if no listeners are connected (e.g., side panel is closed)
    // This is expected behavior and not an error
  }
}

function findAdjacentTabId(
  spaces: Array<{
    pinnedTabs: Array<{ id?: number }>;
    tabs: Array<{ id?: number }>;
    temporaryTabs: Array<{ id?: number }>;
  }>,
  tabId: number
): number | undefined {
  for (const space of spaces) {
    const allTabs = [...space.pinnedTabs, ...space.tabs, ...space.temporaryTabs];
    const index = allTabs.findIndex((tab) => tab.id === tabId);
    if (index === -1) continue;

    const nextTab = allTabs[index + 1]?.id;
    if (nextTab) return nextTab;

    const previousTab = allTabs[index - 1]?.id;
    if (previousTab) return previousTab;

    return undefined;
  }
  return undefined;
}

export async function closeTab(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.active) {
      const spaces = await getSpacesSnapshot();
      const nextTabId = findAdjacentTabId(spaces, tabId);

      if (nextTabId) {
        await chrome.tabs.update(nextTabId, { active: true });
      }
    }
    // Check if this is the last tab in a group
    if (typeof tab.groupId === 'number' && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      await ensureSpaceStaysAlive(tab.groupId, tabId);
    }
  } catch (_error) {
    // Ignore error (e.g. tab already closed)
  }
  await chrome.tabs.remove(tabId);
}

export async function reloadTab(tabId?: number): Promise<void> {
  if (typeof tabId === 'number') {
    await chrome.tabs.reload(tabId);
    return;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id) {
    await chrome.tabs.reload(activeTab.id);
  }
}

export async function activateTab(
  tabId: number,
  options?: { perfId?: string; t0?: number }
): Promise<void> {
  // Atlasブラウザデバッグ用ログ
  const isAtlas = /\bAtlas\b/i.test(navigator.userAgent);
  const browserInfo = {
    userAgent: navigator.userAgent,
    isAtlas,
    tabId,
    timestamp: new Date().toISOString(),
  };

  console.log('[Arcline] 🚀 activateTab called with:', browserInfo);

  const { perfId, t0 } = options || {};
  if (perfId) {
    console.log(
      `[Arcline][Perf][${perfId}] T2: activateTab received in BG at ${new Date(Date.now()).toISOString().split('T')[1]} (Delta T0-T2: ${Date.now() - (t0 || Date.now())}ms)`
    );
  }

  try {
    // タブの存在確認
    const tab = await chrome.tabs.get(tabId);
    console.log('[Arcline] 📋 Tab found:', {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      active: tab.active,
      windowId: tab.windowId,
    });

    // アクティベート実行
    console.log('[Arcline] ⚡ Executing chrome.tabs.update...');
    await chrome.tabs.update(tabId, { active: true });

    if (perfId) {
      console.log(
        `[Arcline][Perf][${perfId}] T5: Tab activation (update) completed at ${new Date(Date.now()).toISOString().split('T')[1]}`
      );
    }

    // 結果確認
    const updatedTab = await chrome.tabs.get(tabId);
    console.log('[Arcline] ✅ Tab activated successfully:', {
      id: updatedTab.id,
      active: updatedTab.active,
      lastActive: updatedTab.lastAccessed,
    });

    // Floating UIを新しいタブで即座に開く
    try {
      console.log('[Arcline] 🔄 Opening Floating UI on target tab...', tabId);
      const spaces = await getSpacesSnapshot();
      const activeSpace = spaces.find((s) =>
        [...s.tabs, ...s.pinnedTabs, ...s.temporaryTabs].some((t) => t.id === tabId)
      );
      // Default to first space or -1/undefined (handled by UI) if not found, though ideally should exist
      const activeSpaceId = activeSpace?.id ?? spaces[0]?.id ?? -1;
      await openFloatingUiOnTab(tabId, spaces, activeSpaceId, options);
    } catch (error) {
      console.warn('[Arcline] Failed to open floating UI on target tab:', error);
    }
  } catch (error) {
    console.error('[Arcline] ❌ activateTab failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack available',
      browserInfo,
      chromeRuntimeAvailable: !!chrome.runtime,
      chromeTabsAvailable: !!chrome.tabs,
    });
    throw error;
  }
}

// Reorder tabs within a space
export async function reorderTab(
  tabId: number,
  spaceId: number,
  newIndex: number,
  listType: 'pinned' | 'temporary'
): Promise<void> {
  if (listType === 'temporary') {
    // For temporary tabs, we use native Chrome move
    // We need to find the correct index in the window/group
    const tabs = await chrome.tabs.query({ groupId: spaceId });
    const sortedTabs = tabs.sort((a, b) => a.index - b.index);

    // Find the target absolute index in the window
    const targetTabIndex =
      sortedTabs[newIndex]?.index ?? sortedTabs[sortedTabs.length - 1]?.index ?? 0;

    await chrome.tabs.move(tabId, { index: targetTabIndex });
  } else {
    // For pinned items (bookmarks), we update sortOrder in Dexie
    // This requires mapping tabId back to a Dexie item
    // Since tabId for pinned items in UI is often the bookmarkId/itemId stringified
    // Wait, the command handler passes number tabId.

    // Let's find the item in Dexie by URL since tabId might not be enough for pinned items
    const tab = await chrome.tabs.get(tabId);
    const item = await db.items.where({ spaceId, url: tab.url }).first();

    if (item?.id) {
      // Update sortOrder for all items in this level
      const siblings = await db.items.where({ spaceId, parentId: item.parentId }).toArray();
      const sortedSiblings = siblings.sort((a, b) => a.sortOrder - b.sortOrder);

      const currentIndex = sortedSiblings.findIndex((s) => s.id === item.id);
      if (currentIndex !== -1) {
        sortedSiblings.splice(currentIndex, 1);
        sortedSiblings.splice(newIndex, 0, item);

        // Batch update sortOrder
        await db.transaction('rw', db.items, async () => {
          for (let i = 0; i < sortedSiblings.length; i++) {
            const sibling = sortedSiblings[i];
            if (sibling?.id) {
              await db.items.update(sibling.id, { sortOrder: i });
            }
          }
        });
      }
    }
  }

  await broadcastSpacesSnapshot();
}

// Settings management
export async function getSettings(): Promise<Settings> {
  const settingKeys = Object.keys(defaultSettings) as Array<keyof Settings>;

  try {
    const localProbe = await chrome.storage.local.get([
      SETTINGS_STORAGE_KEY,
      SETTINGS_MIGRATED_TO_LOCAL_KEY,
      SETTINGS_MIGRATED_TO_NAMESPACED_KEY,
      ...settingKeys,
    ]);

    const alreadyMigratedToLocal = Boolean(localProbe[SETTINGS_MIGRATED_TO_LOCAL_KEY]);
    const alreadyMigratedToNamespaced = Boolean(localProbe[SETTINGS_MIGRATED_TO_NAMESPACED_KEY]);
    const hasNamespacedSettings = typeof localProbe[SETTINGS_STORAGE_KEY] !== 'undefined';
    const hasAnyFlatSetting = settingKeys.some((key) => typeof localProbe[key] !== 'undefined');

    if (!alreadyMigratedToNamespaced) {
      if (hasNamespacedSettings) {
        await chrome.storage.local.set({ [SETTINGS_MIGRATED_TO_NAMESPACED_KEY]: true });
      } else if (hasAnyFlatSetting) {
        const flatSettings = Object.fromEntries(
          settingKeys
            .map((key) => [key, localProbe[key]] as const)
            .filter(([, value]) => typeof value !== 'undefined')
        ) as Partial<Settings>;

        const merged = {
          ...defaultSettings,
          ...flatSettings,
        };

        await chrome.storage.local.set({
          [SETTINGS_STORAGE_KEY]: merged,
          [SETTINGS_MIGRATED_TO_NAMESPACED_KEY]: true,
        });

        await chrome.storage.local.remove(settingKeys);
      } else {
        if (alreadyMigratedToLocal) {
          await chrome.storage.local.set({
            [SETTINGS_STORAGE_KEY]: defaultSettings,
            [SETTINGS_MIGRATED_TO_NAMESPACED_KEY]: true,
          });
        } else {
          const legacy = await chrome.storage.sync.get(settingKeys);
          const merged = {
            ...defaultSettings,
            ...(legacy as Partial<Settings>),
          };

          await chrome.storage.local.set({
            [SETTINGS_STORAGE_KEY]: merged,
            [SETTINGS_MIGRATED_TO_LOCAL_KEY]: true,
            [SETTINGS_MIGRATED_TO_NAMESPACED_KEY]: true,
          });
        }
      }
    }
  } catch (error) {
    console.warn('[Arcline] Failed to migrate settings to local storage:', error);
  }

  const result = await chrome.storage.local.get([SETTINGS_STORAGE_KEY]);
  return settingsSchema.parse((result[SETTINGS_STORAGE_KEY] as unknown) ?? {});
}

export async function updateSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  const patch = Object.fromEntries(
    Object.entries(settings).filter(([, value]) => typeof value !== 'undefined')
  ) as Partial<Settings>;

  await chrome.storage.local.set({
    [SETTINGS_STORAGE_KEY]: {
      ...current,
      ...patch,
    },
  });
}

// Archive functionality
const ARCHIVED_TABS_KEY = 'archivedTabs';
const MAX_ARCHIVED_TABS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRecordNumberToNumber(value: unknown): Record<number, number> {
  if (!isRecord(value)) return {};
  const out: Record<number, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const parsedKey = Number(key);
    if (!Number.isFinite(parsedKey)) continue;
    if (typeof raw !== 'number') continue;
    out[parsedKey] = raw;
  }
  return out;
}

function parseTabNameOverrides(
  value: unknown
): Record<number, { name: string; originalDomain: string }> {
  if (!isRecord(value)) return {};
  const out: Record<number, { name: string; originalDomain: string }> = {};
  for (const [key, raw] of Object.entries(value)) {
    const parsedKey = Number(key);
    if (!Number.isFinite(parsedKey)) continue;
    if (!isRecord(raw)) continue;
    const name = raw.name;
    const originalDomain = raw.originalDomain;
    if (typeof name !== 'string' || typeof originalDomain !== 'string') continue;
    out[parsedKey] = { name, originalDomain };
  }
  return out;
}

export async function getArchivedTabs(): Promise<ArchivedTab[]> {
  const result = await chrome.storage.local.get(ARCHIVED_TABS_KEY);
  const raw = (result as Record<string, unknown>)[ARCHIVED_TABS_KEY];
  return Array.isArray(raw) ? (raw as ArchivedTab[]) : [];
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
    if (targetSpace && newTab.id) {
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

// Import bookmark functionality from dedicated service
import {
  getBookmarksForSpace as getBookmarksForSpaceFromService,
  removeSpaceFolder,
  syncSpaceToBookmarks,
} from './bookmarks';

export const getBookmarksForSpace = getBookmarksForSpaceFromService;

export { searchBookmarks } from './bookmarks';
export { searchHistory } from './history';

// Tab name overrides
const TAB_NAME_OVERRIDES_KEY = 'tabNameOverridesById';

export async function getTabNameOverrides(): Promise<
  Record<number, { name: string; originalDomain: string }>
> {
  const result = await chrome.storage.local.get(TAB_NAME_OVERRIDES_KEY);
  const raw = (result as Record<string, unknown>)[TAB_NAME_OVERRIDES_KEY];
  return parseTabNameOverrides(raw);
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
    const raw = (result as Record<string, unknown>)[TAB_ACTIVITY_STORAGE_KEY];
    const activityData = parseRecordNumberToNumber(raw);
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
    const raw = (result as Record<string, unknown>)[TAB_ACTIVITY_STORAGE_KEY];
    const activityData = parseRecordNumberToNumber(raw);
    delete activityData[tabId];
    await chrome.storage.local.set({ [TAB_ACTIVITY_STORAGE_KEY]: activityData });
  } catch (error) {
    console.error('Error removing tab activity:', error);
  }
}

export async function getTabActivity(): Promise<Record<number, number>> {
  const result = await chrome.storage.local.get(TAB_ACTIVITY_STORAGE_KEY);
  const raw = (result as Record<string, unknown>)[TAB_ACTIVITY_STORAGE_KEY];
  return parseRecordNumberToNumber(raw);
}

export {
  createPinnedFolder,
  createPinnedTab,
  exportSpaceBookmarks,
  importSpaceBookmarks,
  movePinnedItem,
  removePinnedItem,
  updatePinnedItem,
};

// Caching infrastructure
let cachedSnapshot: SpaceSnapshot[] | null = null;

export function clearCachedSnapshot() {
  cachedSnapshot = null;
}
let snapshotInvalidationTimer: ReturnType<typeof setTimeout> | null = null;

function invalidateSnapshot() {
  if (snapshotInvalidationTimer) {
    clearTimeout(snapshotInvalidationTimer);
  }

  // Use a small debounce to batch rapid changes (e.g. "Close Other Tabs")
  snapshotInvalidationTimer = setTimeout(() => {
    cachedSnapshot = null;
    void broadcastSpacesSnapshot();
    snapshotInvalidationTimer = null;
  }, 50);
}

// Setup listeners for cache invalidation
if (typeof chrome !== 'undefined' && chrome.tabs) {
  chrome.tabs.onCreated.addListener(invalidateSnapshot);
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      cleanupEmptySpaceTab(tab.groupId);
    }
    // Only invalidate if relevant properties change
    if (
      changeInfo.status === 'loading' ||
      changeInfo.title ||
      changeInfo.favIconUrl ||
      changeInfo.pinned
    ) {
      invalidateSnapshot();
    }
  });
  chrome.tabs.onRemoved.addListener(invalidateSnapshot);
  chrome.tabs.onMoved.addListener(invalidateSnapshot);
  chrome.tabs.onAttached.addListener(invalidateSnapshot);
  chrome.tabs.onDetached.addListener(invalidateSnapshot);
}

if (typeof chrome !== 'undefined' && chrome.tabGroups) {
  chrome.tabGroups.onCreated?.addListener?.(invalidateSnapshot);
  chrome.tabGroups.onUpdated?.addListener?.(invalidateSnapshot);
  chrome.tabGroups.onRemoved?.addListener?.(invalidateSnapshot);
  chrome.tabGroups.onMoved?.addListener?.(invalidateSnapshot);
}
/**
 * ブックマークの数をカウントする（検証用）
 */
export async function countBookmarks(): Promise<{ spaces: number; items: number }> {
  return countArcifyBookmarks();
}

/**
 * まだアクティブなスペース（タブグループ）になっていないブックマークフォルダを取得
 */
export async function getInactiveSpaces(): Promise<string[]> {
  const snapshots = await getSpacesSnapshot();
  return snapshots
    .filter((s) => s.id === TAB_GROUP_ID_NONE && s.name !== 'Ungrouped')
    .map((s) => s.name);
}

/**
 * ブックマークフォルダからスペースを復元する
 */
export async function restoreSpaceByFolderName(folderName: string): Promise<number> {
  // 新しいスペースを作成（名前をフォルダ名に合わせる）
  const groupId = await createSpace(folderName);
  // 作成したスペースに対してブックマークを同期
  // createSpace内部で既に getPinnedItemsForSpace が呼ばれるはずなので、
  // Snapshotを再取得してブロードキャストするだけでよい
  await broadcastSpacesSnapshot();
  return groupId;
}

async function ensureSpaceStaysAlive(groupId: number, currentTabId: number): Promise<void> {
  const groupTabs = await chrome.tabs.query({ groupId });
  const lastTab = groupTabs[0];
  if (groupTabs.length === 1 && lastTab?.id === currentTabId) {
    // Create placeholder to keep space alive
    const spaces = await getSpacesSnapshot();
    const space = spaces.find((s) => s.id === groupId);
    const color = space?.color || 'grey';
    const url = chrome.runtime.getURL(`empty - space.html ? color = ${encodeURIComponent(color)} `);
    const newTab = await chrome.tabs.create({ url, active: true });
    if (newTab.id) {
      await chrome.tabs.group({ tabIds: [newTab.id], groupId });
    }
  }
}

async function cleanupEmptySpaceTab(groupId: number): Promise<void> {
  const tabs = await chrome.tabs.query({ groupId });
  if (tabs.length <= 1) return;

  const emptyTab = tabs.find((t) => t.url?.includes('empty-space.html'));
  if (emptyTab?.id) {
    await chrome.tabs.remove(emptyTab.id);
  }
}

async function getPinnedItemsFromDb(spaceId: number): Promise<PinnedItem[]> {
  const allItems = await db.items.where('spaceId').equals(spaceId).toArray();

  // Create lookup map for parent-child relationship
  const itemsByParent = new Map<number | undefined, any[]>();
  for (const item of allItems) {
    const parentId = item.parentId;
    if (!itemsByParent.has(parentId)) {
      itemsByParent.set(parentId, []);
    }
    itemsByParent.get(parentId)?.push(item);
  }

  function buildTree(parentId: number | undefined): PinnedItem[] {
    const children = itemsByParent.get(parentId) || [];
    return children
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => {
        if (item.type === 'folder') {
          return {
            type: 'folder',
            id: String(item.id),
            title: item.name || item.title,
            children: buildTree(item.id),
            parentId: item.parentId ? String(item.parentId) : undefined,
          } as PinnedFolder;
        }
        return {
          type: 'tab',
          id: String(item.id),
          url: item.url || '',
          title: item.title,
          favIconUrl: item.faviconUrl,
          parentId: item.parentId ? String(item.parentId) : undefined,
        } as PinnedTab;
      });
  }

  return buildTree(undefined);
}
