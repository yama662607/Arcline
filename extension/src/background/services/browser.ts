/// <reference types="chrome" />

import type { TabGroupColor } from '@/shared/chrome-types';
import {
  defaultSettings,
  SETTINGS_MIGRATED_TO_LOCAL_KEY,
  SETTINGS_MIGRATED_TO_NAMESPACED_KEY,
  SETTINGS_STORAGE_KEY,
  settingsSchema,
} from '@/shared/settings';
import type { ArchivedTab, PinnedItem, Settings, SpaceSnapshot, TabEntry } from '@/shared/types';
import {
  createPinnedFolder,
  createPinnedTab,
  exportSpaceBookmarks,
  getPinnedItemsForSpace,
  importSpaceBookmarks,
  movePinnedItem,
  removePinnedItem,
  updatePinnedItem,
} from './bookmarks';
import { openFloatingUiOnTab } from './ui-messaging';
import type { SpaceState } from './spaces';
import { deriveSpaceStateFromSnapshots, loadSpaceState, saveSpaceState } from './spaces';

const TAB_GROUP_ID_NONE = -1;
const TAB_GROUPS_SUPPORTED = typeof chrome.tabGroups !== 'undefined';

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
  const tabGroups = TAB_GROUPS_SUPPORTED ? await chrome.tabGroups.query({}) : [];
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

function initializeSpaceSnapshots(tabGroups: chrome.tabGroups.TabGroup[], timestamp: number) {
  const groupMap = new Map<number, SpaceSnapshot>();

  for (const group of tabGroups) {
    const snapshot = createEmptySpaceSnapshot({
      id: group.id,
      name: group.title ?? 'Untitled',
      color: (group.color ?? 'grey') as TabGroupColor,
      windowId: group.windowId ?? -1,
      timestamp,
    });
    groupMap.set(snapshot.id, snapshot);
  }

  const ungrouped = createEmptySpaceSnapshot({
    id: TAB_GROUP_ID_NONE,
    name: 'Ungrouped',
    color: 'grey' as TabGroupColor,
    windowId: -1,
    timestamp,
  });

  return { groupMap, ungrouped };
}

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

function buildSnapshotList(
  groupMap: Map<number, SpaceSnapshot>,
  ungrouped: SpaceSnapshot,
  globalPinned: GlobalPinnedMap
): SpaceSnapshot[] {
  const spaces = Array.from(groupMap.values());
  if (hasUngroupedContent(ungrouped)) {
    spaces.push(ungrouped);
  }

  spaces.sort((a, b) => a.id - b.id);

  mergeGlobalPinnedTabs(spaces, globalPinned);

  return spaces;
}

function indexTabsById(allTabs: chrome.tabs.Tab[]): Map<number, TabEntry> {
  const tabsById = new Map<number, TabEntry>();

  for (const tab of allTabs) {
    const entry = mapTab(tab);
    if (!entry) continue;
    tabsById.set(entry.id, entry);
  }

  return tabsById;
}

export async function getActiveTabEntry(): Promise<TabEntry | null> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab ? mapTab(activeTab) : null;
}

function buildSnapshotFromState(
  state: SpaceState,
  tabsById: Map<number, TabEntry>,
  timestamp: number
): SpaceSnapshot {
  const pinnedTabs: TabEntry[] = [];
  const tabs: TabEntry[] = [];
  const temporaryTabs: TabEntry[] = [];

  const pinnedIds = new Set<number>(state.spaceBookmarks ?? []);
  const temporaryIds = Array.isArray(state.temporaryTabs) ? state.temporaryTabs : [];

  for (const id of pinnedIds) {
    const entry = tabsById.get(id);
    if (!entry) continue;
    pinnedTabs.push({ ...entry, pinned: true, groupId: state.id });
  }

  for (const id of temporaryIds) {
    if (pinnedIds.has(id)) continue;
    const entry = tabsById.get(id);
    if (!entry) continue;

    const adjustedEntry: TabEntry = { ...entry, pinned: false, groupId: state.id };

    if (state.id === TAB_GROUP_ID_NONE) {
      temporaryTabs.push(adjustedEntry);
    } else {
      tabs.push(adjustedEntry);
    }
  }

  const sampleTab = pinnedTabs[0] ?? tabs[0] ?? temporaryTabs[0];
  const windowId = sampleTab?.windowId ?? -1;

  return {
    id: state.id,
    name: state.name,
    color: state.color,
    tabs,
    pinnedTabs,
    pinnedItems: [],
    temporaryTabs,
    windowId,
    created_at: timestamp,
    last_active_at: timestamp,
  };
}

