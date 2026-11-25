/**
 * Arc-style unified Command Bar engine.
 *
 * Pure and deterministic: no `chrome.*`, no DOM, no React. The UI gathers raw data (open tabs,
 * history, ...) and passes it to `buildCommandBarResults`. Everything user-visible that depends on
 * the language is expressed as a *key* (`CommandBarBadge`, `QuickActionId`, `CommandBarItem.kind`)
 * and localized by the UI through the `commandBar.*` message keys.
 */
import type {
  ArchivedTab,
  CustomSiteSearch,
  Favorite,
  FavoriteShortcut,
  PinnedNode,
  SearchEngine,
  Space,
} from './types';

// ---------------------------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------------------------

export type CommandBarBadge =
  | 'switchTab'
  | 'favorite'
  | 'pinned'
  | 'history'
  | 'archived'
  | 'action'
  | 'siteSearch'
  | 'search'
  | 'navigate';

export type QuickActionId =
  | 'newSpace'
  | 'toggleTheme'
  | 'openSettings'
  | 'clearTodayTabs'
  | 'openOnboarding'
  | 'openShortcuts';

export type SiteSearchId = string;

export interface SiteSearch {
  id: SiteSearchId;
  /** Typed followed by a space (or Tab) to activate the chip. */
  prefix: string;
  /** Brand name, not localized. */
  label: string;
  /** URL template; `%s` is replaced with the URI-encoded term. */
  urlTemplate: string;
  /** Chip accent color (CSS color). */
  accent: string;
  /** Hosts (without `www.`) belonging to the site; used to surface matching history/tabs. */
  hosts: readonly string[];
}

export interface SearchEngineConfig {
  label: string;
  urlTemplate: string;
}

export interface CommandBarTab {
  id: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active?: boolean;
}

export interface CommandBarHistoryEntry {
  url: string;
  title?: string;
  /** Epoch ms, as reported by `chrome.history`. */
  lastVisitTime?: number;
  visitCount?: number;
}

export type CommandBarAction =
  | { type: 'switchTab'; tabId: number; windowId?: number }
  | { type: 'openUrl'; url: string }
  | { type: 'openPin'; pinId: string }
  | { type: 'openFavorite'; favoriteId: string }
  | { type: 'restoreArchived'; archiveId: string; spaceId: string }
  | { type: 'quickAction'; id: QuickActionId };

interface ItemBase<K extends string, A extends CommandBarAction> {
  kind: K;
  id: string;
  /** Raw data for kinds without a natural title (url / term / action id); UI localizes. */
  title: string;
  /** Display URL (host + path) when the item has one, else empty. */
  subtitle: string;
  url?: string;
  favIconUrl?: string;
  badge: CommandBarBadge;
  /** All badges after merging duplicates; `badges[0] === badge`. */
  badges: CommandBarBadge[];
  spaceId?: string;
  spaceName?: string;
  /** Folder names from the Space root down to the pin's parent folder. */
  folderPath?: string[];
  score: number;
  action: A;
}

export type TabItem = ItemBase<'tab', Extract<CommandBarAction, { type: 'switchTab' }>>;
export type FavoriteItem = ItemBase<
  'favorite',
  Extract<CommandBarAction, { type: 'openFavorite' }>
> & {
  alias?: string;
  shortcut?: string;
};
export type PinItem = ItemBase<'pin', Extract<CommandBarAction, { type: 'openPin' }>>;
export type HistoryItem = ItemBase<'history', Extract<CommandBarAction, { type: 'openUrl' }>>;
export type ArchivedItem = ItemBase<
  'archived',
  Extract<CommandBarAction, { type: 'restoreArchived' }>
>;
export type QuickActionItem = ItemBase<
  'quickAction',
  Extract<CommandBarAction, { type: 'quickAction' }>
> & { actionId: QuickActionId };
export type SiteSearchItem = ItemBase<
  'siteSearch',
  Extract<CommandBarAction, { type: 'openUrl' }>
> & {
  siteSearchId: SiteSearchId;
  term: string;
};
export type NavigateItem = ItemBase<'navigate', Extract<CommandBarAction, { type: 'openUrl' }>>;
export type WebSearchItem = ItemBase<
  'webSearch',
  Extract<CommandBarAction, { type: 'openUrl' }>
> & {
  engine: SearchEngine;
  term: string;
};

export type CommandBarItem =
  | TabItem
  | FavoriteItem
  | PinItem
  | HistoryItem
  | ArchivedItem
  | QuickActionItem
  | SiteSearchItem
  | NavigateItem
  | WebSearchItem;

export type CommandBarItemKind = CommandBarItem['kind'];

export interface CommandBarInput {
  query: string;
  openTabs: readonly CommandBarTab[];
  favorites: readonly Favorite[];
  spaces: readonly Space[];
  history: readonly CommandBarHistoryEntry[];
  archived: readonly ArchivedTab[];
  searchEngine?: SearchEngine;
  activeSpaceId?: string;
  /** Chip already activated by the UI; `query` is then only the search term. */
  activeSiteSearchId?: SiteSearchId;
  /** Localized action labels; used as the item title and as extra searchable text. */
  actionLabels?: Partial<Record<QuickActionId, string>>;
  /** User-defined custom site searches merged with built-in SITE_SEARCHES. */
  customSiteSearches?: readonly CustomSiteSearch[];
  /** Per-Favorite alias & shortcut map keyed by Favorite URL. */
  favoriteShortcuts?: Readonly<Record<string, FavoriteShortcut>>;
  /** Currently active tab ID in the focused window; excluded (along with its exact URL) from candidates. */
  activeTabId?: number;
  /** Epoch ms used for the history recency bonus. Defaults to `Date.now()`. */
  now?: number;
  /** Maximum number of returned items. Default `DEFAULT_RESULT_LIMIT`. */
  limit?: number;
}

