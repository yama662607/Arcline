import { describe, expect, it } from 'vitest';
import {
  ArcImportError,
  createSampleArcSidebarJson,
  filterImportedSidebar,
  parseArcSidebar,
} from '../arc-import';

const SAMPLE_ARC_JSON = {
  sidebar: {
    containers: [
      { global: {} },
      {
        topAppsContainerIDs: [{ default: true }, 'top-apps'],
        spaces: [
          's1',
          {
            id: 's1',
            title: 'Main',
            containerIDs: ['pinned', 's1-pinned', 'unpinned', 's1-unpinned'],
            customInfo: {
              windowTheme: {
                primaryColorPalette: { midTone: { red: 0.2, green: 0.4, blue: 0.9 } },
              },
            },
          },
        ],
        items: [
          'top-apps',
          { id: 'top-apps', childrenIds: ['fav-1'] },
          'fav-1',
          {
            id: 'fav-1',
            parentID: 'top-apps',
            title: null,
            data: { tab: { savedURL: 'https://github.com/', savedTitle: 'GitHub' } },
          },
          's1-pinned',
          {
            id: 's1-pinned',
            childrenIds: ['folder-1', 'empty-dir', 'search-tab', 'dup-1', 'dup-2', 'broken-1'],
          },
          'folder-1',
          {
            id: 'folder-1',
            title: 'Research',
            childrenIds: ['pin-1'],
            data: { list: {} },
          },
          'pin-1',
          {
            id: 'pin-1',
            title: 'Research Lab',
            data: { tab: { savedURL: 'https://research.example.edu/', savedTitle: 'Lab' } },
          },
          'empty-dir',
          { id: 'empty-dir', title: 'Empty', childrenIds: [], data: { list: {} } },
          'search-tab',
          {
            id: 'search-tab',
            title: 'Query',
            data: { tab: { savedURL: 'https://www.google.com/search?q=test', savedTitle: 'test' } },
          },
          'dup-1',
          {
            id: 'dup-1',
            title: 'Campus Portal',
            data: { tab: { savedURL: 'https://portal.example.org/', savedTitle: 'Campus Portal' } },
          },
          'dup-2',
          {
            id: 'dup-2',
            title: 'Campus Portal',
            data: { tab: { savedURL: 'https://portal.example.org/', savedTitle: 'Campus Portal' } },
          },
          'broken-1',
          {
            id: 'broken-1',
            title: null,
            data: {
              tab: {
                savedURL: 'file:///private/var/mobile/Containers/Data/Application/abc/figure.html',
                savedTitle: '',
              },
            },
          },
        ],
      },
    ],
  },
};

describe('parseArcSidebar', () => {
  it('parses Top Apps as favorites and cleans empty folders, searches, duplicates, and broken local files', () => {
    const res = parseArcSidebar(SAMPLE_ARC_JSON);
    expect(res.favorites).toEqual([{ title: 'GitHub', url: 'https://github.com/' }]);
    expect(res.spaces).toHaveLength(1);
    expect(res.spaces[0]?.name).toBe('Main');
    expect(res.spaces[0]?.pinned).toHaveLength(2);
    expect(res.stats).toEqual({
      totalPins: 2,
      totalFolders: 1,
      skippedEmptyFolders: 1,
      skippedSearches: 1,
      deduped: 1,
      skippedBroken: 1,
    });
  });

  it('throws ArcImportError on invalid JSON', () => {
    expect(() => parseArcSidebar({})).toThrow(ArcImportError);
  });

  it('prefers readable savedTitle when Arc item.title is a raw URL', () => {
    const raw = {
      sidebar: {
        containers: [
          {
            topAppsContainerIDs: [],
            spaces: [{ id: 's1', title: 'Main', containerIDs: ['pinned', 'p-root'] }],
            items: [
              { id: 'p-root', childrenIds: ['p1'] },
              {
                id: 'p1',
                title: 'https://recopay.page.link/abc',
                data: {
                  tab: { savedURL: 'https://scitan.net/typing', savedTitle: 'Scitan Typing' },
                },
              },
            ],
          },
        ],
      },
    };
    const res = parseArcSidebar(raw);
    expect(res.spaces[0]?.pinned[0]).toEqual({
      kind: 'pin',
      title: 'Scitan Typing',
      url: 'https://scitan.net/typing',
    });
  });

  it('rejects executable javascript: and data: pseudo-URLs during import', () => {
    const malicious = {
      sidebar: {
        containers: [
          {
            topAppsContainerIDs: ['top'],
            spaces: [{ id: 's1', title: 'Sec', containerIDs: ['pinned', 'p-root'] }],
            items: [
              { id: 'top', childrenIds: ['fav-xss', 'fav-ok'] },
              {
                id: 'fav-xss',
                data: { tab: { savedURL: 'javascript:alert(1)', savedTitle: 'XSS' } },
              },
              {
                id: 'fav-ok',
                data: { tab: { savedURL: 'https://example.com/', savedTitle: 'OK' } },
              },
              { id: 'p-root', childrenIds: ['pin-data', 'pin-ok'] },
              {
                id: 'pin-data',
                data: { tab: { savedURL: 'data:text/html,<script>alert(1)</script>' } },
              },
              {
                id: 'pin-ok',
                data: { tab: { savedURL: 'https://brave.com/', savedTitle: 'Brave' } },
              },
            ],
          },
        ],
      },
    };
    const res = parseArcSidebar(malicious);
    expect(res.favorites).toEqual([{ title: 'OK', url: 'https://example.com/' }]);
    expect(res.spaces[0]?.pinned).toEqual([
      { kind: 'pin', title: 'Brave', url: 'https://brave.com/' },
    ]);
    expect(res.stats.skippedBroken).toBe(1);
  });

  it('parses the built-in sample and filters selected Spaces and Favorites accurately', () => {
    const sample = parseArcSidebar(createSampleArcSidebarJson());
    expect(sample.spaces).toHaveLength(3);
    expect(sample.favorites).toHaveLength(4);
    expect(sample.stats.deduped).toBe(1);
    expect(sample.stats.skippedEmptyFolders).toBe(1);
    expect(sample.stats.skippedSearches).toBe(1);

    const onlyDesign = filterImportedSidebar(sample, new Set([1]), false);
    expect(onlyDesign.favorites).toEqual([]);
    expect(onlyDesign.spaces.map((s) => s.name)).toEqual(['Design Studio']);
    expect(onlyDesign.stats.totalPins).toBe(3);
    expect(onlyDesign.stats.totalFolders).toBe(1);
  });
});