function buildSnapshotsFromSpaceState(
  spaceStates: SpaceState[],
  allTabs: chrome.tabs.Tab[],
  timestamp: number
): SpaceSnapshot[] {
  const tabsById = indexTabsById(allTabs);

  const snapshots: SpaceSnapshot[] = [];

  for (const state of spaceStates) {
    snapshots.push(buildSnapshotFromState(state, tabsById, timestamp));
  }

  snapshots.sort((a, b) => a.id - b.id);

  return snapshots;
}

async function upsertSpaceStateEntry(entry: SpaceState): Promise<void> {
  try {
    const current = await loadSpaceState();
    const index = current.findIndex((space) => space.id === entry.id);

    if (index === -1) {
      await saveSpaceState([...current, entry]);
      return;
    }

    const next = current.slice();
    next[index] = { ...next[index], ...entry };
    await saveSpaceState(next);
  } catch (error) {
    console.warn('[Arcline] Failed to update SpaceState entry', error);
  }
}

async function removeSpaceFromState(spaceId: number): Promise<void> {
  try {
    const current = await loadSpaceState();
    const filtered = current.filter((space) => space.id !== spaceId);
    if (filtered.length === current.length) {
      return;
    }

    await saveSpaceState(filtered);
  } catch (error) {
    console.warn('[Arcline] Failed to remove space from SpaceState', error);
  }
}

async function updateTabMembershipInState(
  tabId: number,
  spaceId: number,
  pinned: boolean
): Promise<void> {
  try {
    const current = await loadSpaceState();

    const withTabRemoved = current.map((space) => ({
      ...space,
      spaceBookmarks: (space.spaceBookmarks ?? []).filter((id) => id !== tabId),
      temporaryTabs: (space.temporaryTabs ?? []).filter((id) => id !== tabId),
    }));

    const existingIndex = withTabRemoved.findIndex((space) => space.id === spaceId);

    if (existingIndex === -1) {
      const newSpace: SpaceState = {
        id: spaceId,
        name: spaceId === TAB_GROUP_ID_NONE ? 'Ungrouped' : 'Untitled',
        color: 'grey' as TabGroupColor,
        spaceBookmarks: pinned ? [tabId] : [],
        temporaryTabs: pinned ? [] : [tabId],
      };

      await saveSpaceState([...withTabRemoved, newSpace]);
      return;
    }

    const target = withTabRemoved[existingIndex];
    if (!target) {
      await saveSpaceState(withTabRemoved);
      return;
    }

    const updated: SpaceState = {
      ...target,
      spaceBookmarks: pinned ? [...target.spaceBookmarks, tabId] : target.spaceBookmarks,
      temporaryTabs: pinned ? target.temporaryTabs : [...target.temporaryTabs, tabId],
    };

    const next = withTabRemoved.slice();
    next[existingIndex] = updated;

    await saveSpaceState(next);
  } catch (error) {
    console.warn('[Arcline] Failed to update tab membership in SpaceState', error);
  }
}

export async function getSpacesSnapshot(): Promise<SpaceSnapshot[]> {
  try {
    if (cachedSnapshot) {
      return cachedSnapshot;
    }

    const { tabGroups, allTabs } = await queryChromeState();
    const timestamp = Date.now();
    const { groupMap, ungrouped } = initializeSpaceSnapshots(tabGroups, timestamp);
    const globalPinned: GlobalPinnedMap = new Map();

    distributeTabs(allTabs, groupMap, ungrouped, globalPinned);

    const snapshots = buildSnapshotList(groupMap, ungrouped, globalPinned);

    // Populate pinnedItems from bookmarks for each space
    for (const snapshot of snapshots) {
      if (snapshot.id !== TAB_GROUP_ID_NONE) {
        // Only for actual spaces (groups)
        snapshot.pinnedItems = await getPinnedItemsForSpace(snapshot.name);
        linkPinnedItemsToOpenTabs(snapshot.pinnedItems, [
          ...snapshot.temporaryTabs,
          ...snapshot.tabs,
        ]);
      } else {
        snapshot.pinnedItems = [];
      }
    }

    // Persist SpaceState derived from the current snapshot so that
    // other background operations can treat it as the single source of truth.
    const state = deriveSpaceStateFromSnapshots(snapshots);
    await saveSpaceState(state);

    await saveSpaceState(state);

    cachedSnapshot = snapshots;
    return snapshots;
  } catch (error) {
    console.warn('Failed to load spaces snapshot', error);
    try {
      const state = await loadSpaceState();
      if (!state.length) {
        return [];
      }

      const allTabs = await chrome.tabs.query({});
      if (!Array.isArray(allTabs) || allTabs.length === 0) {
        return [];
      }

      const timestamp = Date.now();
      return buildSnapshotsFromSpaceState(state, allTabs, timestamp);
    } catch (fallbackError) {
      console.warn(
        '[Arcline] Failed to build spaces snapshot from stored SpaceState',
        fallbackError
      );
      return [];
    }
  }
}

