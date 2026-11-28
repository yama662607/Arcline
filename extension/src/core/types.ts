export type TabGroupColor =
  | 'grey'
  | 'blue'
  | 'red'
  | 'yellow'
  | 'green'
  | 'pink'
  | 'purple'
  | 'cyan'
  | 'orange';

export type ThemeMode = 'system' | 'light' | 'dark';
export type AutoArchiveHours = 0 | 12 | 24 | 168;
export type Language = 'en' | 'ja';
export type LanguagePreference = 'auto' | Language;
export type SearchEngine = 'google' | 'duckduckgo' | 'brave';
export type CommandBarOpenMode = 'popup' | 'newtab';
export type CustomCommandAction =
  | 'openCommandBar'
  | 'toggleSidebar'
  | 'nextSpace'
  | 'previousSpace'
  | 'togglePin';

export interface CustomSiteSearch {
  id: string;
  /** Short trigger keyword (lowercase alphanumeric / dash / underscore, e.g. "docs"). */
  prefix: string;
  label: string;
  /** Safe http(s) URL template containing `%s`. */
  urlTemplate: string;
  accent?: string;
}

export interface FavoriteShortcut {
  /** Short alias matched in Command Bar & Raycast (e.g. "mail", "gh"). */
  alias?: string;
  /** Single key (1-9 or a-z) triggered via Alt+<key> in Command Bar / Cmd+Shift+<key> in Raycast. */
  shortcut?: string;
}

export interface Settings {
  theme: ThemeMode;
  showTopBar: boolean;
  showOpenInCollapsedFolders: boolean;
  autoArchiveHours: AutoArchiveHours;
  edgeHoverEnabled: boolean;
  edgeTriggerWidthPx: number;
  edgeOpenDelayMs: number;
  edgeCloseDelayMs: number;
  overlayWidthPx: number;
  swipeToSwitchSpace: boolean;
  openEmptySpacePage: boolean;
  /** UI language: 'auto' follows navigator.language ('ja*' → ja, otherwise en). */
  language: LanguagePreference;
  /** Fallback web search provider used by the Command Bar / New Tab page. */
  searchEngine: SearchEngine;
  /** How New Tab / Command Bar opens: 'popup' over current webpage or 'newtab' on empty page. */
  commandBarOpenMode: CommandBarOpenMode;
  /** User-defined site-search shortcuts synced to Command Bar & Raycast. */
  customSiteSearches: CustomSiteSearch[];
  /** Built-in or custom site-search IDs toggled off by the user. */
  disabledSiteSearchIds: string[];
  /** Per-Favorite alias & shortcut map keyed by Favorite URL. */
  favoriteShortcuts: Record<string, FavoriteShortcut>;
  /** Intercept Ctrl+Tab on webpages to show an Arc-style MRU switcher (off by default). */
  ctrlTabSwitcher: boolean;
  /** Custom in-page keyboard shortcuts editable directly in Arcline Settings. */
  customShortcuts: Partial<Record<CustomCommandAction, string>>;
}

export interface ArchivedTab {
  id: string;
  url: string;
  title: string;
  spaceName: string;
  archivedAt: number;
}

export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  parentId?: string;
  index?: number;
  children?: BookmarkNode[];
}

export interface TabInfo {
  id?: number;
  windowId?: number;
  index?: number;
  title?: string;
  url?: string;
  pendingUrl?: string;
  favIconUrl?: string;
  active?: boolean;
  pinned?: boolean;
  groupId: number;
  status?: string;
  audible?: boolean;
  mutedInfo?: { muted?: boolean };
}

export interface TabGroupInfo {
  id: number;
  windowId: number;
  title?: string;
  color: TabGroupColor;
  collapsed: boolean;
}

export interface TabBinding {
  kind: 'favorite' | 'pin';
  id: string;
}

export type SpaceAppearance = 'auto' | 'light' | 'dark';
export type SpaceHarmonyMode = 'free' | 'analogous' | 'complementary' | 'triadic';

export interface ThemeColorNode {
  x: number;
  y: number;
  hex: string;
}

export interface SpaceTheme {
  appearance: SpaceAppearance;
  nodes: ThemeColorNode[];
  harmony: SpaceHarmonyMode;
  /** 0..100 — vibrancy/saturation against matte surface */
  intensity: number;
  /** 0..100 — analog film noise texture */
  grain: number;
  /** 0..360 — base gradient sweep angle */
  angle: number;
}

export interface SpaceMeta {
  hue: number;
  icon?: string;
  theme?: SpaceTheme;
}

export interface LiveTab {
  id: number;
  title: string;
  url: string;
  status: 'loading' | 'complete';
  favIconUrl?: string;
  audible: boolean;
  muted: boolean;
}

export interface Favorite {
  id: string;
  title: string;
  url: string;
  tabId?: number;
}

export interface PinnedTab {
  kind: 'pin';
  id: string;
  title: string;
  url: string;
  tabId?: number;
}

export interface PinnedFolder {
  kind: 'folder';
  id: string;
  title: string;
  children: PinnedNode[];
}

export type PinnedNode = PinnedTab | PinnedFolder;

