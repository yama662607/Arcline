// Shared types used across the extension

export interface TabEntry {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
  pinned: boolean;
  active: boolean;
  windowId: number;
  groupId: number;
  lastAccessed?: number;
}

export interface SpaceSnapshot {
  id: number;
  name: string;
  color: chrome.tabGroups.ColorEnum;
  tabs: TabEntry[];
  pinnedTabs: TabEntry[];
  temporaryTabs: TabEntry[];
  windowId: number;
  createdAt: number;
  lastActiveAt: number;
}

export interface ArchivedTab {
  id: string;
  url: string;
  title: string;
  favIconUrl?: string;
  spaceId: number;
  spaceName: string;
  archivedAt: number;
  originalTabId?: number;
}

export interface Settings {
  defaultSpaceName: string;
  autoArchiveEnabled: boolean;
  autoArchiveIdleMinutes: number;
  uiMode: 'side-panel' | 'popup' | 'floating';
  showFavicons: boolean;
  compactMode: boolean;
  enableAnimations: boolean;
  theme: 'dark' | 'light' | 'auto';
}

export interface BookmarkFolder {
  id: string;
  title: string;
  parentId?: string;
  dateAdded: number;
}

export interface TabActivity {
  [tabId: number]: number; // tabId -> lastActivity timestamp
}

export interface SpaceCreateRequest {
  name: string;
  color?: chrome.tabGroups.ColorEnum;
}

export interface SpaceUpdateRequest {
  id: number;
  name?: string;
  color?: chrome.tabGroups.ColorEnum;
}

export interface TabMoveRequest {
  tabId: number;
  spaceId: number;
  index?: number;
}

// Chrome extension message types
export interface ExtensionMessage {
  command: string;
  [key: string]: unknown;
}

export interface SpacesSnapshotMessage extends ExtensionMessage {
  command: 'spacesSnapshot';
  spaces: SpaceSnapshot[];
}

export interface UiModeMessage extends ExtensionMessage {
  command: 'currentUiMode';
  mode: 'side-panel' | 'popup' | 'floating';
}

export interface TogglePinMessage extends ExtensionMessage {
  command: 'toggleTabPinned';
  tabId: number;
  pinned?: boolean;
  ok: boolean;
  error?: string;
}

// Context menu types
export interface ContextMenuItem {
  id: string;
  title: string;
  contexts: chrome.contextMenus.ContextType[];
  visible?: boolean;
  enabled?: boolean;
}

// Performance monitoring types
export interface BundleMetrics {
  totalSize: number;
  gzippedSize: number;
  chunkSizes: Record<string, number>;
}

export interface PerformanceMetrics {
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  memoryUsage: number;
}
