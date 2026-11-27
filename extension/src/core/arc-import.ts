import { rgbToHue } from './colors';
import { isSafeNavigableUrl } from './snapshot';
import { parseArcWindowTheme } from './space-theme';
import type { ImportedLink, ImportedNode, ImportedSidebar, ImportedSpace } from './types';

interface ArcItem {
  id: string;
  parentID?: string | null;
  title?: string | null;
  childrenIds?: string[];
  data?: {
    tab?: { savedURL?: string; savedTitle?: string };
    list?: unknown;
    itemContainer?: unknown;
  };
}

interface ArcSpace {
  id: string;
  title?: string;
  containerIDs?: unknown[];
  customInfo?: {
    iconType?: {
      icon?: string;
      emoji_v2?: string;
      emoji?: string;
    };
    windowTheme?: {
      primaryColorPalette?: {
        midTone?: { red?: number; green?: number; blue?: number };
      };
    };
  };
}

interface ArcContainer {
  spaces?: unknown[];
  items?: unknown[];
  topAppsContainerIDs?: unknown[];
}

export interface ArcImportOptions {
  skipEmptyFolders?: boolean;
  skipGoogleSearches?: boolean;
  dedupeWithinSpace?: boolean;
  skipBrokenLocalFiles?: boolean;
}

export class ArcImportError extends Error {}

function objects<T>(list: unknown[] | undefined): T[] {
  return (list ?? []).filter((entry): entry is T => typeof entry === 'object' && entry !== null);
}

function isGoogleSearchUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === 'www.google.com' || parsed.hostname === 'www.google.co.jp') &&
      parsed.pathname === '/search'
    );
  } catch {
    return false;
  }
}

function isBrokenMobileLocalUrl(url: string): boolean {
  return url.startsWith('file:///private/var/mobile/');
}

function isExecutablePseudoUrl(url: string): boolean {
  return !isSafeNavigableUrl(url);
}

function pickBestPinTitle(
  itemTitle: string | null | undefined,
  savedTitle: string | undefined,
  url: string,
): string {
  const custom = itemTitle?.trim() || '';
  const saved = savedTitle?.trim() || '';
  const customIsUrl = /^https?:\/\//i.test(custom);
  const savedIsUrl = /^https?:\/\//i.test(saved);
  if (custom && (!customIsUrl || !saved || savedIsUrl)) return custom;
  if (saved) return saved;
  return url;
}

/**
 * Pure parser for Arc's `StorableSidebar.json`.
 * Extracts Top Apps as global Favorites and each Space's pinned tabs & nested folders.
 */
