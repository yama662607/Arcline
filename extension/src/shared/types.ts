// Shared types used across the extension

import type { TabGroupColor } from './chrome-types';

export interface TabEntry {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
  pinned: boolean;
  active: boolean;
  windowId: number;
  groupId: number;
  last_accessed?: number;
}

export type PinnedItem = PinnedTab | PinnedFolder;

export interface PinnedTab {
  type: 'tab';
  id: string; // URL or specialized ID
  url: string;
  title: string;
  favIconUrl?: string;
  // Optional: Link to an open tab ID if currently active
  tabId?: number;
  parentId?: string;
}

export interface PinnedFolder {
  type: 'folder';
  id: string; // UUID or Bookmark ID
  title: string;
  children: PinnedItem[];
  collapsed?: boolean; // UI state
  parentId?: string;
}

export type SpaceColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan';

export interface SpaceSnapshot {
  id: number;
  name: string;
  color: TabGroupColor;
  themeColor?: SpaceColor;
  icon?: string; // Emoji or icon identifier
  tabs: TabEntry[];
  pinnedTabs: TabEntry[]; // Deprecated: Use pinnedItems
  pinnedItems: PinnedItem[];
  temporaryTabs: TabEntry[];
  windowId: number;
  created_at?: number;
  last_active_at?: number;
  isFavorite?: boolean; // For bottom space bar display
  order?: number; // Display order in space list
}

export interface SearchResult {
  id: string;
  title: string;
  url?: string;
  type: 'tab' | 'bookmark' | 'history' | 'space' | 'command';
  favIconUrl?: string;
  lastVisitTime?: number;
  description?: string;
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
  enableNewTabOverride: boolean;
  uiMode: 'side-panel' | 'popup' | 'floating';
  showFavicons: boolean;
  compactMode: boolean;
  enableAnimations: boolean;
  theme: 'dark' | 'light' | 'auto';
  // Gesture config
  gesturesEnabled: boolean;
  gestureSensitivity: number; // Threshold (e.g. 100)
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
  color?: TabGroupColor;
  themeColor?: SpaceColor;
  icon?: string;
}

export interface SpaceUpdateRequest {
  id: number;
  name?: string;
  color?: TabGroupColor;
  themeColor?: SpaceColor;
  icon?: string;
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

export interface ActiveSpaceChangedMessage extends ExtensionMessage {
  command: 'activeSpaceChanged';
  spaceId: number;
}

export interface PreloadFloatingUiMessage extends ExtensionMessage {
  command: 'preloadFloatingUi';
}

export type SpaceTransitionMode = 'handoff' | 'flick';

export interface SpaceTransitionHandoff {
  mode: 'handoff';
  direction: 'left' | 'right';
  progress: number; // 0..1
  timestamp: number;
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
