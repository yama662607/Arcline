import { describe, expect, it } from 'vitest';
import {
  findFavoriteUrlMatch,
  formatShortcutCombo,
  normalizeShortcutCombo,
  parseShortcutFromEvent,
} from '../shortcut-keys';

describe('shortcut-keys', () => {
  it('normalizes modifier order, upgrades legacy single keys, and rejects bare keys', () => {
    expect(normalizeShortcutCombo('shift+ctrl+M')).toBe('ctrl+shift+m');
    expect(normalizeShortcutCombo('m')).toBe('alt+m');
    expect(normalizeShortcutCombo('1')).toBe('alt+1');
    expect(normalizeShortcutCombo('shift+a')).toBeUndefined();
    expect(normalizeShortcutCombo('alt+enter')).toBeUndefined();
    expect(normalizeShortcutCombo('')).toBeUndefined();
  });

  it('extracts canonical combos from physical KeyboardEvent codes', () => {
    expect(
      parseShortcutFromEvent({
        code: 'KeyM',
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        metaKey: false,
      }),
    ).toBe('alt+m');
    expect(
      parseShortcutFromEvent({
        code: 'Digit2',
        ctrlKey: true,
        altKey: false,
        shiftKey: true,
        metaKey: false,
      }),
    ).toBe('ctrl+shift+2');
    expect(
      parseShortcutFromEvent({
        code: 'KeyA',
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      }),
    ).toBeNull();
  });

  it('formats combos for macOS and Windows/Linux', () => {
    expect(formatShortcutCombo('alt+1', true)).toBe('⌥1');
    expect(formatShortcutCombo('ctrl+shift+g', true)).toBe('⌃⇧G');
    expect(formatShortcutCombo('ctrl+shift+g', false)).toBe('Ctrl+Shift+G');
  });

  it('matches Favorite URLs with trailing-slash / www normalization fallback', () => {
    const favs = [{ id: 'f1', url: 'https://www.github.com/' }];
    expect(findFavoriteUrlMatch(favs, 'https://github.com')?.id).toBe('f1');
  });
});