export function parseArcSidebar(json: unknown, options: ArcImportOptions = {}): ImportedSidebar {
  const opts = {
    skipEmptyFolders: options.skipEmptyFolders ?? true,
    skipGoogleSearches: options.skipGoogleSearches ?? true,
    dedupeWithinSpace: options.dedupeWithinSpace ?? true,
    skipBrokenLocalFiles: options.skipBrokenLocalFiles ?? true,
  };

  const containers = (json as { sidebar?: { containers?: unknown[] } })?.sidebar?.containers;
  const container = objects<ArcContainer>(containers).find(
    (c) => Array.isArray(c.spaces) && Array.isArray(c.items),
  );
  if (!container) {
    throw new ArcImportError('Arc の StorableSidebar.json 形式ではありません。');
  }

  const itemList = objects<ArcItem>(container.items);
  const items = new Map(itemList.map((item) => [item.id, item]));

  const stats = {
    totalPins: 0,
    totalFolders: 0,
    skippedEmptyFolders: 0,
    skippedSearches: 0,
    deduped: 0,
    skippedBroken: 0,
  };

  const buildNodes = (
    ids: string[] | undefined,
    visitedIds: Set<string>,
    seenUrls: Set<string>,
  ): ImportedNode[] => {
    const result: ImportedNode[] = [];
    for (const id of ids ?? []) {
      const item = items.get(id);
      if (!item || visitedIds.has(id)) continue;
      visitedIds.add(id);

      const tab = item.data?.tab;
      if (tab?.savedURL) {
        const url = tab.savedURL.trim();
        if (!url) continue;
        if (isExecutablePseudoUrl(url)) {
          stats.skippedBroken += 1;
          continue;
        }
        if (opts.skipBrokenLocalFiles && isBrokenMobileLocalUrl(url)) {
          stats.skippedBroken += 1;
          continue;
        }
        if (opts.skipGoogleSearches && isGoogleSearchUrl(url)) {
          stats.skippedSearches += 1;
          continue;
        }
        if (opts.dedupeWithinSpace && seenUrls.has(url)) {
          stats.deduped += 1;
          continue;
        }
        seenUrls.add(url);
        stats.totalPins += 1;
        result.push({
          kind: 'pin',
          title: pickBestPinTitle(item.title, tab.savedTitle, url),
          url,
        });
        continue;
      }

      if (item.data && ('list' in item.data || 'itemContainer' in item.data)) {
        const children = buildNodes(item.childrenIds, visitedIds, seenUrls);
        if (opts.skipEmptyFolders && children.length === 0) {
          stats.skippedEmptyFolders += 1;
          continue;
        }
        const folderTitle = item.title?.trim();
        if (!folderTitle) {
          // Flatten unnamed wrapper containers
          result.push(...children);
        } else {
          stats.totalFolders += 1;
          result.push({ kind: 'folder', title: folderTitle, children });
        }
      }
    }
    return result;
  };

  const spaces: ImportedSpace[] = objects<ArcSpace>(container.spaces).map((space) => {
    const cids = space.containerIDs ?? [];
    const pinnedIdx = cids.indexOf('pinned');
    const pinnedId = pinnedIdx >= 0 ? cids[pinnedIdx + 1] : undefined;
    const pinnedContainer = typeof pinnedId === 'string' ? items.get(pinnedId) : undefined;
    const tone = space.customInfo?.windowTheme?.primaryColorPalette?.midTone;
    const hue = tone ? rgbToHue(tone.red ?? 0, tone.green ?? 0, tone.blue ?? 0) : undefined;
    const iconInfo = space.customInfo?.iconType;
    const icon = iconInfo?.emoji_v2 || iconInfo?.emoji || iconInfo?.icon || undefined;
    const theme = parseArcWindowTheme(space.customInfo?.windowTheme);
    return {
      name: space.title?.trim() || 'Space',
      hue,
      icon,
      theme,
      pinned: buildNodes(pinnedContainer?.childrenIds, new Set(), new Set()),
    };
  });

  // TopApps (global Favorites): may be linked via childrenIds on topAppsId OR parentID === topAppsId
  const topAppsId = (container.topAppsContainerIDs ?? []).find(
    (entry): entry is string => typeof entry === 'string',
  );
  const favorites: ImportedLink[] = [];
  const seenFavUrls = new Set<string>();
  if (topAppsId) {
    const topNode = items.get(topAppsId);
    const candidateItems: ArcItem[] = topNode?.childrenIds?.length
      ? topNode.childrenIds.map((id) => items.get(id)).filter((x): x is ArcItem => x !== undefined)
      : itemList.filter((it) => it.parentID === topAppsId);
    for (const item of candidateItems) {
      const tab = item.data?.tab;
      const url = tab?.savedURL?.trim();
      if (!url || isExecutablePseudoUrl(url) || seenFavUrls.has(url)) continue;
      seenFavUrls.add(url);
      favorites.push({
        title: pickBestPinTitle(item.title, tab?.savedTitle, url),
        url,
      });
    }
  }

  return { favorites, spaces, stats };
}

export function countImportedNodes(nodes: ReadonlyArray<ImportedNode>): {
  pins: number;
  folders: number;
} {
  let pins = 0;
  let folders = 0;
  for (const node of nodes) {
    if (node.kind === 'pin') {
      pins++;
    } else {
      folders++;
      const child = countImportedNodes(node.children);
      pins += child.pins;
      folders += child.folders;
    }
  }
  return { pins, folders };
}

/**
 * Filter a parsed Arc sidebar down to user-selected Space indices and Favorites preference,
 * recalculating pin/folder totals while preserving original cleanup counters.
 */
export function filterImportedSidebar(
  parsed: ImportedSidebar,
  selectedSpaceIndices: ReadonlySet<number>,
  includeFavorites: boolean,
): ImportedSidebar {
  const spaces = parsed.spaces.filter((_, idx) => selectedSpaceIndices.has(idx));
  let totalPins = 0;
  let totalFolders = 0;
  for (const space of spaces) {
    const counts = countImportedNodes(space.pinned);
    totalPins += counts.pins;
    totalFolders += counts.folders;
  }
  return {
    favorites: includeFavorites ? parsed.favorites : [],
    spaces,
    stats: {
      ...parsed.stats,
      totalPins,
      totalFolders,
    },
  };
}

