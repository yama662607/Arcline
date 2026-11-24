import type { Settings } from '../core/types';
import { ensureRoot } from './root';

export const SHORTCUT_CONFIG_BOOKMARK_TITLE = '__arcline_shortcuts_v1__';
const SHORTCUT_CONFIG_URL_PREFIX = 'https://arcline.local/config#';

/**
 * Mirrors user-configured `customSiteSearches` and `favoriteShortcuts` into a single non-folder
 * bookmark directly under `Other Bookmarks / Arcline`.
 *
 * Non-folder direct children of the Arcline root are ignored by `spaceFolders()` and Raycast's
 * Space loader, so this gives Raycast & CLI zero-permission, instant access to user shortcuts
 * without polluting Spaces.
 */
export async function syncShortcutsToBookmarks(settings: Settings): Promise<void> {
  try {
    const { rootId } = await ensureRoot();
    const children = await chrome.bookmarks.getChildren(rootId);
    const existing = children.find(
      (c) => c.url !== undefined && c.title === SHORTCUT_CONFIG_BOOKMARK_TITLE,
    );

    const hasEntries =
      settings.customSiteSearches.length > 0 || Object.keys(settings.favoriteShortcuts).length > 0;

    if (!hasEntries) {
      if (existing) {
        await chrome.bookmarks.remove(existing.id).catch(() => undefined);
      }
      return;
    }

    const payload = JSON.stringify({
      customSiteSearches: settings.customSiteSearches,
      favoriteShortcuts: settings.favoriteShortcuts,
    });
    const encodedUrl = `${SHORTCUT_CONFIG_URL_PREFIX}${encodeURIComponent(payload)}`;

    if (existing) {
      if (existing.url !== encodedUrl) {
        await chrome.bookmarks.update(existing.id, { url: encodedUrl });
      }
    } else {
      await chrome.bookmarks.create({
        parentId: rootId,
        title: SHORTCUT_CONFIG_BOOKMARK_TITLE,
        url: encodedUrl,
      });
    }
  } catch (err) {
    console.warn('[Arcline] syncShortcutsToBookmarks failed', err);
  }
}
