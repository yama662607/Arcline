import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { getPreferenceValues } from '@raycast/api';

const execFileAsync = promisify(execFile);

export type BrowserKind = 'brave' | 'chrome' | 'chromium';
export type SearchEngineKind = 'google' | 'duckduckgo' | 'brave';

export interface RaycastPreferences {
  browser: BrowserKind;
  profile: string;
  searchEngine: SearchEngineKind;
}

export interface BookmarkEntry {
  id: string;
  guid?: string;
  type: 'url' | 'folder';
  name: string;
  url?: string;
  date_added?: string;
  date_modified?: string;
  date_last_used?: string;
  children?: BookmarkEntry[];
}

export interface BookmarksDocument {
  checksum?: string;
  checksum_sha256?: string;
  roots: Record<string, BookmarkEntry | undefined>;
}

export interface ArclineLinkItem {
  id: string;
  source: 'favorite' | 'pin';
  title: string;
  url: string;
  spaceName?: string;
  folderPath: string[];
  alias?: string;
  shortcut?: string;
}

export interface FavoriteShortcutConfig {
  alias?: string;
  shortcut?: string;
}

export interface ArclineSpaceSummary {
  name: string;
  pinCount: number;
  folderCount: number;
  items: ArclineLinkItem[];
}

export interface HistoryMatch {
  title: string;
  url: string;
  visitCount: number;
  lastVisitTimeMs: number;
}

export interface SiteSearchDef {
  id: string;
  prefix: string;
  label: string;
  urlTemplate: string;
}

export const SITE_SEARCHES: readonly SiteSearchDef[] = [
  { id: 'google', prefix: 'g', label: 'Google', urlTemplate: 'https://www.google.com/search?q=%s' },
  { id: 'github', prefix: 'gh', label: 'GitHub', urlTemplate: 'https://github.com/search?q=%s' },
  {
    id: 'youtube',
    prefix: 'yt',
    label: 'YouTube',
    urlTemplate: 'https://www.youtube.com/results?search_query=%s',
  },
  {
    id: 'wikipedia',
    prefix: 'wiki',
    label: 'Wikipedia',
    urlTemplate: 'https://en.wikipedia.org/w/index.php?search=%s',
  },
  { id: 'chatgpt', prefix: 'gpt', label: 'ChatGPT', urlTemplate: 'https://chatgpt.com/?q=%s' },
  {
    id: 'perplexity',
    prefix: 'pplx',
    label: 'Perplexity',
    urlTemplate: 'https://www.perplexity.ai/search?q=%s',
  },
  { id: 'claude', prefix: 'cl', label: 'Claude', urlTemplate: 'https://claude.ai/new?q=%s' },
  {
    id: 'gemini',
    prefix: 'gem',
    label: 'Gemini',
    urlTemplate: 'https://gemini.google.com/app?q=%s',
  },
  { id: 'grok', prefix: 'grok', label: 'Grok', urlTemplate: 'https://grok.com/?q=%s' },
  {
    id: 'google-ai',
    prefix: 'ai',
    label: 'Google AI',
    urlTemplate: 'https://www.google.com/search?udm=50&q=%s',
  },
  {
    id: 'mdn',
    prefix: 'mdn',
    label: 'MDN',
    urlTemplate: 'https://developer.mozilla.org/en-US/search?q=%s',
  },
  { id: 'npm', prefix: 'npm', label: 'npm', urlTemplate: 'https://www.npmjs.com/search?q=%s' },
  {
    id: 'arxiv',
    prefix: 'arx',
    label: 'arXiv',
    urlTemplate: 'https://arxiv.org/search/?query=%s&searchtype=all',
  },
  {
    id: 'scholar',
    prefix: 'sch',
    label: 'Scholar',
    urlTemplate: 'https://scholar.google.com/scholar?q=%s',
  },
  { id: 'x', prefix: 'x', label: 'X', urlTemplate: 'https://x.com/search?q=%s' },
  {
    id: 'amazon',
    prefix: 'amz',
    label: 'Amazon',
    urlTemplate: 'https://www.amazon.co.jp/s?k=%s',
  },
  {
    id: 'maps',
    prefix: 'map',
    label: 'Google Maps',
    urlTemplate: 'https://www.google.com/maps/search/%s',
  },
  {
    id: 'reddit',
    prefix: 'rd',
    label: 'Reddit',
    urlTemplate: 'https://www.reddit.com/search/?q=%s',
  },
];

