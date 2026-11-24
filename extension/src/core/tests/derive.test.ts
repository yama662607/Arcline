import { describe, expect, it } from 'vitest';
import { deriveState } from '../derive';
import { NO_GROUP, ownerOf } from '../snapshot';
import type { BookmarkNode, Snapshot } from '../types';

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  const root: BookmarkNode = {
    id: 'root',
    title: 'Arcline',
    children: [
      {
        id: 'favs',
        title: 'Favorites',
        children: [
          { id: 'f1', title: 'GitHub', url: 'https://github.com/' },
          { id: 'f2', title: 'Gemini', url: 'https://gemini.google.com/' },
        ],
      },
      {
        id: 'sp-main',
        title: 'Main',
        children: [
          { id: 'p1', title: 'Docs', url: 'https://docs.example.com/' },
          {
            id: 'dir1',
            title: 'Research',
            children: [{ id: 'p2', title: 'Paper', url: 'https://arxiv.org/abs/1234' }],
          },
        ],
      },
      {
        id: 'sp-work',
        title: 'Active Matter',
        children: [{ id: 'p3', title: 'Lab', url: 'https://lab.example.com/' }],
      },
    ],
  };

  return {
    windowId: 1,
    rootId: 'root',
    favoritesId: 'favs',
    root,
    tabs: [
      { id: 10, url: 'https://github.com/', title: 'GitHub', pinned: true, groupId: NO_GROUP },
      {
        id: 11,
        url: 'https://arxiv.org/abs/1234',
        title: 'Paper',
        pinned: false,
        active: true,
        groupId: 100,
      },
      {
        id: 12,
        url: 'https://news.ycombinator.com/',
        title: 'HN',
        pinned: false,
        groupId: 100,
      },
      {
        id: 13,
        url: 'https://lab.example.com/sub',
        title: 'Lab Sub',
        pinned: false,
        groupId: 200,
      },
    ],
    groups: [
      { id: 100, windowId: 1, title: 'Main', color: 'blue', collapsed: false },
      { id: 200, windowId: 1, title: 'Active Matter', color: 'purple', collapsed: true },
    ],
    bindings: {
      10: { kind: 'favorite', id: 'f1' },
      11: { kind: 'pin', id: 'p2' },
    },
    groupSpaces: { 100: 'sp-main', 200: 'sp-work' },
    activeSpaces: { 1: 'sp-main' },
    spaceMeta: { Main: { hue: 235 }, 'Active Matter': { hue: 275 } },
    openFolders: ['dir1'],
    ...overrides,
  };
}

describe('deriveState', () => {
  it('separates global favorites, space pinned trees, and temporary tabs cleanly', () => {
    const state = deriveState(makeSnapshot());

    expect(state.favorites).toHaveLength(2);
    expect(state.favorites[0]?.tabId).toBe(10);
    expect(state.favorites[1]?.tabId).toBeUndefined();

    expect(state.spaces).toHaveLength(2);
    const main = state.spaces[0];
    expect(main).toBeDefined();
    if (!main) return;
    expect(main.name).toBe('Main');
    expect(main.pinned).toHaveLength(2);
    expect(main.pinned[1]?.kind).toBe('folder');
    if (main.pinned[1]?.kind === 'folder') {
      expect(main.pinned[1].children[0]?.kind).toBe('pin');
      if (main.pinned[1].children[0]?.kind === 'pin') {
        expect(main.pinned[1].children[0].tabId).toBe(11);
      }
    }
    // Bound tab 11 must NOT appear in temporary tabIds; only unbound tab 12 does
    expect(main.tabIds).toEqual([12]);
    expect(state.spaces[1]?.tabIds).toEqual([13]);
    expect(state.activeSpaceId).toBe('sp-main');
    expect(state.activeTabId).toBe(11);
    expect(state.openFolders.has('dir1')).toBe(true);
  });

  it('recovers pin ownership by exact URL, normalized URL, or lastPages', () => {
    const pins = [
      { id: 'p1', title: 'GitHub', url: 'https://github.com/' },
      { id: 'p2', title: 'Gemini', url: 'https://gemini.google.com/app' },
    ];
    const lastPages = { p2: 'https://gemini.google.com/app/thread-99' };

    expect(ownerOf(pins, 'https://github.com', lastPages, new Set())?.id).toBe('p1');
    expect(ownerOf(pins, 'https://gemini.google.com/app/thread-99', lastPages, new Set())?.id).toBe(
      'p2',
    );
    expect(ownerOf(pins, 'https://github.com/', lastPages, new Set(['p1']))).toBeUndefined();
  });
});