export interface Space {
  id: string;
  name: string;
  hue: number;
  icon?: string;
  theme?: SpaceTheme;
  pinned: PinnedNode[];
  tabIds: number[];
  lastActiveTabId?: number;
}

export interface SidebarState {
  rootId: string;
  favoritesId: string;
  spaces: Space[];
  favorites: Favorite[];
  tabs: Map<number, LiveTab>;
  activeSpaceId: string;
  activeTabId?: number;
  openFolders: Set<string>;
}

export interface Snapshot {
  windowId: number;
  rootId: string;
  favoritesId: string;
  root: BookmarkNode;
  tabs: TabInfo[];
  groups: TabGroupInfo[];
  bindings: Record<number, TabBinding>;
  groupSpaces: Record<number, string>;
  activeSpaces: Record<number, string>;
  spaceMeta: Record<string, SpaceMeta>;
  openFolders: string[];
  lastActiveTabs?: Record<string, number>;
}

export interface ImportedLink {
  title: string;
  url: string;
}

export type ImportedNode =
  | { kind: 'pin'; title: string; url: string }
  | { kind: 'folder'; title: string; children: ImportedNode[] };

export interface ImportedSpace {
  name: string;
  hue?: number;
  icon?: string;
  theme?: SpaceTheme;
  pinned: ImportedNode[];
}

export interface ImportedSidebar {
  favorites: ImportedLink[];
  spaces: ImportedSpace[];
  stats: {
    totalPins: number;
    totalFolders: number;
    skippedEmptyFolders: number;
    skippedSearches: number;
    deduped: number;
    skippedBroken: number;
  };
}

export type Command =
  | { type: 'reconcile'; windowId: number; recover?: boolean }
  | { type: 'switchSpace'; windowId: number; spaceId: string; keepOverlayOpen?: boolean }
  | { type: 'shiftSpace'; windowId: number; offset: -1 | 1; keepOverlayOpen?: boolean }
  | {
      type: 'createSpace';
      windowId: number;
      name: string;
      hue?: number;
      icon?: string;
      theme?: SpaceTheme;
    }
  | {
      type: 'updateSpace';
      spaceId: string;
      name?: string;
      hue?: number;
      icon?: string;
      theme?: SpaceTheme;
    }
  | { type: 'deleteSpace'; windowId: number; spaceId: string }
  | { type: 'moveSpace'; spaceId: string; index: number }
  | { type: 'openFavorite'; windowId: number; favoriteId: string }
  | { type: 'openFavoriteByUrl'; windowId: number; url: string }
  | { type: 'addFavorite'; windowId: number; tabId: number; index?: number }
  | { type: 'addUrlFavorite'; title: string; url: string; index?: number }
  | { type: 'favoritePin'; windowId: number; pinId: string; index?: number }
  | { type: 'unloadFavorite'; windowId: number; favoriteId: string }
  | { type: 'resetFavorite'; windowId: number; favoriteId: string }
  | { type: 'replaceFavoriteUrl'; windowId: number; favoriteId: string }
  | { type: 'removeFavorite'; windowId: number; favoriteId: string }
  | { type: 'moveFavorite'; favoriteId: string; index: number }
  | { type: 'openPin'; windowId: number; pinId: string }
  | { type: 'unloadPin'; windowId: number; pinId: string }
  | { type: 'resetPin'; windowId: number; pinId: string }
  | { type: 'replacePinUrl'; windowId: number; pinId: string }
  | { type: 'pinTab'; windowId: number; tabId: number; parentId: string; index?: number }
  | { type: 'unpin'; windowId: number; pinId: string; spaceId: string; index?: number }
  | { type: 'togglePin'; windowId: number; tabId: number }
  | { type: 'createFolder'; parentId: string; title: string; index?: number }
  | { type: 'openFolderPins'; windowId: number; folderId: string }
  | { type: 'renameBookmark'; id: string; title: string }
  | { type: 'deleteBookmark'; windowId: number; id: string }
  | { type: 'moveNode'; windowId: number; id: string; parentId: string; index?: number }
  | { type: 'openTab'; windowId: number; spaceId: string; url?: string }
  | { type: 'activateTab'; windowId: number; tabId: number }
  | { type: 'reloadTab'; tabId: number }
  | { type: 'duplicateTab'; windowId: number; tabId: number }
  | { type: 'closeTab'; windowId: number; tabId: number }
  | { type: 'closeOtherSpaceTabs'; windowId: number; spaceId: string; keepTabId: number }
  | { type: 'moveTab'; windowId: number; tabId: number; spaceId: string; index?: number }
  | { type: 'clearSpaceTabs'; windowId: number; spaceId: string }
  | { type: 'toggleMuteTab'; tabId: number }
  | { type: 'restoreArchived'; windowId: number; spaceId: string; archiveId: string }
  | { type: 'removeArchived'; archiveId: string }
  | { type: 'clearArchive' }
  | { type: 'runAutoArchive' }
  | { type: 'importArc'; windowId: number; data: ImportedSidebar }
  | { type: 'closeNativeSidePanel' };