export interface CommandBarResult {
  items: CommandBarItem[];
  /** Chip that is (now) active, either passed in or detected from `prefix + space`. */
  activeSiteSearch?: SiteSearch;
  /** Partially typed prefix the UI may complete with Tab (e.g. input `gh` or `y`). */
  siteSearchSuggestion?: SiteSearch;
  /** Query without the site-search prefix. */
  term: string;
}

// ---------------------------------------------------------------------------------------------
// Static tables
// ---------------------------------------------------------------------------------------------

export const DEFAULT_RESULT_LIMIT = 20;

export const SITE_SEARCHES: readonly SiteSearch[] = [
  {
    id: 'google',
    prefix: 'g',
    label: 'Google',
    urlTemplate: 'https://www.google.com/search?q=%s',
    accent: '#4285f4',
    hosts: ['google.com'],
  },
  {
    id: 'github',
    prefix: 'gh',
    label: 'GitHub',
    urlTemplate: 'https://github.com/search?q=%s',
    accent: '#8b5cf6',
    hosts: ['github.com'],
  },
  {
    id: 'youtube',
    prefix: 'yt',
    label: 'YouTube',
    urlTemplate: 'https://www.youtube.com/results?search_query=%s',
    accent: '#ff0033',
    hosts: ['youtube.com', 'youtu.be'],
  },
  {
    id: 'wikipedia',
    prefix: 'wiki',
    label: 'Wikipedia',
    urlTemplate: 'https://en.wikipedia.org/w/index.php?search=%s',
    accent: '#64748b',
    hosts: ['wikipedia.org'],
  },
  {
    id: 'chatgpt',
    prefix: 'gpt',
    label: 'ChatGPT',
    urlTemplate: 'https://chatgpt.com/?q=%s',
    accent: '#10a37f',
    hosts: ['chatgpt.com', 'chat.openai.com'],
  },
  {
    id: 'perplexity',
    prefix: 'pplx',
    label: 'Perplexity',
    urlTemplate: 'https://www.perplexity.ai/search?q=%s',
    accent: '#20b8cd',
    hosts: ['perplexity.ai'],
  },
  // Additional AI services
  {
    id: 'claude',
    prefix: 'cl',
    label: 'Claude',
    urlTemplate: 'https://claude.ai/new?q=%s',
    accent: '#d97757',
    hosts: ['claude.ai'],
  },
  {
    id: 'gemini',
    prefix: 'gem',
    label: 'Gemini',
    urlTemplate: 'https://gemini.google.com/app?q=%s',
    accent: '#4285f4',
    hosts: ['gemini.google.com'],
  },
  {
    id: 'grok',
    prefix: 'grok',
    label: 'Grok',
    urlTemplate: 'https://grok.com/?q=%s',
    accent: '#52525b',
    hosts: ['grok.com'],
  },
  {
    id: 'google-ai',
    prefix: 'ai',
    label: 'Google AI',
    urlTemplate: 'https://www.google.com/search?udm=50&q=%s',
    accent: '#6366f1',
    hosts: ['google.com'],
  },
  // Developer, research & daily utilities
  {
    id: 'mdn',
    prefix: 'mdn',
    label: 'MDN',
    urlTemplate: 'https://developer.mozilla.org/en-US/search?q=%s',
    accent: '#0284c7',
    hosts: ['developer.mozilla.org'],
  },
  {
    id: 'npm',
    prefix: 'npm',
    label: 'npm',
    urlTemplate: 'https://www.npmjs.com/search?q=%s',
    accent: '#cb3837',
    hosts: ['npmjs.com'],
  },
  {
    id: 'arxiv',
    prefix: 'arx',
    label: 'arXiv',
    urlTemplate: 'https://arxiv.org/search/?query=%s&searchtype=all',
    accent: '#b31b1b',
    hosts: ['arxiv.org'],
  },
  {
    id: 'scholar',
    prefix: 'sch',
    label: 'Scholar',
    urlTemplate: 'https://scholar.google.com/scholar?q=%s',
    accent: '#2563eb',
    hosts: ['scholar.google.com'],
  },
  {
    id: 'x',
    prefix: 'x',
    label: 'X',
    urlTemplate: 'https://x.com/search?q=%s',
    accent: '#3f3f46',
    hosts: ['x.com', 'twitter.com'],
  },
  {
    id: 'amazon',
    prefix: 'amz',
    label: 'Amazon',
    urlTemplate: 'https://www.amazon.co.jp/s?k=%s',
    accent: '#f59e0b',
    hosts: ['amazon.co.jp', 'amazon.com'],
  },
  {
    id: 'maps',
    prefix: 'map',
    label: 'Google Maps',
    urlTemplate: 'https://www.google.com/maps/search/%s',
    accent: '#16a34a',
    hosts: ['google.com'],
  },
  {
    id: 'reddit',
    prefix: 'rd',
    label: 'Reddit',
    urlTemplate: 'https://www.reddit.com/search/?q=%s',
    accent: '#ff4500',
    hosts: ['reddit.com'],
  },
] as const;

