import { SPACE_META_ID_PREFIX } from '../core/colors';
import { completeSettings } from '../core/settings';
import type { ArchivedTab, Settings, SpaceMeta, TabBinding } from '../core/types';

export const SPACE_META_SYNC_PREFIX = 'arcline:sm:';

export const ROOT_TITLE = 'Arcline';
export const FAVORITES_TITLE = 'Favorites';
export const DEFAULT_SPACE_NAME = 'Main';

export interface RootIds {
  rootId: string;
  favoritesId: string;
}

export const STORAGE_KEYS = {
  root: 'arcline:root',
  spaceMeta: 'arcline:spaceMeta',
  openFolders: 'arcline:openFolders',
  lastPages: 'arcline:lastPages',
  settings: 'arcline:settings',
  archivedTabs: 'arcline:archivedTabs',
  bindings: 'arcline:bindings',
  groupSpaces: 'arcline:groupSpaces',
  activeSpaces: 'arcline:activeSpaces',
  lastActiveTabs: 'arcline:lastActiveTabs',
  parkedTabs: 'arcline:parkedTabs',
  tabActivity: 'arcline:tabActivity',
} as const;

export const SNAPSHOT_STORAGE_KEYS = new Set<string>([
  STORAGE_KEYS.root,
  STORAGE_KEYS.spaceMeta,
  STORAGE_KEYS.openFolders,
  STORAGE_KEYS.bindings,
  STORAGE_KEYS.groupSpaces,
  STORAGE_KEYS.activeSpaces,
  STORAGE_KEYS.lastActiveTabs,
]);

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const res = await chrome.storage.local.get(key);
  return (res[key] as T | undefined) ?? fallback;
}

async function setLocal<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

async function getSession<T>(key: string, fallback: T): Promise<T> {
  const res = await chrome.storage.session.get(key);
  return (res[key] as T | undefined) ?? fallback;
}

async function setSession<T>(key: string, value: T): Promise<void> {
  await chrome.storage.session.set({ [key]: value });
}

async function getAllSyncSpaceMeta(): Promise<Record<string, SpaceMeta>> {
  if (!chrome.storage?.sync?.get) return {};
  try {
    const all = await chrome.storage.sync.get(null);
    const merged: Record<string, SpaceMeta> = {};
    // Legacy single-key fallback if present on older installs
    const legacy = all[STORAGE_KEYS.spaceMeta];
    if (legacy && typeof legacy === 'object') {
      Object.assign(merged, legacy as Record<string, SpaceMeta>);
    }
    // Per-Space keys (avoids 8KB QUOTA_BYTES_PER_ITEM limit)
    for (const [key, val] of Object.entries(all)) {
      if (key.startsWith(SPACE_META_SYNC_PREFIX) && val && typeof val === 'object') {
        const spaceName = key.slice(SPACE_META_SYNC_PREFIX.length);
        if (spaceName) merged[spaceName] = val as SpaceMeta;
      }
    }
    return merged;
  } catch (err) {
    console.warn('[Arcline] chrome.storage.sync read failed', err);
    return {};
  }
}

async function writeSyncSpaceMeta(meta: Record<string, SpaceMeta>): Promise<void> {
  if (!chrome.storage?.sync?.set) return;
  try {
    const existing = await chrome.storage.sync.get(null);
    const toSet: Record<string, SpaceMeta> = {};
    const keepKeys = new Set<string>();
    for (const [k, v] of Object.entries(meta)) {
      // Never sync device-local bookmark folder IDs (`id:...`); sync portable Space name keys only
      if (k.startsWith(SPACE_META_ID_PREFIX) || !v) continue;
      const syncKey = `${SPACE_META_SYNC_PREFIX}${k}`;
      keepKeys.add(syncKey);
      toSet[syncKey] = v;
    }
    const toRemove: string[] = [];
    for (const key of Object.keys(existing)) {
      if (key === STORAGE_KEYS.spaceMeta) {
        toRemove.push(key);
      } else if (key.startsWith(SPACE_META_SYNC_PREFIX) && !keepKeys.has(key)) {
        toRemove.push(key);
      }
    }
    if (Object.keys(toSet).length > 0) {
      await chrome.storage.sync.set(toSet);
    }
    if (toRemove.length > 0 && chrome.storage.sync.remove) {
      await chrome.storage.sync.remove(toRemove);
    }
  } catch (err) {
    console.warn('[Arcline] chrome.storage.sync write failed (local meta preserved)', err);
  }
}

