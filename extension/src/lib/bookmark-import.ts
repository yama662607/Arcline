/**
 * Bookmark Import Module
 * Supports:
 * - Netscape Bookmark HTML format (Chrome, Firefox, Safari, Edge)
 * - Arc Browser StorableSidebar.json format
 */

export interface ImportedBookmark {
  title: string;
  url: string;
  children?: ImportedBookmark[];
  isFolder?: boolean;
}

export interface ImportResult {
  success: boolean;
  bookmarks: ImportedBookmark[];
  source: 'html' | 'arc-json' | 'unknown';
  error?: string;
  stats: {
    totalItems: number;
    folders: number;
    bookmarks: number;
  };
}

/**
 * Detect the format of the imported content
 */
export function detectImportFormat(content: string): 'html' | 'arc-json' | 'unknown' {
  const trimmed = content.trim();

  // Check for Arc Browser JSON format
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      // Arc format typically has 'sidebar' or 'containers' or 'items' keys
      if (
        parsed.sidebar ||
        parsed.containers ||
        parsed.items ||
        (Array.isArray(parsed) && parsed.some((item: unknown) => hasArcItemStructure(item)))
      ) {
        return 'arc-json';
      }
    } catch {
      // Not valid JSON
    }
  }

  // Check for Netscape Bookmark HTML format
  if (
    trimmed.includes('<!DOCTYPE NETSCAPE-Bookmark-file-1>') ||
    trimmed.includes('<DL>') ||
    trimmed.includes('<DT><A HREF=')
  ) {
    return 'html';
  }

  return 'unknown';
}

function hasArcItemStructure(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return 'title' in obj || 'data' in obj || 'childrenIds' in obj || 'url' in obj;
}

/**
 * Try to parse a line as a folder header
 */
function tryParseFolder(line: string): ImportedBookmark | null {
  const match = line.match(/<DT><H3[^>]*>([^<]+)<\/H3>/i);
  if (!match?.[1]) return null;
  return {
    title: decodeHtmlEntities(match[1]),
    url: '',
    isFolder: true,
    children: [],
  };
}

/**
 * Try to parse a line as a bookmark
 */
function tryParseBookmark(line: string): ImportedBookmark | null {
  const match = line.match(/<DT><A[^>]+HREF="([^"]+)"[^>]*>([^<]*)<\/A>/i);
  if (!match?.[1] || match[2] === undefined) return null;
  return {
    title: decodeHtmlEntities(match[2]),
    url: match[1],
  };
}

/**
 * Process a single line in the HTML parser
 */
function processHtmlLine(line: string, stack: ImportedBookmark[][]): void {
  const trimmed = line.trim();

  // Try folder
  const folder = tryParseFolder(trimmed);
  if (folder) {
    stack[stack.length - 1]?.push(folder);
    return;
  }

  // DL start - push children array
  if (/<DL>/i.test(trimmed)) {
    const current = stack[stack.length - 1];
    const lastItem = current?.[current.length - 1];
    if (lastItem?.isFolder && lastItem.children) {
      stack.push(lastItem.children);
    }
    return;
  }

  // DL end - pop stack
  if (/<\/DL>/i.test(trimmed)) {
    if (stack.length > 1) stack.pop();
    return;
  }

  // Try bookmark
  const bookmark = tryParseBookmark(trimmed);
  if (bookmark) {
    stack[stack.length - 1]?.push(bookmark);
  }
}

/**
 * Parse Netscape Bookmark HTML format
 */