export const SEARCH_ENGINE_URLS: Readonly<Record<SearchEngine, SearchEngineConfig>> = {
  google: { label: 'Google', urlTemplate: 'https://www.google.com/search?q=%s' },
  duckduckgo: { label: 'DuckDuckGo', urlTemplate: 'https://duckduckgo.com/?q=%s' },
  brave: { label: 'Brave Search', urlTemplate: 'https://search.brave.com/search?q=%s' },
};

interface QuickActionDefinition {
  id: QuickActionId;
  /** Language-agnostic English + Japanese search keywords. */
  keywords: readonly string[];
  /** Shown in the default (empty query) list. */
  showByDefault: boolean;
}

export const QUICK_ACTIONS: readonly QuickActionDefinition[] = [
  {
    id: 'newSpace',
    keywords: [
      'new space',
      'create space',
      'add space',
      '新しいスペース',
      'スペース作成',
      'スペースを作成',
    ],
    showByDefault: true,
  },
  {
    id: 'toggleTheme',
    keywords: [
      'toggle theme',
      'dark mode',
      'light mode',
      'theme',
      'テーマ切り替え',
      'テーマ',
      'ダークモード',
      'ライトモード',
    ],
    showByDefault: true,
  },
  {
    id: 'openSettings',
    keywords: ['open settings', 'settings', 'preferences', '設定', '設定を開く'],
    showByDefault: true,
  },
  {
    id: 'clearTodayTabs',
    keywords: [
      'clear today tabs',
      'clear tabs',
      'close tabs',
      'today',
      '今日のタブ',
      'タブを整理',
      'タブをクリア',
    ],
    showByDefault: false,
  },
  {
    id: 'openOnboarding',
    keywords: [
      'onboarding guide',
      'onboarding',
      'guide',
      'tutorial',
      'help',
      'ガイド',
      'はじめに',
      'チュートリアル',
      'ヘルプ',
    ],
    showByDefault: false,
  },
  {
    id: 'openShortcuts',
    keywords: [
      'shortcuts',
      'keyboard shortcuts',
      'hotkey',
      'ショートカット',
      'キーボードショートカット',
    ],
    showByDefault: false,
  },
];

const EMPTY_QUERY_MAX_TABS = 5;
const EMPTY_QUERY_MAX_FAVORITES = 4;

/** Base relevance of each match tier, before field weights. */
const SCORE_EXACT = 1000;
const SCORE_PREFIX = 800;
const SCORE_WORD_PREFIX = 600;
const SCORE_SUBSTRING = 400;
const SCORE_FUZZY = 150;

const FIELD_WEIGHT_TITLE = 1;
const FIELD_WEIGHT_HOST = 0.9;
const FIELD_WEIGHT_KEYWORD = 0.85;
const FIELD_WEIGHT_PATH = 0.55;

/** Flat bonus by source; deliberately smaller than the gap between match tiers. */
const KIND_BONUS: Readonly<Record<CommandBarItemKind, number>> = {
  tab: 60,
  quickAction: 60,
  favorite: 40,
  pin: 40,
  history: 0,
  archived: -40,
  siteSearch: 0,
  navigate: 0,
  webSearch: 0,
};

/** Higher wins when the same URL appears from several sources. */
const KIND_PRIORITY: Readonly<Record<CommandBarItemKind, number>> = {
  tab: 7,
  favorite: 6,
  pin: 5,
  history: 4,
  archived: 3,
  navigate: 2,
  webSearch: 1,
  siteSearch: 1,
  quickAction: 0,
};

const ACTIVE_SPACE_TAB_BONUS = 10;
const SITE_SEARCH_SCORE = 10_000;
const WEB_SEARCH_BOOSTED_SCORE = 1_500;
const NAVIGATE_SCORE = 950;
/** Below prefix / word-prefix / open-tab matches, above weak history and fuzzy matches. */
const WEB_SEARCH_SCORE = 450;
const HISTORY_MAX_RECENCY_BONUS = 30;
const HISTORY_MAX_VISIT_BONUS = 20;
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------------------------
// Text matching
// ---------------------------------------------------------------------------------------------