export const storage = {
  getRootIds: () => getLocal<RootIds | undefined>(STORAGE_KEYS.root, undefined),
  setRootIds: (ids: RootIds) => setLocal(STORAGE_KEYS.root, ids),

  getSpaceMeta: async (): Promise<Record<string, SpaceMeta>> => {
    const [localMeta, syncMeta] = await Promise.all([
      getLocal<Record<string, SpaceMeta>>(STORAGE_KEYS.spaceMeta, {}),
      getAllSyncSpaceMeta(),
    ]);
    // Synced portable Space name keys override stale local name keys, while device-local `id:` overrides stay intact
    const merged: Record<string, SpaceMeta> = { ...localMeta, ...syncMeta };
    for (const [k, v] of Object.entries(localMeta)) {
      if (k.startsWith(SPACE_META_ID_PREFIX)) merged[k] = v;
    }
    return merged;
  },
  setSpaceMeta: async (meta: Record<string, SpaceMeta>): Promise<void> => {
    await Promise.all([setLocal(STORAGE_KEYS.spaceMeta, meta), writeSyncSpaceMeta(meta)]);
  },
  migrateSpaceMetaToSync: async (): Promise<void> => {
    if (!chrome.storage?.sync?.get || !chrome.storage?.sync?.set) return;
    const [localMeta, syncMeta] = await Promise.all([
      getLocal<Record<string, SpaceMeta>>(STORAGE_KEYS.spaceMeta, {}),
      getAllSyncSpaceMeta(),
    ]);
    const toBackfill: Record<string, SpaceMeta> = {};
    for (const [k, v] of Object.entries(localMeta)) {
      if (k.startsWith(SPACE_META_ID_PREFIX) || !v) continue;
      if (!(k in syncMeta)) {
        toBackfill[`${SPACE_META_SYNC_PREFIX}${k}`] = v;
      }
    }
    if (Object.keys(toBackfill).length > 0) {
      try {
        await chrome.storage.sync.set(toBackfill);
      } catch (err) {
        console.warn('[Arcline] chrome.storage.sync backfill failed', err);
      }
    }
  },

  getOpenFolders: () => getLocal<string[]>(STORAGE_KEYS.openFolders, []),
  setOpenFolders: (ids: string[]) => setLocal(STORAGE_KEYS.openFolders, ids),

  getLastPages: () => getLocal<Record<string, string>>(STORAGE_KEYS.lastPages, {}),
  setLastPages: (pages: Record<string, string>) => setLocal(STORAGE_KEYS.lastPages, pages),

  getSettings: async (): Promise<Settings> =>
    completeSettings(
      await getLocal<Partial<Settings> | undefined>(STORAGE_KEYS.settings, undefined),
    ),
  setSettings: (settings: Settings) => setLocal(STORAGE_KEYS.settings, settings),

  getArchivedTabs: () => getLocal<ArchivedTab[]>(STORAGE_KEYS.archivedTabs, []),
  setArchivedTabs: (tabs: ArchivedTab[]) => setLocal(STORAGE_KEYS.archivedTabs, tabs),

  getBindings: () => getSession<Record<number, TabBinding>>(STORAGE_KEYS.bindings, {}),
  setBindings: (bindings: Record<number, TabBinding>) =>
    setSession(STORAGE_KEYS.bindings, bindings),

  getGroupSpaces: () => getSession<Record<number, string>>(STORAGE_KEYS.groupSpaces, {}),
  setGroupSpaces: (map: Record<number, string>) => setSession(STORAGE_KEYS.groupSpaces, map),

  getActiveSpaces: () => getSession<Record<number, string>>(STORAGE_KEYS.activeSpaces, {}),
  setActiveSpaces: (map: Record<number, string>) => setSession(STORAGE_KEYS.activeSpaces, map),

  getLastActiveTabs: () => getSession<Record<string, number>>(STORAGE_KEYS.lastActiveTabs, {}),
  setLastActiveTabs: (map: Record<string, number>) => setSession(STORAGE_KEYS.lastActiveTabs, map),

  getParkedTabs: () => getSession<Record<number, number>>(STORAGE_KEYS.parkedTabs, {}),
  setParkedTabs: (map: Record<number, number>) => setSession(STORAGE_KEYS.parkedTabs, map),

  getTabActivity: () => getSession<Record<number, number>>(STORAGE_KEYS.tabActivity, {}),
  setTabActivity: (map: Record<number, number>) => setSession(STORAGE_KEYS.tabActivity, map),
};

