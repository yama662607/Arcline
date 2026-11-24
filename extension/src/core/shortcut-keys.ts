import type { FavoriteShortcut } from './types';

const CANONICAL_COMBO_RE = /^(?:ctrl\+)?(?:alt\+)?(?:shift\+)?(?:meta\+)?[a-z0-9]$/;
const SINGLE_KEY_RE = /^[a-z0-9]$/;

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

/**
 * Normalizes a persisted shortcut string into canonical modifier order:
 * `ctrl+alt+shift+meta+<key>` (requires at least one non-shift modifier).
 * Legacy single-key entries (`"m"`) are upgraded to `"alt+m"`.
 */
export function normalizeShortcutCombo(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (SINGLE_KEY_RE.test(trimmed)) {
    return `alt+${trimmed}`;
  }
  const parts = trimmed.split('+').filter(Boolean);
  if (parts.length < 2) return undefined;
  const key = parts[parts.length - 1] ?? '';
  if (!SINGLE_KEY_RE.test(key)) return undefined;
  const mods = new Set(parts.slice(0, -1));
  if (!mods.has('ctrl') && !mods.has('alt') && !mods.has('meta')) return undefined;
  const ordered: string[] = [];
  if (mods.has('ctrl')) ordered.push('ctrl');
  if (mods.has('alt')) ordered.push('alt');
  if (mods.has('shift')) ordered.push('shift');
  if (mods.has('meta')) ordered.push('meta');
  ordered.push(key);
  const combo = ordered.join('+');
  return CANONICAL_COMBO_RE.test(combo) ? combo : undefined;
}

/** Extracts a canonical shortcut combo from a KeyboardEvent using physical `e.code`. */
export function parseShortcutFromEvent(e: {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}): string | null {
  if (!e.ctrlKey && !e.altKey && !e.metaKey) return null;
  const key = e.code.startsWith('Key')
    ? e.code.slice(3).toLowerCase()
    : e.code.startsWith('Digit')
      ? e.code.slice(5)
      : '';
  if (!SINGLE_KEY_RE.test(key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  if (e.metaKey) parts.push('meta');
  parts.push(key);
  return parts.join('+');
}

/** Formats a canonical combo (`alt+m`, `ctrl+shift+1`) for compact UI display. */
export function formatShortcutCombo(combo: string, isMac: boolean): string {
  const normalized = normalizeShortcutCombo(combo);
  if (!normalized) return combo;
  const parts = normalized.split('+');
  const key = (parts.pop() ?? '').toUpperCase();
  if (isMac) {
    const glyphs = parts.map((m) =>
      m === 'ctrl' ? '⌃' : m === 'alt' ? '⌥' : m === 'shift' ? '⇧' : '⌘',
    );
    return `${glyphs.join('')}${key}`;
  }
  const labels = parts.map((m) =>
    m === 'ctrl' ? 'Ctrl' : m === 'alt' ? 'Alt' : m === 'shift' ? 'Shift' : 'Win',
  );
  return [...labels, key].join('+');
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Matches a KeyboardEvent against configured Favorite shortcuts.
 * Returns the matched Favorite URL, or `null` if no shortcut matches.
 */
export function matchFavoriteShortcut(
  e: KeyboardEvent,
  favoriteShortcuts: Readonly<Record<string, FavoriteShortcut>>,
  options: { allowInInput?: boolean } = {},
): string | null {
  if (!options.allowInInput && isEditableElement(e.target)) {
    return null;
  }
  const combo = parseShortcutFromEvent(e);
  if (!combo) return null;
  for (const [url, meta] of Object.entries(favoriteShortcuts)) {
    if (!meta.shortcut) continue;
    if (normalizeShortcutCombo(meta.shortcut) === combo) {
      return url;
    }
  }
  return null;
}

export function findFavoriteUrlMatch(
  favorites: ReadonlyArray<{ id: string; url: string }>,
  targetUrl: string,
): { id: string; url: string } | undefined {
  const exact = favorites.find((f) => f.url === targetUrl);
  if (exact) return exact;
  const key = normalizeUrlKey(targetUrl);
  return favorites.find((f) => normalizeUrlKey(f.url) === key);
}