/** NFKC + lowercase + katakana-to-hiragana, so 'ぐーぐる' finds 'グーグル'. */
export function foldText(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

function isWordPrefix(text: string, token: string): boolean {
  let from = 0;
  for (;;) {
    const idx = text.indexOf(token, from);
    if (idx < 0) return false;
    if (idx === 0 || !WORD_CHAR.test(text[idx - 1] ?? '')) return true;
    from = idx + 1;
  }
}

/** Smallest window containing `token` as a subsequence of `text`, or 0 if none. */
function minSubsequenceSpan(text: string, token: string): number {
  let best = 0;
  let start = text.indexOf(token[0] ?? '');
  while (start >= 0) {
    let pos = start;
    let ok = true;
    for (let i = 1; i < token.length; i++) {
      pos = text.indexOf(token[i] ?? '', pos + 1);
      if (pos < 0) {
        ok = false;
        break;
      }
    }
    if (!ok) break;
    const span = pos - start + 1;
    if (best === 0 || span < best) best = span;
    start = text.indexOf(token[0] ?? '', start + 1);
  }
  return best;
}

/** exact > prefix > word-prefix > substring > subsequence. Both arguments must be folded. */
export function scoreToken(token: string, text: string): number {
  if (!token || !text) return 0;
  if (text === token) return SCORE_EXACT;
  if (text.startsWith(token)) return SCORE_PREFIX;
  if (isWordPrefix(text, token)) return SCORE_WORD_PREFIX;
  if (text.includes(token)) return SCORE_SUBSTRING;
  if (token.length >= 2 && text.length <= 160) {
    const span = minSubsequenceSpan(text, token);
    if (span > 0 && span <= token.length * 3) {
      return SCORE_FUZZY + Math.round(100 * (token.length / span));
    }
  }
  return 0;
}

interface MatchField {
  text: string;
  weight: number;
  allowFuzzy?: boolean;
}

function tokenize(foldedQuery: string): string[] {
  return foldedQuery.split(/\s+/).filter(Boolean);
}

/** Every token must match some field; result is the mean of each token's best weighted score. */
function relevance(
  tokens: readonly string[],
  phrase: string,
  fields: readonly MatchField[],
): number {
  if (tokens.length === 0) return 0;
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const field of fields) {
      const s = scoreToken(token, field.text);
      if (field.allowFuzzy === false && s > 0 && s < SCORE_SUBSTRING) continue;
      const weighted = s * field.weight;
      if (weighted > best) best = weighted;
    }
    if (best <= 0) return 0;
    total += best;
  }
  let score = total / tokens.length;
  const head = fields[0];
  if (tokens.length > 1 && head?.text.includes(phrase)) score += 60;
  return Math.round(score);
}

// ---------------------------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------------------------

const DANGEROUS_SCHEME = /^\s*(javascript|data|vbscript):/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isIpv4(host: string): boolean {
  const m = IPV4.exec(host);
  if (!m) return false;
  return m.slice(1).every((part) => Number(part) <= 255);
}

interface BareHost {
  host: string;
  local: boolean;
}

/** Parses `host[:port][/path?query#hash]` without a scheme. */
function parseBareHost(input: string): BareHost | undefined {
  const m = /^([^/?#:]+)(?::(\d{1,5}))?(?:[/?#].*)?$/.exec(input);
  if (!m) return undefined;
  const host = (m[1] ?? '').toLowerCase();
  if (host === 'localhost' || isIpv4(host)) return { host, local: true };
  if (m[2] !== undefined && Number(m[2]) > 65535) return undefined;
  const labels = host.split('.');
  if (labels.length < 2) return undefined;
  const label = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u;
  if (!labels.every((l) => label.test(l))) return undefined;
  const tld = labels[labels.length - 1] ?? '';
  if (!(/^\p{L}{2,}$/u.test(tld) || /^xn--[a-z0-9-]+$/.test(tld))) return undefined;
  return { host, local: false };
}

/** True when the input should be navigated to directly rather than searched. */
export function looksLikeUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return false;
  }
  if (DANGEROUS_SCHEME.test(trimmed)) return false;
  if (HAS_SCHEME.test(trimmed)) {
    try {
      const protocol = new URL(trimmed).protocol.toLowerCase();
      return (
        protocol === 'http:' ||
        protocol === 'https:' ||
        protocol === 'chrome:' ||
        protocol === 'brave:' ||
        protocol === 'edge:' ||
        protocol === 'about:'
      );
    } catch {
      return false;
    }
  }
  return parseBareHost(trimmed) !== undefined;
}

/** Returns an absolute URL for URL-like input, or `null` (also for dangerous schemes). */
export function normalizeDestinationUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!looksLikeUrl(trimmed)) return null;
  if (HAS_SCHEME.test(trimmed)) return trimmed;
  const bare = parseBareHost(trimmed);
  if (!bare) return null;
  return `${bare.local ? 'http' : 'https'}://${trimmed}`;
}

export function buildSearchUrl(engine: SearchEngine, term: string): string {
  return SEARCH_ENGINE_URLS[engine].urlTemplate.replace('%s', encodeURIComponent(term));
}

export function buildSiteSearchUrl(siteSearch: SiteSearch, term: string): string {
  return siteSearch.urlTemplate.replace('%s', encodeURIComponent(term));
}

/** Host without `www.`, or empty string when not parseable. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

/** Human-friendly `host/path` without scheme, `www.` and trailing slash. */
export function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return url;
    const rest = `${u.pathname}${u.search}`.replace(/\/$/, '');
    return `${u.host.replace(/^www\./i, '')}${rest}`;
  } catch {
    return url;
  }
}