export async function rememberFolderOpen(folderId: string): Promise<void> {
  const open = await storage.getOpenFolders();
  if (!open.includes(folderId)) {
    await storage.setOpenFolders([...open, folderId]);
  }
}

export async function setLastPage(bookmarkId: string, url: string): Promise<void> {
  const pages = await storage.getLastPages();
  if (pages[bookmarkId] === url) return;
  await storage.setLastPages({ ...pages, [bookmarkId]: url });
}

export async function pruneLastPages(liveIds: Set<string>): Promise<void> {
  const pages = await storage.getLastPages();
  const next: Record<string, string> = {};
  let changed = false;
  for (const [id, url] of Object.entries(pages)) {
    if (liveIds.has(id)) next[id] = url;
    else changed = true;
  }
  if (changed) await storage.setLastPages(next);
}

export async function setBinding(
  tabId: number,
  binding: TabBinding | undefined,
): Promise<Record<number, TabBinding>> {
  const current = { ...(await storage.getBindings()) };
  if (binding) current[tabId] = binding;
  else delete current[tabId];
  await storage.setBindings(current);
  return current;
}

export async function setGroupSpace(
  groupId: number,
  spaceId: string | undefined,
): Promise<Record<number, string>> {
  const current = { ...(await storage.getGroupSpaces()) };
  if (spaceId) current[groupId] = spaceId;
  else delete current[groupId];
  await storage.setGroupSpaces(current);
  return current;
}

export async function setActiveSpace(windowId: number, spaceId: string): Promise<void> {
  const current = await storage.getActiveSpaces();
  if (current[windowId] === spaceId) return;
  await storage.setActiveSpaces({ ...current, [windowId]: spaceId });
}

export async function rememberActiveTab(
  windowId: number,
  spaceId: string,
  tabId: number,
): Promise<void> {
  const current = await storage.getLastActiveTabs();
  const key = `${windowId}:${spaceId}`;
  if (current[key] === tabId) return;
  await storage.setLastActiveTabs({ ...current, [key]: tabId });
}

export async function getLastActiveTab(
  windowId: number,
  spaceId: string,
): Promise<number | undefined> {
  const current = await storage.getLastActiveTabs();
  return current[`${windowId}:${spaceId}`];
}

export async function getParkedTab(windowId: number): Promise<number | undefined> {
  const parked = await storage.getParkedTabs();
  return parked[windowId];
}

export async function parkTab(windowId: number, tabId: number): Promise<void> {
  const parked = await storage.getParkedTabs();
  await storage.setParkedTabs({ ...parked, [windowId]: tabId });
}

export async function unparkTab(windowId: number): Promise<number | undefined> {
  const parked = { ...(await storage.getParkedTabs()) };
  const prev = parked[windowId];
  if (prev === undefined) return undefined;
  delete parked[windowId];
  await storage.setParkedTabs(parked);
  return prev;
}

export async function stampTabActivity(tabIds: number[], nowMs = Date.now()): Promise<void> {
  if (tabIds.length === 0) return;
  const current = { ...(await storage.getTabActivity()) };
  for (const id of tabIds) current[id] = nowMs;
  await storage.setTabActivity(current);
}

export async function dropTabActivity(tabId: number): Promise<void> {
  const current = { ...(await storage.getTabActivity()) };
  if (!(tabId in current)) return;
  delete current[tabId];
  await storage.setTabActivity(current);
}