export const SEARCH_ENGINE_TEMPLATES: Record<SearchEngineKind, { label: string; urlTemplate: string }> = {
  google: { label: 'Google', urlTemplate: 'https://www.google.com/search?q=%s' },
  duckduckgo: { label: 'DuckDuckGo', urlTemplate: 'https://duckduckgo.com/?q=%s' },
  brave: { label: 'Brave Search', urlTemplate: 'https://search.brave.com/search?q=%s' },
};

const DANGEROUS_SCHEME = /^\s*(javascript|data|vbscript):/i;

export function isSafeNavigableUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || DANGEROUS_SCHEME.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeUrlInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || DANGEROUS_SCHEME.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed)) return isSafeNavigableUrl(trimmed) ? trimmed : null;
  if (!/\s/.test(trimmed) && (/^localhost(?::\d+)?/i.test(trimmed) || /^[^./]+\.[^.]+/.test(trimmed))) {
    const prefix = /^localhost/i.test(trimmed) ? 'http' : 'https';
    const candidate = `${prefix}://${trimmed}`;
    return isSafeNavigableUrl(candidate) ? candidate : null;
  }
  return null;
}

export function buildWebSearchUrl(engine: SearchEngineKind, query: string): string {
  return SEARCH_ENGINE_TEMPLATES[engine].urlTemplate.replace('%s', encodeURIComponent(query));
}

export function matchSiteSearch(
  input: string,
  customSiteSearches: readonly SiteSearchDef[] = [],
): { site: SiteSearchDef; term: string } | undefined {
  const m = /^\s*(\S+)\s+(.+)$/.exec(input);
  if (!m) return undefined;
  const prefix = (m[1] ?? '').toLowerCase();
  const term = (m[2] ?? '').trim();
  const site =
    customSiteSearches.find((s) => s.prefix.toLowerCase() === prefix) ??
    SITE_SEARCHES.find((s) => s.prefix === prefix);
  return site && term ? { site, term } : undefined;
}

export function getBrowserAppName(browser: BrowserKind): string {
  if (browser === 'brave') return 'Brave Browser';
  if (browser === 'chrome') return 'Google Chrome';
  return 'Chromium';
}

export function getBrowserUserDataDir(browser: BrowserKind): string {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
    if (browser === 'brave') return path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data');
    if (browser === 'chrome') return path.join(localAppData, 'Google', 'Chrome', 'User Data');
    return path.join(localAppData, 'Chromium', 'User Data');
  }
  const appSupport = path.join(home, 'Library', 'Application Support');
  if (browser === 'brave') return path.join(appSupport, 'BraveSoftware', 'Brave-Browser');
  if (browser === 'chrome') return path.join(appSupport, 'Google', 'Chrome');
  return path.join(appSupport, 'Chromium');
}

export function getProfilePaths(prefs?: Partial<RaycastPreferences>): {
  browser: BrowserKind;
  profileDir: string;
  bookmarksPath: string;
  historyPath: string;
} {
  const resolved = { ...getPreferenceValues<RaycastPreferences>(), ...prefs };
  const browser: BrowserKind = resolved.browser ?? 'brave';
  const rawProfile = resolved.profile?.trim() || 'Default';
  if (
    rawProfile === '.' ||
    rawProfile === '..' ||
    rawProfile.includes('/') ||
    rawProfile.includes('\\') ||
    rawProfile.includes('\0')
  ) {
    throw new Error('Invalid browser profile directory name.');
  }
  const profileDir = path.join(getBrowserUserDataDir(browser), rawProfile);
  return {
    browser,
    profileDir,
    bookmarksPath: path.join(profileDir, 'Bookmarks'),
    historyPath: path.join(profileDir, 'History'),
  };
}

