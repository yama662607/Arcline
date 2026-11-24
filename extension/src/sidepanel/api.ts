import { loadRoot } from '../background/root';
import { SNAPSHOT_STORAGE_KEYS, STORAGE_KEYS, storage } from '../background/storage';
import { deriveState } from '../core/derive';
import type {
  ArchivedTab,
  Command,
  LiveTab,
  Settings,
  SidebarState,
  Snapshot,
  TabGroupInfo,
  TabInfo,
} from '../core/types';

export async function sendCommand<T = unknown>(command: Command): Promise<T> {
  const response = (await chrome.runtime.sendMessage({ arclineCommand: command })) as
    | { ok: true; result: T }
    | { ok: false; error: string }
    | undefined;
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Arcline command failed');
  }
  return response.result;
}

export async function getCurrentWindowId(): Promise<number> {
  const param = new URLSearchParams(window.location.search).get('windowId');
  if (param) {
    const parsed = Number.parseInt(param, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  const tab = await chrome.tabs.getCurrent().catch(() => undefined);
  if (tab?.windowId !== undefined) return tab.windowId;
  const win = await chrome.windows.getCurrent();
  if (win.id === undefined) throw new Error('Current window has no id');
  return win.id;
}

export async function loadSidebarState(windowId: number): Promise<SidebarState> {
  const [
    { ids, root },
    tabs,
    groups,
    bindings,
    groupSpaces,
    activeSpaces,
    spaceMeta,
    openFolders,
    lastActiveTabs,
  ] = await Promise.all([
    loadRoot(),
    chrome.tabs.query({ windowId }),
    chrome.tabGroups.query({ windowId }),
    storage.getBindings(),
    storage.getGroupSpaces(),
    storage.getActiveSpaces(),
    storage.getSpaceMeta(),
    storage.getOpenFolders(),
    storage.getLastActiveTabs(),
  ]);

  const snapshot: Snapshot = {
    windowId,
    rootId: ids.rootId,
    favoritesId: ids.favoritesId,
    root,
    tabs: tabs as TabInfo[],
    groups: groups as TabGroupInfo[],
    bindings,
    groupSpaces,
    activeSpaces,
    spaceMeta,
    openFolders,
    lastActiveTabs,
  };
  return deriveState(snapshot);
}

export async function loadSettings(): Promise<Settings> {
  return storage.getSettings();
}

export async function saveSettings(next: Settings): Promise<void> {
  await storage.setSettings(next);
}

export async function loadArchivedTabs(): Promise<ArchivedTab[]> {
  return storage.getArchivedTabs();
}

export async function toggleFolderOpen(folderId: string): Promise<string[]> {
  const current = await storage.getOpenFolders();
  const next = current.includes(folderId)
    ? current.filter((id) => id !== folderId)
    : [...current, folderId];
  await storage.setOpenFolders(next);
  return next;
}

export interface WindowSubscriptionCallbacks {
  onReload: () => void;
  onTabPatch: (tabId: number, patch: Partial<Omit<LiveTab, 'id'>>) => void;
  onSettingsChange: () => void;
  onArchiveChange: () => void;
}

/**
 * Granular event subscription:
 * - Tab metadata edits (title, icon, loading, audio, mute, URL) patch O(1) without hitting bookmarks/storage.
 * - Structural changes coalesce into a single debounced snapshot reload.
 */
export function subscribeToWindowUpdates(
  windowId: number,
  callbacks: WindowSubscriptionCallbacks,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const triggerReload = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      callbacks.onReload();
    }, 35);
  };

  const onTabCreated = (tab: chrome.tabs.Tab) => {
    if (tab.windowId === windowId) triggerReload();
  };
  const onTabUpdated = (
    tabId: number,
    changeInfo: chrome.tabs.OnUpdatedInfo,
    tab: chrome.tabs.Tab,
  ) => {
    if (tab.windowId !== windowId) return;
    if (changeInfo.pinned !== undefined || changeInfo.groupId !== undefined) {
      triggerReload();
      return;
    }
    const patch: Partial<Omit<LiveTab, 'id'>> = {};
    let hasPatch = false;
    if (changeInfo.title !== undefined) {
      patch.title = changeInfo.title;
      hasPatch = true;
    }
    if (changeInfo.url !== undefined) {
      patch.url = changeInfo.url;
      hasPatch = true;
    }
    if (changeInfo.favIconUrl !== undefined) {
      patch.favIconUrl = changeInfo.favIconUrl || undefined;
      hasPatch = true;
    }
    if (changeInfo.status !== undefined) {
      patch.status = changeInfo.status === 'loading' ? 'loading' : 'complete';
      hasPatch = true;
    }
    if (changeInfo.audible !== undefined) {
      patch.audible = changeInfo.audible;
      hasPatch = true;
    }
    if (changeInfo.mutedInfo !== undefined) {
      patch.muted = Boolean(changeInfo.mutedInfo.muted);
      hasPatch = true;
    }
    if (hasPatch) {
      callbacks.onTabPatch(tabId, patch);
    }
  };
  const onTabRemoved = (_id: number, info: chrome.tabs.OnRemovedInfo) => {
    if (info.windowId === windowId) triggerReload();
  };
  const onTabMoved = (_id: number, info: chrome.tabs.OnMovedInfo) => {
    if (info.windowId === windowId) triggerReload();
  };
  const onTabActivated = (info: chrome.tabs.OnActivatedInfo) => {
    if (info.windowId === windowId) triggerReload();
  };
  const onTabAttached = (_id: number, info: chrome.tabs.OnAttachedInfo) => {
    if (info.newWindowId === windowId) triggerReload();
  };
  const onTabDetached = (_id: number, info: chrome.tabs.OnDetachedInfo) => {
    if (info.oldWindowId === windowId) triggerReload();
  };
  const onGroupChange = (group: chrome.tabGroups.TabGroup) => {
    if (group.windowId === windowId) triggerReload();
  };
  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
    const keys = Object.keys(changes);
    if (keys.includes(STORAGE_KEYS.settings)) callbacks.onSettingsChange();
    if (keys.includes(STORAGE_KEYS.archivedTabs)) callbacks.onArchiveChange();
    if (keys.some((k) => SNAPSHOT_STORAGE_KEYS.has(k))) triggerReload();
  };
  const onBookmarkChange = () => triggerReload();

  chrome.tabs.onCreated.addListener(onTabCreated);
  chrome.tabs.onUpdated.addListener(onTabUpdated);
  chrome.tabs.onRemoved.addListener(onTabRemoved);
  chrome.tabs.onMoved.addListener(onTabMoved);
  chrome.tabs.onActivated.addListener(onTabActivated);
  chrome.tabs.onAttached.addListener(onTabAttached);
  chrome.tabs.onDetached.addListener(onTabDetached);
  chrome.tabGroups.onCreated.addListener(onGroupChange);
  chrome.tabGroups.onUpdated.addListener(onGroupChange);
  chrome.tabGroups.onRemoved.addListener(onGroupChange);
  chrome.bookmarks.onCreated.addListener(onBookmarkChange);
  chrome.bookmarks.onRemoved.addListener(onBookmarkChange);
  chrome.bookmarks.onChanged.addListener(onBookmarkChange);
  chrome.bookmarks.onMoved.addListener(onBookmarkChange);
  chrome.storage.onChanged.addListener(onStorageChanged);

  return () => {
    if (timer) clearTimeout(timer);
    chrome.tabs.onCreated.removeListener(onTabCreated);
    chrome.tabs.onUpdated.removeListener(onTabUpdated);
    chrome.tabs.onRemoved.removeListener(onTabRemoved);
    chrome.tabs.onMoved.removeListener(onTabMoved);
    chrome.tabs.onActivated.removeListener(onTabActivated);
    chrome.tabs.onAttached.removeListener(onTabAttached);
    chrome.tabs.onDetached.removeListener(onTabDetached);
    chrome.tabGroups.onCreated.removeListener(onGroupChange);
    chrome.tabGroups.onUpdated.removeListener(onGroupChange);
    chrome.tabGroups.onRemoved.removeListener(onGroupChange);
    chrome.bookmarks.onCreated.removeListener(onBookmarkChange);
    chrome.bookmarks.onRemoved.removeListener(onBookmarkChange);
    chrome.bookmarks.onChanged.removeListener(onBookmarkChange);
    chrome.bookmarks.onMoved.removeListener(onBookmarkChange);
    chrome.storage.onChanged.removeListener(onStorageChanged);
  };
}