export async function toggleTabPinned(tabId: number, nextPinned?: boolean): Promise<boolean> {
  const tab = await chrome.tabs.get(tabId);
  const pinned = nextPinned ?? !tab.pinned;
  await chrome.tabs.update(tabId, { pinned });

  const spaceId = typeof tab.groupId === 'number' ? tab.groupId : TAB_GROUP_ID_NONE;
  await updateTabMembershipInState(tabId, spaceId, pinned);

  await broadcastSpacesSnapshot();

  return pinned;
}

export async function moveTabToSpace(tabId: number, spaceId: number): Promise<number | null> {
  let result: number | null = null;

  if (!TAB_GROUPS_SUPPORTED) {
    await chrome.tabs.ungroup(tabId);
  } else if (spaceId === TAB_GROUP_ID_NONE) {
    await chrome.tabs.ungroup(tabId);
  } else {
    result = await chrome.tabs.group({ groupId: spaceId, tabIds: [tabId] });
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    const pinned = Boolean(tab.pinned);
    await updateTabMembershipInState(tabId, spaceId, pinned);
  } catch (error) {
    console.warn('[Arcline] Failed to update SpaceState for moved tab', error);
  }

  await broadcastSpacesSnapshot();
  return result;
}

export async function createSpace(name: string, color?: TabGroupColor): Promise<number> {
  if (!TAB_GROUPS_SUPPORTED) {
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
    color: color ?? 'blue',
  });

  await upsertSpaceStateEntry({
    id: groupId,
    name,
    color: (color ?? 'blue') as TabGroupColor,
    spaceBookmarks: [],
    temporaryTabs: [],
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
  if (!TAB_GROUPS_SUPPORTED) return;

  await removeSpaceFromState(spaceId);

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

export async function activateTab(tabId: number): Promise<void> {
  // Atlasブラウザデバッグ用ログ
  const isAtlas = /\bAtlas\b/i.test(navigator.userAgent);
  const browserInfo = {
    userAgent: navigator.userAgent,
    isAtlas,
    tabId,
    timestamp: new Date().toISOString(),
  };

  console.log('[Arcline] 🚀 activateTab called with:', browserInfo);

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
      await openFloatingUiOnTab(tabId, spaces);
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

// Reorder tabs within a space (updates SpaceState only)
export async function reorderTab(
  tabId: number,
  spaceId: number,
  newIndex: number,
  listType: 'pinned' | 'temporary'
): Promise<void> {
  const current = await loadSpaceState();
  const spaceIndex = current.findIndex((s) => s.id === spaceId);
  if (spaceIndex === -1) return;

  const space = current[spaceIndex];
  if (!space) return;

  // spaceBookmarks maps to Pinned tabs in UI
  const listKey = listType === 'pinned' ? 'spaceBookmarks' : 'temporaryTabs';
  const list = [...(space[listKey] || [])];

  const currentIndex = list.indexOf(tabId);
  if (currentIndex === -1) return;

  list.splice(currentIndex, 1);
  list.splice(newIndex, 0, tabId);

  const updatedSpace = { ...space, [listKey]: list };
  const next = [...current];
  next[spaceIndex] = updatedSpace;

  await saveSpaceState(next);
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
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
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
  chrome.tabGroups.onCreated.addListener(invalidateSnapshot);
  chrome.tabGroups.onUpdated.addListener(invalidateSnapshot);
  chrome.tabGroups.onRemoved.addListener(invalidateSnapshot);
  chrome.tabGroups.onMoved.addListener(invalidateSnapshot);
}