/** Key for duplicate detection: ignores scheme, `www.`, hash and trailing slash. */
export function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '');
    if (u.protocol === 'http:' || u.protocol === 'https:') return `${host}${path}${u.search}`;
    return `${u.protocol}//${host}${path}${u.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

/** True for this extension's New Tab / Command Bar page and the browser's own new-tab pages. */
export function isCommandBarPageUrl(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.includes('/empty-space.html') ||
    /^(chrome|brave|edge):\/\/newtab\/?/i.test(url) ||
    url.startsWith('chrome-search://local-ntp')
  );
}

// ---------------------------------------------------------------------------------------------
// Site-search prefix handling
// ---------------------------------------------------------------------------------------------

/** Merges built-in and user-defined custom site searches (custom prefix overrides built-in). */
export function getAllSiteSearches(custom?: readonly CustomSiteSearch[]): SiteSearch[] {
  if (!custom || custom.length === 0) return [...SITE_SEARCHES];
  const byPrefix = new Map<string, SiteSearch>();
  for (const s of SITE_SEARCHES) {
    byPrefix.set(s.prefix.toLowerCase(), s);
  }
  for (const c of custom) {
    const prefix = c.prefix.trim().toLowerCase();
    if (!prefix || !c.urlTemplate.includes('%s')) continue;
    const host = hostOf(c.urlTemplate.replace('%s', 'query'));
    byPrefix.set(prefix, {
      id: c.id || `custom:${prefix}`,
      prefix,
      label: c.label.trim() || prefix,
      urlTemplate: c.urlTemplate,
      accent: c.accent ?? '#6366f1',
      hosts: host ? [host] : [],
    });
  }
  return [...byPrefix.values()];
}

export function getSiteSearchById(
  id: SiteSearchId,
  custom?: readonly CustomSiteSearch[],
): SiteSearch {
  const all = getAllSiteSearches(custom);
  const found = all.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown site search: ${id}`);
  return found;
}

export interface SiteSearchMatch {
  siteSearch: SiteSearch;
  /** Text after the prefix, leading whitespace removed. */
  term: string;
}

/** Detects `<prefix><whitespace>...` (case-insensitive). `gh ` activates GitHub with an empty term. */
export function matchSiteSearchPrefix(
  input: string,
  custom?: readonly CustomSiteSearch[],
): SiteSearchMatch | undefined {
  const m = /^\s*(\S+)\s(.*)$/s.exec(input);
  if (!m) return undefined;
  const typed = (m[1] ?? '').toLowerCase();
  const siteSearch = getAllSiteSearches(custom).find((s) => s.prefix === typed);
  if (!siteSearch) return undefined;
  return { siteSearch, term: (m[2] ?? '').replace(/^\s+/, '') };
}

/**
 * Partially typed prefix (`g`, `gh`, `y`, `wik`, ...) that Tab may complete into a chip.
 * An exact prefix wins; otherwise the first table entry that starts with the input.
 */
export function suggestSiteSearch(
  input: string,
  custom?: readonly CustomSiteSearch[],
): SiteSearch | undefined {
  if (!input || /\s/.test(input)) return undefined;
  const typed = input.toLowerCase();
  const all = getAllSiteSearches(custom);
  return all.find((s) => s.prefix === typed) ?? all.find((s) => s.prefix.startsWith(typed));
}

// ---------------------------------------------------------------------------------------------
// Space lookups
// ---------------------------------------------------------------------------------------------

/** tabId -> owning Space, from `Space.tabIds`. */
export function buildTabSpaceIndex(spaces: readonly Space[]): Map<number, Space> {
  const index = new Map<number, Space>();
  for (const space of spaces) {
    for (const tabId of space.tabIds) {
      if (!index.has(tabId)) index.set(tabId, space);
    }
  }
  return index;
}

export function findSpaceForTab(spaces: readonly Space[], tabId: number): Space | undefined {
  return spaces.find((s) => s.tabIds.includes(tabId));
}

export function spaceNameForTab(spaces: readonly Space[], tabId: number): string | undefined {
  return findSpaceForTab(spaces, tabId)?.name;
}

export interface FlatPin {
  id: string;
  title: string;
  url: string;
  folderPath: string[];
}

