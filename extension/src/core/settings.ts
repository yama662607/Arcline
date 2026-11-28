import { normalizeShortcutCombo } from './shortcut-keys';
import { hasControlChar, isSafeNavigableUrl } from './snapshot';
import type {
  AutoArchiveHours,
  CommandBarOpenMode,
  CustomCommandAction,
  CustomSiteSearch,
  FavoriteShortcut,
  LanguagePreference,
  SearchEngine,
  Settings,
  ThemeMode,
} from './types';

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  theme: 'system',
  showTopBar: false,
  showOpenInCollapsedFolders: true,
  autoArchiveHours: 24,
  edgeHoverEnabled: true,
  edgeTriggerWidthPx: 6,
  edgeOpenDelayMs: 90,
  edgeCloseDelayMs: 260,
  overlayWidthPx: 290,
  swipeToSwitchSpace: true,
  openEmptySpacePage: true,
  language: 'auto',
  searchEngine: 'google',
  commandBarOpenMode: 'popup',
  customSiteSearches: [],
  disabledSiteSearchIds: [],
  favoriteShortcuts: {},
  tabSwitcherPreview: true,
  customShortcuts: {},
});

const VALID_THEMES = new Set<ThemeMode>(['system', 'light', 'dark']);
const VALID_LANGUAGES = new Set<LanguagePreference>(['auto', 'en', 'ja']);
const VALID_SEARCH_ENGINES = new Set<SearchEngine>(['google', 'duckduckgo', 'brave']);
const VALID_COMMAND_BAR_MODES = new Set<CommandBarOpenMode>(['popup', 'newtab']);
const VALID_CUSTOM_ACTIONS: readonly CustomCommandAction[] = [
  'openCommandBar',
  'toggleSidebar',
  'nextSpace',
  'previousSpace',
  'togglePin',
];
const VALID_ARCHIVE_HOURS = new Set<AutoArchiveHours>([0, 12, 24, 168]);
const PREFIX_RE = /^[a-z0-9][a-z0-9_-]{0,15}$/;
const ALIAS_RE = /^[a-z0-9][a-z0-9_-]{0,23}$/;
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

export function sanitizeCustomSiteSearch(raw: unknown): CustomSiteSearch | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const prefix = typeof obj.prefix === 'string' ? obj.prefix.trim().toLowerCase() : '';
  const label = typeof obj.label === 'string' ? obj.label.trim() : '';
  const urlTemplate = typeof obj.urlTemplate === 'string' ? obj.urlTemplate.trim() : '';
  if (!PREFIX_RE.test(prefix) || !label || !urlTemplate.includes('%s')) return null;
  if (hasControlChar(urlTemplate)) return null;
  try {
    const parsed = new URL(urlTemplate.replaceAll('%s', 'query'));
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  } catch {
    return null;
  }
  const id =
    typeof obj.id === 'string' && obj.id.trim().length > 0 ? obj.id.trim() : `custom:${prefix}`;
  const accent =
    typeof obj.accent === 'string' && HEX_COLOR_RE.test(obj.accent.trim())
      ? obj.accent.trim()
      : undefined;
  return { id, prefix, label: label.slice(0, 40), urlTemplate, accent };
}

const FORBIDDEN_RECORD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function sanitizeFavoriteShortcuts(raw: unknown): Record<string, FavoriteShortcut> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Record<string, FavoriteShortcut> = {};
  for (const [url, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!url || FORBIDDEN_RECORD_KEYS.has(url) || !isSafeNavigableUrl(url)) continue;
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const rawAlias = typeof obj.alias === 'string' ? obj.alias.trim().toLowerCase() : '';
    const alias = ALIAS_RE.test(rawAlias) ? rawAlias : undefined;
    const shortcut = normalizeShortcutCombo(obj.shortcut);
    if (alias || shortcut) {
      result[url] = { ...(alias ? { alias } : {}), ...(shortcut ? { shortcut } : {}) };
    }
  }
  return result;
}

export function sanitizeCustomShortcuts(
  raw: unknown,
): Partial<Record<CustomCommandAction, string>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const result: Partial<Record<CustomCommandAction, string>> = {};
  for (const action of VALID_CUSTOM_ACTIONS) {
    const combo = normalizeShortcutCombo(obj[action]);
    if (combo) result[action] = combo;
  }
  return result;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Hydrates partial or older persisted settings safely with defaults. */