function collectLinks(
  nodes: BookmarkEntry[] | undefined,
  source: 'favorite' | 'pin',
  spaceName: string | undefined,
  parents: string[],
  out: ArclineLinkItem[],
): { pinCount: number; folderCount: number } {
  let pinCount = 0;
  let folderCount = 0;
  for (const node of nodes ?? []) {
    if (node.type === 'url' && node.url && isSafeNavigableUrl(node.url)) {
      pinCount += 1;
      out.push({
        id: node.id,
        source,
        title: node.name || node.url,
        url: node.url,
        spaceName,
        folderPath: parents,
      });
    } else if (node.type === 'folder') {
      folderCount += 1;
      const nested = collectLinks(
        node.children,
        source,
        spaceName,
        [...parents, node.name || 'Folder'],
        out,
      );
      pinCount += nested.pinCount;
      folderCount += nested.folderCount;
    }
  }
  return { pinCount, folderCount };
}

const SHORTCUT_CONFIG_BOOKMARK_TITLE = '__arcline_shortcuts_v1__';
const SHORTCUT_CONFIG_URL_PREFIX = 'https://arcline.local/config#';

function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    const host = u.host.toLowerCase().replace(/^www\./, '');
    const p = u.pathname.replace(/\/+$/, '');
    return `${host}${p}${u.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

function readSyncedShortcuts(arclineRoot: BookmarkEntry): {
  customSiteSearches: SiteSearchDef[];
  favoriteShortcuts: Record<string, FavoriteShortcutConfig>;
} {
  const node = (arclineRoot.children ?? []).find(
    (c) =>
      c.type === 'url' &&
      c.name === SHORTCUT_CONFIG_BOOKMARK_TITLE &&
      typeof c.url === 'string' &&
      c.url.startsWith(SHORTCUT_CONFIG_URL_PREFIX),
  );
  if (!node?.url) return { customSiteSearches: [], favoriteShortcuts: {} };
  try {
    const raw = decodeURIComponent(node.url.slice(SHORTCUT_CONFIG_URL_PREFIX.length));
    const parsed = JSON.parse(raw) as {
      customSiteSearches?: unknown;
      favoriteShortcuts?: unknown;
    };
    const customSiteSearches: SiteSearchDef[] = Array.isArray(parsed.customSiteSearches)
      ? parsed.customSiteSearches.filter(
          (item): item is SiteSearchDef =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof (item as SiteSearchDef).prefix === 'string' &&
            typeof (item as SiteSearchDef).label === 'string' &&
            typeof (item as SiteSearchDef).urlTemplate === 'string' &&
            isSafeNavigableUrl((item as SiteSearchDef).urlTemplate.replace('%s', 'test')),
        )
      : [];
    const favoriteShortcuts: Record<string, FavoriteShortcutConfig> =
      parsed.favoriteShortcuts && typeof parsed.favoriteShortcuts === 'object'
        ? (parsed.favoriteShortcuts as Record<string, FavoriteShortcutConfig>)
        : {};
    return { customSiteSearches, favoriteShortcuts };
  } catch {
    return { customSiteSearches: [], favoriteShortcuts: {} };
  }
}

export function loadArclineWorkspace(prefs?: Partial<RaycastPreferences>): {
  favorites: ArclineLinkItem[];
  spaces: ArclineSpaceSummary[];
  customSiteSearches: SiteSearchDef[];
  bookmarksFound: boolean;
} {
  const { bookmarksPath } = getProfilePaths(prefs);
  if (!fs.existsSync(bookmarksPath)) {
    return { favorites: [], spaces: [], customSiteSearches: [], bookmarksFound: false };
  }
  const doc = JSON.parse(fs.readFileSync(bookmarksPath, 'utf8')) as BookmarksDocument;
  const arclineRoot = doc.roots?.other?.children?.find(
    (n) => n.type === 'folder' && n.name === 'Arcline',
  );
  if (!arclineRoot) {
    return { favorites: [], spaces: [], customSiteSearches: [], bookmarksFound: true };
  }

  const { customSiteSearches, favoriteShortcuts } = readSyncedShortcuts(arclineRoot);
  const shortcutIndex = new Map<string, FavoriteShortcutConfig>();
  for (const [url, meta] of Object.entries(favoriteShortcuts)) {
    shortcutIndex.set(url, meta);
    shortcutIndex.set(normalizeUrlKey(url), meta);
  }

  const favorites: ArclineLinkItem[] = [];
  const spaces: ArclineSpaceSummary[] = [];

  for (const child of arclineRoot.children ?? []) {
    if (child.type !== 'folder') continue;
    if (child.name === 'Favorites') {
      collectLinks(child.children, 'favorite', undefined, [], favorites);
    } else {
      const items: ArclineLinkItem[] = [];
      const counts = collectLinks(child.children, 'pin', child.name, [], items);
      spaces.push({
        name: child.name,
        pinCount: counts.pinCount,
        folderCount: counts.folderCount,
        items,
      });
    }
  }

  for (const fav of favorites) {
    const meta = shortcutIndex.get(fav.url) ?? shortcutIndex.get(normalizeUrlKey(fav.url));
    if (meta?.alias) fav.alias = meta.alias;
    if (meta?.shortcut) fav.shortcut = meta.shortcut;
  }

  return { favorites, spaces, customSiteSearches, bookmarksFound: true };
}

/**
 * Safely searches browser History by copying the SQLite DB (+ WAL/SHM) to a temporary
 * directory first so a running Brave/Chrome process is never locked or corrupted.
 */
export async function searchBrowserHistory(
  query: string,
  limit = 25,
  prefs?: Partial<RaycastPreferences>,
): Promise<HistoryMatch[]> {
  const { historyPath } = getProfilePaths(prefs);
  if (!fs.existsSync(historyPath)) return [];

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arcline-raycast-hist-'));
  try {
    const tmpDb = path.join(tmpDir, 'History');
    fs.copyFileSync(historyPath, tmpDb);
    for (const suffix of ['-wal', '-shm']) {
      if (fs.existsSync(`${historyPath}${suffix}`)) {
        fs.copyFileSync(`${historyPath}${suffix}`, `${tmpDb}${suffix}`);
      }
    }

    const escapedQuery = query
      .trim()
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
    const qHex = Buffer.from(escapedQuery, 'utf8').toString('hex');
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const whereClause = escapedQuery
      ? `WHERE (lower(title) LIKE '%' || lower(CAST(X'${qHex}' AS TEXT)) || '%' ESCAPE '\\' OR lower(url) LIKE '%' || lower(CAST(X'${qHex}' AS TEXT)) || '%' ESCAPE '\\')`
      : '';
    const sql = `
      PRAGMA query_only=ON;
      PRAGMA trusted_schema=OFF;
      SELECT url, COALESCE(title, url) AS title, visit_count AS visitCount,
             CAST((last_visit_time / 1000) - 11644473600000 AS INTEGER) AS lastVisitTimeMs
      FROM urls
      ${whereClause}
      ORDER BY last_visit_time DESC
      LIMIT ${safeLimit};
    `;

    const sqliteBin = fs.existsSync('/usr/bin/sqlite3') ? '/usr/bin/sqlite3' : 'sqlite3';
    const { stdout } = await execFileAsync(sqliteBin, ['-readonly', '-json', tmpDb, sql], {
      timeout: 3000,
      maxBuffer: 2 * 1024 * 1024,
    });
    if (!stdout.trim()) return [];
    const rows = JSON.parse(stdout) as HistoryMatch[];
    return rows.filter((r) => isSafeNavigableUrl(r.url));
  } catch {
    return [];
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function macAppName(browser: BrowserKind): string {
  if (browser === 'brave') return 'Brave Browser';
  if (browser === 'chrome') return 'Google Chrome';
  return 'Chromium';
}

function findWindowsBrowserExe(browser: BrowserKind): string | undefined {
  const roots = [
    process.env.LOCALAPPDATA,
    process.env.PROGRAMFILES,
    process.env['PROGRAMFILES(X86)'],
  ].filter((v): v is string => Boolean(v));
  const rel =
    browser === 'brave'
      ? path.join('BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')
      : browser === 'chrome'
        ? path.join('Google', 'Chrome', 'Application', 'chrome.exe')
        : path.join('Chromium', 'Application', 'chrome.exe');
  for (const root of roots) {
    const candidate = path.join(root, rel);
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

export async function openUrlInBrowser(url: string, browser: BrowserKind): Promise<void> {
  if (!isSafeNavigableUrl(url)) {
    throw new Error('Blocked unsafe URL scheme.');
  }
  if (process.platform === 'darwin') {
    await execFileAsync('open', ['-a', macAppName(browser), url]);
    return;
  }
  if (process.platform === 'win32') {
    const exePath = findWindowsBrowserExe(browser);
    if (exePath) {
      await execFileAsync(exePath, [url], { windowsHide: true });
      return;
    }
    // Never pass URLs through `cmd /c` (shell metacharacters like `&` / `|` would execute commands).
    await execFileAsync('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
      windowsHide: true,
    });
    return;
  }
  await execFileAsync('xdg-open', [url]);
}

export async function openNewTabInBrowser(browser: BrowserKind): Promise<void> {
  if (process.platform === 'darwin') {
    const app = macAppName(browser);
    // Activate browser and trigger File -> New Tab (or open a fresh window if none open) via System Events / Chrome URL
    const appleScript = `
      tell application "${app}"
        activate
        if (count of windows) = 0 then
          make new window
        else
          tell front window to make new tab with properties {URL:"chrome://newtab"}
        end if
      end tell
    `;
    await execFileAsync('osascript', ['-e', appleScript]);
    return;
  }
  await openUrlInBrowser('https://www.google.com/', browser);
}

function computeBookmarkChecksum(doc: BookmarksDocument, algorithm: 'md5' | 'sha256'): string {
  const hash = createHash(algorithm);
  const walk = (node: BookmarkEntry) => {
    hash.update(String(node.id));
    hash.update(node.name ?? '', 'utf16le');
    hash.update(node.type);
    if (node.type === 'url') {
      hash.update(node.url ?? '');
    } else {
      for (const c of node.children ?? []) walk(c);
    }
  };
  for (const key of ['bookmark_bar', 'other', 'synced']) {
    const root = doc.roots[key];
    if (root) walk(root);
  }
  return hash.digest('hex');
}

export function addPinToSpaceBookmarks(
  options: { spaceName: string; url: string; title?: string; folderPath?: string },
  prefs?: Partial<RaycastPreferences>,
): void {
  const cleanUrl = normalizeUrlInput(options.url);
  if (!cleanUrl) throw new Error('Please enter a valid http:// or https:// URL.');

  const { bookmarksPath } = getProfilePaths(prefs);
  if (!fs.existsSync(bookmarksPath)) {
    throw new Error(`Bookmarks file not found at ${bookmarksPath}`);
  }

  const realFile = fs.realpathSync(bookmarksPath);
  const raw = fs.readFileSync(realFile, 'utf8');
  const doc = JSON.parse(raw) as BookmarksDocument;

  const root = doc.roots?.other?.children?.find(
    (n) => n.type === 'folder' && n.name === 'Arcline',
  );
  if (!root) throw new Error('Other Bookmarks / Arcline folder was not found.');

  const spaceFolder = root.children?.find(
    (n) => n.type === 'folder' && n.name === options.spaceName && n.name !== 'Favorites',
  );
  if (!spaceFolder) throw new Error(`Space "${options.spaceName}" was not found.`);

  let maxId = 0n;
  const scan = (node: BookmarkEntry) => {
    if (/^\d+$/.test(String(node.id))) {
      const n = BigInt(node.id);
      if (n > maxId) maxId = n;
    }
    for (const c of node.children ?? []) scan(c);
  };
  for (const rootNode of Object.values(doc.roots)) {
    if (rootNode) scan(rootNode);
  }

  const nowWebkit = (BigInt(Date.now()) * 1000n + 11644473600000000n).toString();
  let targetParent = spaceFolder;
  if (options.folderPath?.trim()) {
    const parts = options.folderPath
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      let sub = (targetParent.children ?? []).find((c) => c.type === 'folder' && c.name === part);
      if (!sub) {
        sub = {
          id: String(++maxId),
          guid: randomUUID(),
          type: 'folder',
          name: part,
          date_added: nowWebkit,
          date_modified: nowWebkit,
          date_last_used: '0',
          children: [],
        };
        (targetParent.children ??= []).push(sub);
      }
      targetParent = sub;
    }
  }

  (targetParent.children ??= []).push({
    id: String(++maxId),
    guid: randomUUID(),
    type: 'url',
    name: options.title?.trim() || cleanUrl,
    url: cleanUrl,
    date_added: nowWebkit,
    date_last_used: '0',
  });

  doc.checksum = computeBookmarkChecksum(doc, 'md5');
  if ('checksum_sha256' in doc) {
    doc.checksum_sha256 = computeBookmarkChecksum(doc, 'sha256');
  }

  const tmpFile = `${realFile}.arcline-${randomUUID()}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(doc, null, 3), 'utf8');
  fs.renameSync(tmpFile, realFile);
}