export function flattenPinsWithPath(
  nodes: readonly PinnedNode[],
  parents: string[] = [],
): FlatPin[] {
  const out: FlatPin[] = [];
  for (const node of nodes) {
    if (node.kind === 'pin') {
      out.push({ id: node.id, title: node.title, url: node.url, folderPath: [...parents] });
    } else {
      out.push(...flattenPinsWithPath(node.children, [...parents, node.title]));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Candidate collection
// ---------------------------------------------------------------------------------------------

interface Candidate {
  item: CommandBarItem;
  /** Fields to match; first is the title-like field. */
  fields: MatchField[];
  /** Insertion order for stable tie-breaking and default-list ordering. */
  seq: number;
}

function urlFields(title: string, url: string): MatchField[] {
  const host = hostOf(url);
  let rest = '';
  try {
    const u = new URL(url);
    rest = foldText(`${u.pathname}${u.search}`);
  } catch {
    rest = foldText(url);
  }
  return [
    { text: foldText(title), weight: FIELD_WEIGHT_TITLE },
    { text: host, weight: FIELD_WEIGHT_HOST },
    { text: foldText(displayUrl(url)), weight: FIELD_WEIGHT_HOST },
    { text: rest, weight: FIELD_WEIGHT_PATH },
    { text: foldText(url), weight: FIELD_WEIGHT_PATH },
  ];
}

function titleOrHost(title: string | undefined, url: string): string {
  const trimmed = title?.trim();
  return trimmed ? trimmed : displayUrl(url);
}

function isNavigableUrl(url: string | undefined): url is string {
  return typeof url === 'string' && url.length > 0 && !DANGEROUS_SCHEME.test(url);
}

function collectCandidates(input: CommandBarInput): Candidate[] {
  const out: Candidate[] = [];
  let seq = 0;
  const push = (item: CommandBarItem, fields: MatchField[]) => {
    out.push({ item, fields, seq: seq++ });
  };
  const tabSpaces = buildTabSpaceIndex(input.spaces);
  const activeTab =
    input.activeTabId !== undefined
      ? input.openTabs.find((t) => t.id === input.activeTabId)
      : undefined;
  const activeUrlKey =
    activeTab && isNavigableUrl(activeTab.url) && !isCommandBarPageUrl(activeTab.url)
      ? normalizeUrlKey(activeTab.url)
      : undefined;

  // Open tabs ------------------------------------------------------------------------------
  for (const tab of input.openTabs) {
    if (
      tab.id === input.activeTabId ||
      !isNavigableUrl(tab.url) ||
      isCommandBarPageUrl(tab.url) ||
      tab.url === 'about:blank'
    ) {
      continue;
    }
    const space = tabSpaces.get(tab.id);
    const title = titleOrHost(tab.title, tab.url);
    push(
      {
        kind: 'tab',
        id: `tab:${tab.id}`,
        title,
        subtitle: displayUrl(tab.url),
        url: tab.url,
        favIconUrl: tab.favIconUrl,
        badge: 'switchTab',
        badges: ['switchTab'],
        spaceId: space?.id,
        spaceName: space?.name,
        score: 0,
        action: { type: 'switchTab', tabId: tab.id, windowId: tab.windowId },
      },
      urlFields(title, tab.url),
    );
  }

  // Favorites ------------------------------------------------------------------------------
  const normalizedFavShortcuts = new Map<string, FavoriteShortcut>();
  for (const [url, meta] of Object.entries(input.favoriteShortcuts ?? {})) {
    normalizedFavShortcuts.set(url, meta);
    normalizedFavShortcuts.set(normalizeUrlKey(url), meta);
  }
  for (const fav of input.favorites) {
    if (!isNavigableUrl(fav.url)) continue;
    if (activeUrlKey && normalizeUrlKey(fav.url) === activeUrlKey) continue;
    const title = titleOrHost(fav.title, fav.url);
    const meta =
      normalizedFavShortcuts.get(fav.url) ?? normalizedFavShortcuts.get(normalizeUrlKey(fav.url));
    const fields = urlFields(title, fav.url);
    if (meta?.alias) {
      fields.unshift({ text: foldText(meta.alias), weight: FIELD_WEIGHT_TITLE });
    }
    push(
      {
        kind: 'favorite',
        id: `favorite:${fav.id}`,
        title,
        subtitle: displayUrl(fav.url),
        url: fav.url,
        badge: 'favorite',
        badges: ['favorite'],
        alias: meta?.alias,
        shortcut: meta?.shortcut,
        score: 0,
        action: { type: 'openFavorite', favoriteId: fav.id },
      },
      fields,
    );
  }

  // Pinned tabs: active Space first so duplicates resolve to it ------------------------------
  const orderedSpaces = [...input.spaces].sort(
    (a, b) => Number(b.id === input.activeSpaceId) - Number(a.id === input.activeSpaceId),
  );
  for (const space of orderedSpaces) {
    for (const pin of flattenPinsWithPath(space.pinned)) {
      if (!isNavigableUrl(pin.url)) continue;
      if (activeUrlKey && normalizeUrlKey(pin.url) === activeUrlKey) continue;
      const title = titleOrHost(pin.title, pin.url);
      const fields = urlFields(title, pin.url);
      fields.push({ text: foldText(space.name), weight: FIELD_WEIGHT_PATH });
      for (const folder of pin.folderPath) {
        fields.push({ text: foldText(folder), weight: FIELD_WEIGHT_PATH });
      }
      push(
        {
          kind: 'pin',
          id: `pin:${pin.id}`,
          title,
          subtitle: displayUrl(pin.url),
          url: pin.url,
          badge: 'pinned',
          badges: ['pinned'],
          spaceId: space.id,
          spaceName: space.name,
          folderPath: pin.folderPath,
          score: 0,
          action: { type: 'openPin', pinId: pin.id },
        },
        fields,
      );
    }
  }

  // History ----------------------------------------------------------------------------------
  for (const entry of input.history) {
    if (!isNavigableUrl(entry.url)) continue;
    if (activeUrlKey && normalizeUrlKey(entry.url) === activeUrlKey) continue;
    const title = titleOrHost(entry.title, entry.url);
    push(
      {
        kind: 'history',
        id: `history:${entry.url}`,
        title,
        subtitle: displayUrl(entry.url),
        url: entry.url,
        badge: 'history',
        badges: ['history'],
        score: 0,
        action: { type: 'openUrl', url: entry.url },
      },
      urlFields(title, entry.url),
    );
  }

  // Archived tabs ----------------------------------------------------------------------------
  for (const archived of input.archived) {
    if (!isNavigableUrl(archived.url)) continue;
    if (activeUrlKey && normalizeUrlKey(archived.url) === activeUrlKey) continue;
    const space =
      input.spaces.find((s) => s.name === archived.spaceName) ??
      input.spaces.find((s) => s.id === input.activeSpaceId) ??
      input.spaces[0];
    const title = titleOrHost(archived.title, archived.url);
    push(
      {
        kind: 'archived',
        id: `archived:${archived.id}`,
        title,
        subtitle: displayUrl(archived.url),
        url: archived.url,
        badge: 'archived',
        badges: ['archived'],
        spaceId: space?.id,
        spaceName: archived.spaceName,
        score: 0,
        action: { type: 'restoreArchived', archiveId: archived.id, spaceId: space?.id ?? '' },
      },
      urlFields(title, archived.url),
    );
  }

  // Quick actions ----------------------------------------------------------------------------
  for (const def of QUICK_ACTIONS) {
    const label = input.actionLabels?.[def.id];
    const fields: MatchField[] = [];
    if (label) fields.push({ text: foldText(label), weight: FIELD_WEIGHT_TITLE });
    for (const keyword of def.keywords) {
      fields.push({ text: foldText(keyword), weight: FIELD_WEIGHT_KEYWORD, allowFuzzy: false });
    }
    push(
      {
        kind: 'quickAction',
        id: `action:${def.id}`,
        title: label ?? def.id,
        subtitle: '',
        badge: 'action',
        badges: ['action'],
        score: 0,
        action: { type: 'quickAction', id: def.id },
        actionId: def.id,
      },
      fields,
    );
  }

  return out;
}

// ---------------------------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------------------------

function historyBonus(entry: CommandBarHistoryEntry | undefined, now: number): number {
  if (!entry) return 0;
  let bonus = 0;
  if (typeof entry.lastVisitTime === 'number' && Number.isFinite(entry.lastVisitTime)) {
    const ageDays = Math.max(0, (now - entry.lastVisitTime) / DAY_MS);
    bonus += HISTORY_MAX_RECENCY_BONUS / (1 + ageDays / 7);
  }
  if (typeof entry.visitCount === 'number' && entry.visitCount > 0) {
    bonus += Math.min(HISTORY_MAX_VISIT_BONUS, Math.log2(1 + entry.visitCount) * 4);
  }
  return bonus;
}

function compareItems(
  a: { item: CommandBarItem; seq: number },
  b: { item: CommandBarItem; seq: number },
): number {
  if (b.item.score !== a.item.score) return b.item.score - a.item.score;
  const pa = KIND_PRIORITY[a.item.kind];
  const pb = KIND_PRIORITY[b.item.kind];
  if (pb !== pa) return pb - pa;
  if (a.seq !== b.seq) return a.seq - b.seq;
  return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0;
}

interface Ranked {
  item: CommandBarItem;
  seq: number;
}

/** Collapses items sharing a normalized URL: highest-priority source wins, badges are merged. */
function dedupeByUrl(ranked: readonly Ranked[]): Ranked[] {
  const winners = new Map<string, Ranked>();
  const badges = new Map<string, CommandBarBadge[]>();
  const best = new Map<string, number>();
  const order: Array<string | Ranked> = [];

  for (const entry of ranked) {
    const { item } = entry;
    if (!item.url) {
      order.push(entry);
      continue;
    }
    const key = normalizeUrlKey(item.url);
    const current = winners.get(key);
    if (!current) {
      winners.set(key, entry);
      badges.set(key, [...item.badges]);
      best.set(key, item.score);
      order.push(key);
      continue;
    }
    const merged = badges.get(key) ?? [];
    for (const b of item.badges) if (!merged.includes(b)) merged.push(b);
    badges.set(key, merged);
    best.set(key, Math.max(best.get(key) ?? 0, item.score));
    const beats =
      KIND_PRIORITY[item.kind] > KIND_PRIORITY[current.item.kind] ||
      (KIND_PRIORITY[item.kind] === KIND_PRIORITY[current.item.kind] &&
        item.score > current.item.score);
    if (beats) winners.set(key, entry);
  }

  const out: Ranked[] = [];
  for (const slot of order) {
    if (typeof slot !== 'string') {
      out.push(slot);
      continue;
    }
    const winner = winners.get(slot);
    if (!winner) continue;
    const mergedBadges = badges.get(slot) ?? winner.item.badges;
    const sorted = [winner.item.badge, ...mergedBadges.filter((b) => b !== winner.item.badge)];
    out.push({
      seq: winner.seq,
      item: { ...winner.item, badges: sorted, score: best.get(slot) ?? winner.item.score },
    });
  }
  return out;
}

function defaultList(candidates: readonly Candidate[], input: CommandBarInput): CommandBarItem[] {
  const activeSpace = input.spaces.find((s) => s.id === input.activeSpaceId);
  const activeTabIds = new Set(activeSpace?.tabIds ?? []);
  const tabs = candidates.filter((c) => c.item.kind === 'tab');
  const scoped = activeSpace
    ? tabs.filter(
        (c) => c.item.action.type === 'switchTab' && activeTabIds.has(c.item.action.tabId),
      )
    : tabs;
  const chosenTabs = (scoped.length > 0 ? scoped : tabs).slice(0, EMPTY_QUERY_MAX_TABS);
  const favorites = candidates
    .filter((c) => c.item.kind === 'favorite')
    .slice(0, EMPTY_QUERY_MAX_FAVORITES);
  const defaultActionIds = new Set(QUICK_ACTIONS.filter((a) => a.showByDefault).map((a) => a.id));
  const actions = candidates.filter(
    (c) => c.item.kind === 'quickAction' && defaultActionIds.has(c.item.actionId),
  );

  const ranked: Ranked[] = [];
  const groups: Array<[number, readonly Candidate[]]> = [
    [3000, chosenTabs],
    [2000, favorites],
    [1000, actions],
  ];
  for (const [base, group] of groups) {
    group.forEach((c, i) => {
      ranked.push({ seq: c.seq, item: { ...c.item, score: base - i } });
    });
  }
  return dedupeByUrl(ranked).map((r) => r.item);
}

function buildSiteSearchItem(siteSearch: SiteSearch, term: string): SiteSearchItem {
  const url = buildSiteSearchUrl(siteSearch, term);
  return {
    kind: 'siteSearch',
    id: `site:${siteSearch.id}`,
    title: term,
    subtitle: siteSearch.label,
    url,
    badge: 'siteSearch',
    badges: ['siteSearch'],
    score: SITE_SEARCH_SCORE,
    action: { type: 'openUrl', url },
    siteSearchId: siteSearch.id,
    term,
  };
}

function resolveSiteSearch(input: CommandBarInput): { siteSearch?: SiteSearch; term: string } {
  if (input.activeSiteSearchId) {
    try {
      return {
        siteSearch: getSiteSearchById(input.activeSiteSearchId, input.customSiteSearches),
        term: input.query.trim(),
      };
    } catch {
      return { term: input.query.trim() };
    }
  }
  const match = matchSiteSearchPrefix(input.query, input.customSiteSearches);
  if (match) return { siteSearch: match.siteSearch, term: match.term.trim() };
  return { term: input.query.trim() };
}

/** Fuses and ranks every source for the given query. Pure; pass `now` for determinism. */
export function buildCommandBarResults(input: CommandBarInput): CommandBarResult {
  const limit = Math.max(0, input.limit ?? DEFAULT_RESULT_LIMIT);
  const now = input.now ?? Date.now();
  const engine: SearchEngine = input.searchEngine ?? 'google';
  const { siteSearch, term } = resolveSiteSearch(input);
  const candidates = collectCandidates(input);
  const historyByUrl = new Map<string, CommandBarHistoryEntry>();
  for (const entry of input.history) historyByUrl.set(entry.url, entry);

  // Chip active ------------------------------------------------------------------------------
  if (siteSearch) {
    if (!term) return { items: [], activeSiteSearch: siteSearch, term };
    const own = buildSiteSearchItem(siteSearch, term);
    const folded = foldText(term);
    const tokens = tokenize(folded);
    const related: Ranked[] = [];
    for (const c of candidates) {
      if (c.item.kind === 'quickAction' || c.item.kind === 'archived') continue;
      const host = c.item.url ? hostOf(c.item.url) : '';
      if (!siteSearch.hosts.some((h) => host === h || host.endsWith(`.${h}`))) continue;
      const rel = relevance(tokens, folded, c.fields);
      if (rel <= 0) continue;
      related.push({ seq: c.seq, item: { ...c.item, score: rel + KIND_BONUS[c.item.kind] } });
    }
    const rest = dedupeByUrl(related.sort(compareItems));
    rest.sort(compareItems);
    const items = [own, ...rest.map((r) => r.item).filter((i) => i.url !== own.url)];
    return { items: items.slice(0, limit), activeSiteSearch: siteSearch, term };
  }

  const suggestion = suggestSiteSearch(input.query, input.customSiteSearches);

  // Empty query ------------------------------------------------------------------------------
  if (!term) {
    return {
      items: defaultList(candidates, input).slice(0, limit),
      term,
      siteSearchSuggestion: suggestion,
    };
  }

  // Query ------------------------------------------------------------------------------------
  const folded = foldText(term);
  const tokens = tokenize(folded);
  const activeSpace = input.spaces.find((s) => s.id === input.activeSpaceId);
  const ranked: Ranked[] = [];

  for (const c of candidates) {
    const rel = relevance(tokens, folded, c.fields);
    if (rel <= 0) continue;
    let score = rel + KIND_BONUS[c.item.kind];
    if (c.item.kind === 'favorite' && c.item.alias && foldText(c.item.alias) === folded) {
      // Exact Favorite alias match jumps straight to #1 above tabs/history
      score += 250;
    }
    if (c.item.kind === 'history') {
      score += historyBonus(c.item.url ? historyByUrl.get(c.item.url) : undefined, now);
    }
    if (c.item.kind === 'tab' && activeSpace && c.item.spaceId === activeSpace.id) {
      score += ACTIVE_SPACE_TAB_BONUS;
    }
    ranked.push({ seq: c.seq, item: { ...c.item, score: Math.round(score * 100) / 100 } });
  }

  const destination = normalizeDestinationUrl(term);
  let seq = candidates.length;
  if (destination) {
    ranked.push({
      seq: seq++,
      item: {
        kind: 'navigate',
        id: `navigate:${destination}`,
        title: destination,
        subtitle: displayUrl(destination),
        url: destination,
        badge: 'navigate',
        badges: ['navigate'],
        score: NAVIGATE_SCORE,
        action: { type: 'openUrl', url: destination },
      },
    });
  }

  const hasTrailingSpace = /\s$/.test(input.query);
  const preferWebSearch = !destination && (hasTrailingSpace || tokens.length >= 2);
  const searchUrl = buildSearchUrl(engine, term);
  ranked.push({
    seq,
    item: {
      kind: 'webSearch',
      id: `web:${engine}`,
      title: term,
      subtitle: SEARCH_ENGINE_URLS[engine].label,
      badge: 'search',
      badges: ['search'],
      score: destination ? 1 : preferWebSearch ? WEB_SEARCH_BOOSTED_SCORE : WEB_SEARCH_SCORE,
      action: { type: 'openUrl', url: searchUrl },
      engine,
      term,
    },
  });

  const items = dedupeByUrl(ranked.sort(compareItems))
    .sort(compareItems)
    .map((r) => r.item)
    .slice(0, limit);
  return { items, term, siteSearchSuggestion: suggestion };
}