export function parseNetscapeHtml(htmlContent: string): ImportedBookmark[] {
  const bookmarks: ImportedBookmark[] = [];
  const stack: ImportedBookmark[][] = [bookmarks];
  const lines = htmlContent.split('\n');

  for (const line of lines) {
    processHtmlLine(line, stack);
  }

  return bookmarks;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

/**
 * Arc Browser StorableSidebar.json structure
 */
interface ArcSidebarData {
  sidebar?: {
    containers?: ArcContainer[];
  };
  containers?: ArcContainer[];
  items?: ArcItem[];
  sidebarSyncState?: {
    items?: Record<string, ArcItem>;
  };
}

interface ArcContainer {
  id?: string;
  title?: string;
  items?: ArcItem[];
  spaces?: ArcSpace[];
}

interface ArcSpace {
  id?: string;
  title?: string;
  containerIDs?: string[];
  customInfo?: {
    iconType?: string;
  };
}

interface ArcItem {
  id?: string;
  title?: string;
  data?: {
    tab?: {
      savedTitle?: string;
      savedURL?: string;
    };
    list?: {
      title?: string;
      items?: ArcItem[];
    };
  };
  childrenIds?: string[];
  parentID?: string;
  url?: string;
}

/**
 * Parse Arc Browser StorableSidebar.json format
 */
export function parseArcJson(jsonContent: string): ImportedBookmark[] {
  const bookmarks: ImportedBookmark[] = [];

  try {
    const data = JSON.parse(jsonContent) as ArcSidebarData;

    // Try different Arc JSON structures
    // Structure 1: sidebar.containers
    if (data.sidebar?.containers) {
      for (const container of data.sidebar.containers) {
        const folder = parseArcContainer(container, data);
        if (folder.children && folder.children.length > 0) {
          bookmarks.push(folder);
        }
      }
    }

    // Structure 2: containers directly
    if (data.containers) {
      for (const container of data.containers) {
        const folder = parseArcContainer(container, data);
        if (folder.children && folder.children.length > 0) {
          bookmarks.push(folder);
        }
      }
    }

    // Structure 3: items directly (flat list)
    if (data.items) {
      const items = parseArcItems(data.items, data);
      bookmarks.push(...items);
    }

    // Structure 4: sidebarSyncState.items (newer Arc format)
    if (data.sidebarSyncState?.items) {
      const itemsMap = data.sidebarSyncState.items;
      const rootItems = Object.values(itemsMap).filter((item) => !item.parentID);
      const items = parseArcItemsWithMap(rootItems, itemsMap);
      bookmarks.push(...items);
    }
  } catch (error) {
    console.error('[Arcline] Failed to parse Arc JSON:', error);
  }

  return bookmarks;
}

function parseArcContainer(container: ArcContainer, data: ArcSidebarData): ImportedBookmark {
  const folder: ImportedBookmark = {
    title: container.title || 'Untitled Space',
    url: '',
    isFolder: true,
    children: [],
  };

  if (container.items) {
    folder.children = parseArcItems(container.items, data);
  }

  return folder;
}

function parseArcItems(items: ArcItem[], _data: ArcSidebarData): ImportedBookmark[] {
  const bookmarks: ImportedBookmark[] = [];

  for (const item of items) {
    const bookmark = parseArcItem(item);
    if (bookmark) {
      bookmarks.push(bookmark);
    }
  }

  return bookmarks;
}

function parseArcItemsWithMap(
  items: ArcItem[],
  itemsMap: Record<string, ArcItem>
): ImportedBookmark[] {
  const bookmarks: ImportedBookmark[] = [];

  for (const item of items) {
    const bookmark = parseArcItemWithChildren(item, itemsMap);
    if (bookmark) {
      bookmarks.push(bookmark);
    }
  }

  return bookmarks;
}

/**
 * Try to parse an Arc item as a list/folder
 */
function tryParseArcList(item: ArcItem): ImportedBookmark | null {
  if (!item.data?.list) return null;

  const list = item.data.list;
  const folder: ImportedBookmark = {
    title: list.title || item.title || 'Untitled Folder',
    url: '',
    isFolder: true,
    children: [],
  };

  if (list.items) {
    for (const child of list.items) {
      const childBookmark = parseArcItem(child);
      if (childBookmark) {
        folder.children?.push(childBookmark);
      }
    }
  }

  return folder;
}

function parseArcItem(item: ArcItem): ImportedBookmark | null {
  return tryParseArcTabSimple(item) ?? tryParseArcUrlSimple(item) ?? tryParseArcList(item);
}

/**
 * Simple tab parser (without itemsMap)
 */
function tryParseArcTabSimple(item: ArcItem): ImportedBookmark | null {
  const savedURL = item.data?.tab?.savedURL;
  if (!savedURL) return null;
  const tab = item.data?.tab;
  return {
    title: tab?.savedTitle || item.title || 'Untitled',
    url: cleanArcUrl(savedURL),
  };
}

/**
 * Simple URL parser (without itemsMap)
 */
function tryParseArcUrlSimple(item: ArcItem): ImportedBookmark | null {
  if (!item.url) return null;
  return {
    title: item.title || 'Untitled',
    url: cleanArcUrl(item.url),
  };
}

/**
 * Try to parse an Arc item as a tab bookmark
 */
function tryParseArcTab(item: ArcItem): ImportedBookmark | null {
  if (!item.data?.tab) return null;
  const tab = item.data.tab;
  if (!tab.savedURL) return null;
  return {
    title: tab.savedTitle || item.title || 'Untitled',
    url: cleanArcUrl(tab.savedURL),
  };
}

/**
 * Try to parse an Arc item as a direct URL bookmark
 */
function tryParseArcUrl(item: ArcItem): ImportedBookmark | null {
  if (!item.url) return null;
  return {
    title: item.title || 'Untitled',
    url: cleanArcUrl(item.url),
  };
}

/**
 * Try to parse an Arc item as a folder with children
 */
function tryParseArcFolder(
  item: ArcItem,
  itemsMap: Record<string, ArcItem>
): ImportedBookmark | null {
  if (!item.childrenIds || item.childrenIds.length === 0) return null;

  const folder: ImportedBookmark = {
    title: item.title || item.data?.list?.title || 'Untitled Folder',
    url: '',
    isFolder: true,
    children: [],
  };

  for (const childId of item.childrenIds) {
    const childItem = itemsMap[childId];
    if (!childItem) continue;
    const childBookmark = parseArcItemWithChildren(childItem, itemsMap);
    if (childBookmark) {
      folder.children?.push(childBookmark);
    }
  }

  return folder;
}

function parseArcItemWithChildren(
  item: ArcItem,
  itemsMap: Record<string, ArcItem>
): ImportedBookmark | null {
  return tryParseArcTab(item) ?? tryParseArcUrl(item) ?? tryParseArcFolder(item, itemsMap);
}

/**
 * Clean Arc URL (handle escaped characters)
 */
function cleanArcUrl(url: string): string {
  try {
    // Arc sometimes double-escapes URLs
    let cleaned = url;
    while (cleaned.includes('%25')) {
      cleaned = decodeURIComponent(cleaned);
    }
    return cleaned;
  } catch {
    return url;
  }
}

/**
 * Count items in bookmark tree
 */
function countItems(bookmarks: ImportedBookmark[]): { folders: number; bookmarks: number } {
  let folders = 0;
  let bookmarkCount = 0;

  for (const item of bookmarks) {
    if (item.isFolder) {
      folders++;
      if (item.children) {
        const childCounts = countItems(item.children);
        folders += childCounts.folders;
        bookmarkCount += childCounts.bookmarks;
      }
    } else {
      bookmarkCount++;
    }
  }

  return { folders, bookmarks: bookmarkCount };
}

/**
 * Main import function
 */
export function importBookmarks(content: string): ImportResult {
  const format = detectImportFormat(content);

  if (format === 'unknown') {
    return {
      success: false,
      bookmarks: [],
      source: 'unknown',
      error: 'Unknown bookmark format. Supported formats: Netscape HTML, Arc Browser JSON',
      stats: { totalItems: 0, folders: 0, bookmarks: 0 },
    };
  }

  let bookmarks: ImportedBookmark[] = [];

  try {
    if (format === 'html') {
      bookmarks = parseNetscapeHtml(content);
    } else if (format === 'arc-json') {
      bookmarks = parseArcJson(content);
    }

    const counts = countItems(bookmarks);

    return {
      success: true,
      bookmarks,
      source: format,
      stats: {
        totalItems: counts.folders + counts.bookmarks,
        folders: counts.folders,
        bookmarks: counts.bookmarks,
      },
    };
  } catch (error) {
    return {
      success: false,
      bookmarks: [],
      source: format,
      error: error instanceof Error ? error.message : 'Failed to parse bookmarks',
      stats: { totalItems: 0, folders: 0, bookmarks: 0 },
    };
  }
}