export function completeSettings(partial?: Partial<Settings> | null): Settings {
  const theme =
    partial?.theme && VALID_THEMES.has(partial.theme) ? partial.theme : DEFAULT_SETTINGS.theme;
  const autoArchiveHours =
    partial?.autoArchiveHours !== undefined && VALID_ARCHIVE_HOURS.has(partial.autoArchiveHours)
      ? partial.autoArchiveHours
      : DEFAULT_SETTINGS.autoArchiveHours;
  const showTopBar =
    typeof partial?.showTopBar === 'boolean' ? partial.showTopBar : DEFAULT_SETTINGS.showTopBar;
  const showOpenInCollapsedFolders =
    typeof partial?.showOpenInCollapsedFolders === 'boolean'
      ? partial.showOpenInCollapsedFolders
      : DEFAULT_SETTINGS.showOpenInCollapsedFolders;
  const edgeHoverEnabled =
    typeof partial?.edgeHoverEnabled === 'boolean'
      ? partial.edgeHoverEnabled
      : DEFAULT_SETTINGS.edgeHoverEnabled;
  const swipeToSwitchSpace =
    typeof partial?.swipeToSwitchSpace === 'boolean'
      ? partial.swipeToSwitchSpace
      : DEFAULT_SETTINGS.swipeToSwitchSpace;
  const openEmptySpacePage =
    typeof partial?.openEmptySpacePage === 'boolean'
      ? partial.openEmptySpacePage
      : DEFAULT_SETTINGS.openEmptySpacePage;
  const tabSwitcherPreview =
    typeof partial?.tabSwitcherPreview === 'boolean'
      ? partial.tabSwitcherPreview
      : DEFAULT_SETTINGS.tabSwitcherPreview;
  const language =
    partial?.language && VALID_LANGUAGES.has(partial.language)
      ? partial.language
      : DEFAULT_SETTINGS.language;
  const searchEngine =
    partial?.searchEngine && VALID_SEARCH_ENGINES.has(partial.searchEngine)
      ? partial.searchEngine
      : DEFAULT_SETTINGS.searchEngine;
  const commandBarOpenMode =
    partial?.commandBarOpenMode && VALID_COMMAND_BAR_MODES.has(partial.commandBarOpenMode)
      ? partial.commandBarOpenMode
      : DEFAULT_SETTINGS.commandBarOpenMode;

  return {
    theme,
    showTopBar,
    showOpenInCollapsedFolders,
    autoArchiveHours,
    edgeHoverEnabled,
    edgeTriggerWidthPx: clampInt(
      partial?.edgeTriggerWidthPx,
      2,
      24,
      DEFAULT_SETTINGS.edgeTriggerWidthPx,
    ),
    edgeOpenDelayMs: clampInt(partial?.edgeOpenDelayMs, 0, 500, DEFAULT_SETTINGS.edgeOpenDelayMs),
    edgeCloseDelayMs: clampInt(
      partial?.edgeCloseDelayMs,
      80,
      1200,
      DEFAULT_SETTINGS.edgeCloseDelayMs,
    ),
    overlayWidthPx: clampInt(partial?.overlayWidthPx, 220, 560, DEFAULT_SETTINGS.overlayWidthPx),
    swipeToSwitchSpace,
    openEmptySpacePage,
    language,
    searchEngine,
    commandBarOpenMode,
    customSiteSearches: Array.isArray(partial?.customSiteSearches)
      ? partial.customSiteSearches
          .map(sanitizeCustomSiteSearch)
          .filter((item): item is CustomSiteSearch => item !== null)
      : [],
    disabledSiteSearchIds: Array.isArray(partial?.disabledSiteSearchIds)
      ? Array.from(
          new Set(
            partial.disabledSiteSearchIds
              .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
              .map((id) => id.trim().slice(0, 64)),
          ),
        )
      : [],
    favoriteShortcuts: sanitizeFavoriteShortcuts(partial?.favoriteShortcuts),
    tabSwitcherPreview,
    customShortcuts: sanitizeCustomShortcuts(partial?.customShortcuts),
  };
}