/** Synthetic StorableSidebar.json payload for interactive preview demos (no personal data). */
export function createSampleArcSidebarJson(): Record<string, unknown> {
  return {
    sidebar: {
      containers: [
        {
          topAppsContainerIDs: ['top-apps'],
          spaces: [
            {
              id: 'sp-eng',
              title: 'Engineering',
              containerIDs: ['pinned', 'sp-eng-pinned'],
              customInfo: {
                iconType: { icon: 'code' },
                windowTheme: {
                  primaryColorPalette: {
                    midTone: { red: 0.25, green: 0.45, blue: 0.92 },
                  },
                },
              },
            },
            {
              id: 'sp-design',
              title: 'Design Studio',
              containerIDs: ['pinned', 'sp-design-pinned'],
              customInfo: {
                iconType: { icon: 'sparkles' },
                windowTheme: {
                  primaryColorPalette: {
                    midTone: { red: 0.72, green: 0.38, blue: 0.86 },
                  },
                },
              },
            },
            {
              id: 'sp-read',
              title: 'Reading & Notes',
              containerIDs: ['pinned', 'sp-read-pinned'],
              customInfo: {
                iconType: { icon: 'book' },
                windowTheme: {
                  primaryColorPalette: {
                    midTone: { red: 0.22, green: 0.68, blue: 0.52 },
                  },
                },
              },
            },
          ],
          items: [
            {
              id: 'top-apps',
              childrenIds: ['fav-gh', 'fav-linear', 'fav-figma', 'fav-notion'],
            },
            {
              id: 'fav-gh',
              title: 'GitHub',
              data: { tab: { savedURL: 'https://github.com', savedTitle: 'GitHub' } },
            },
            {
              id: 'fav-linear',
              title: 'Linear',
              data: { tab: { savedURL: 'https://linear.app', savedTitle: 'Linear' } },
            },
            {
              id: 'fav-figma',
              title: 'Figma',
              data: { tab: { savedURL: 'https://www.figma.com', savedTitle: 'Figma' } },
            },
            {
              id: 'fav-notion',
              title: 'Notion',
              data: { tab: { savedURL: 'https://www.notion.so', savedTitle: 'Notion' } },
            },
            {
              id: 'sp-eng-pinned',
              childrenIds: ['f-docs', 'p-vite', 'p-search', 'f-empty'],
            },
            {
              id: 'f-docs',
              title: 'Core Docs',
              childrenIds: ['p-ts', 'p-mdn', 'p-ts-dup'],
              data: { list: {} },
            },
            {
              id: 'p-ts',
              title: 'TypeScript Handbook',
              data: {
                tab: {
                  savedURL: 'https://www.typescriptlang.org/docs/',
                  savedTitle: 'TypeScript Handbook',
                },
              },
            },
            {
              id: 'p-ts-dup',
              title: 'TypeScript Handbook',
              data: {
                tab: {
                  savedURL: 'https://www.typescriptlang.org/docs/',
                  savedTitle: 'TypeScript Handbook',
                },
              },
            },
            {
              id: 'p-mdn',
              title: 'MDN Web Docs',
              data: {
                tab: { savedURL: 'https://developer.mozilla.org/', savedTitle: 'MDN Web Docs' },
              },
            },
            {
              id: 'p-vite',
              title: 'Vite Guide',
              data: { tab: { savedURL: 'https://vite.dev/guide/', savedTitle: 'Vite Guide' } },
            },
            {
              id: 'p-search',
              title: 'chrome mv3 sidebar - Google Search',
              data: {
                tab: {
                  savedURL: 'https://www.google.com/search?q=chrome+mv3+sidebar',
                  savedTitle: 'chrome mv3 sidebar - Google Search',
                },
              },
            },
            {
              id: 'f-empty',
              title: 'Old Empty Folder',
              childrenIds: [],
              data: { list: {} },
            },
            {
              id: 'sp-design-pinned',
              childrenIds: ['f-tokens', 'p-oklch'],
            },
            {
              id: 'f-tokens',
              title: 'UI Systems',
              childrenIds: ['p-tailwind', 'p-lucide'],
              data: { list: {} },
            },
            {
              id: 'p-tailwind',
              title: 'Tailwind CSS',
              data: { tab: { savedURL: 'https://tailwindcss.com/', savedTitle: 'Tailwind CSS' } },
            },
            {
              id: 'p-lucide',
              title: 'Lucide Icons',
              data: { tab: { savedURL: 'https://lucide.dev/', savedTitle: 'Lucide Icons' } },
            },
            {
              id: 'p-oklch',
              title: 'OKLCH Color Picker',
              data: { tab: { savedURL: 'https://oklch.com/', savedTitle: 'OKLCH Color Picker' } },
            },
            {
              id: 'sp-read-pinned',
              childrenIds: ['p-webdev', 'p-hn'],
            },
            {
              id: 'p-webdev',
              title: 'web.dev',
              data: { tab: { savedURL: 'https://web.dev/', savedTitle: 'web.dev' } },
            },
            {
              id: 'p-hn',
              title: 'Hacker News',
              data: {
                tab: { savedURL: 'https://news.ycombinator.com/', savedTitle: 'Hacker News' },
              },
            },
          ],
        },
      ],
    },
  };
}
