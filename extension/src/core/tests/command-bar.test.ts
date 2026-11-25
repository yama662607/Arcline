import { describe, expect, it } from 'vitest';
import {
  buildCommandBarResults,
  buildSearchUrl,
  buildTabSpaceIndex,
  type CommandBarInput,
  type CommandBarItem,
  displayUrl,
  flattenPinsWithPath,
  foldText,
  isCommandBarPageUrl,
  looksLikeUrl,
  matchSiteSearchPrefix,
  normalizeDestinationUrl,
  normalizeUrlKey,
  QUICK_ACTIONS,
  SEARCH_ENGINE_URLS,
  SITE_SEARCHES,
  scoreToken,
  spaceNameForTab,
  suggestSiteSearch,
} from '../command-bar';
import type { Space } from '../types';

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const DAY = 86_400_000;

function space(partial: Partial<Space> & Pick<Space, 'id' | 'name'>): Space {
  return { hue: 235, pinned: [], tabIds: [], ...partial };
}

const SPACES: Space[] = [
  space({ id: 's1', name: 'Work', tabIds: [1, 2] }),
  space({
    id: 's2',
    name: '遊び',
    tabIds: [3],
    pinned: [
      { kind: 'pin', id: 'p1', title: 'Figma Design', url: 'https://www.figma.com/files' },
      {
        kind: 'folder',
        id: 'f1',
        title: 'Reading',
        children: [
          { kind: 'pin', id: 'p2', title: 'Hacker News', url: 'https://news.ycombinator.com/' },
          {
            kind: 'folder',
            id: 'f2',
            title: 'Deep',
            children: [{ kind: 'pin', id: 'p3', title: 'Lobsters', url: 'https://lobste.rs/' }],
          },
        ],
      },
    ],
  }),
];

function base(overrides: Partial<CommandBarInput> = {}): CommandBarInput {
  return {
    query: '',
    openTabs: [],
    favorites: [],
    spaces: SPACES,
    history: [],
    archived: [],
    activeSpaceId: 's1',
    now: NOW,
    ...overrides,
  };
}

const kinds = (items: CommandBarItem[]) => items.map((i) => i.kind);
const ids = (items: CommandBarItem[]) => items.map((i) => i.id);

describe('foldText / scoreToken', () => {
  it('folds case, width and katakana', () => {
    expect(foldText('GitHub')).toBe('github');
    expect(foldText('グーグル')).toBe('ぐーぐる');
    expect(foldText('ＡＢＣ')).toBe('abc');
  });

  it('orders exact > prefix > word-prefix > substring > subsequence > none', () => {
    const exact = scoreToken('github', 'github');
    const prefix = scoreToken('git', 'github');
    const word = scoreToken('hub', 'my hub page');
    const sub = scoreToken('hub', 'github');
    const fuzzy = scoreToken('ghb', 'github');
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(sub);
    expect(sub).toBeGreaterThan(fuzzy);
    expect(fuzzy).toBeGreaterThan(0);
    expect(scoreToken('xyz', 'github')).toBe(0);
  });

  it('does not fuzzy-match single characters or very scattered subsequences', () => {
    expect(scoreToken('z', 'github')).toBe(0);
    expect(scoreToken('abc', 'a-----------b-----------c')).toBe(0);
  });
});

describe('looksLikeUrl / normalizeDestinationUrl', () => {
  it.each([
    ['https://example.com', true],
    ['http://example.com/path?q=1', true],
    ['example.com', true],
    ['foo.bar/baz', true],
    ['sub.example.co.jp/a/b', true],
    ['localhost', true],
    ['localhost:3000', true],
    ['localhost:3000/app', true],
    ['127.0.0.1', true],
    ['192.168.0.1:8080/x', true],
    ['chrome://settings', true],
    ['file:///tmp/a.html', false],
    ['日本語.jp', true],
    ['  example.com  ', true],
    ['hello', false],
    ['hello world', false],
    ['what is rust', false],
    ['', false],
    ['3.14', false],
    ['999.1.1.1', false],
    ['e.g', false],
    ['foo.bar:99999', false],
    ['javascript:alert(1)', false],
    ['JAVASCRIPT:alert(1)', false],
    ['data:text/html,<b>x</b>', false],
    ['vbscript:msgbox(1)', false],
    ['javascript://%0aalert(1)', false],
  ])('looksLikeUrl(%j) === %s', (input, expected) => {
    expect(looksLikeUrl(input)).toBe(expected);
  });

  it('keeps an existing scheme and adds https / http otherwise', () => {
    expect(normalizeDestinationUrl('http://example.com')).toBe('http://example.com');
    expect(normalizeDestinationUrl('example.com/a')).toBe('https://example.com/a');
    expect(normalizeDestinationUrl('localhost:5173')).toBe('http://localhost:5173');
    expect(normalizeDestinationUrl('10.0.0.1')).toBe('http://10.0.0.1');
    expect(normalizeDestinationUrl('  foo.bar ')).toBe('https://foo.bar');
  });

  it('returns null for dangerous schemes and plain text', () => {
    expect(normalizeDestinationUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeDestinationUrl('data:text/html,hi')).toBeNull();
    expect(normalizeDestinationUrl('vbscript:x')).toBeNull();
    expect(normalizeDestinationUrl('just words')).toBeNull();
  });

  it('url helpers', () => {
    expect(displayUrl('https://www.example.com/a/')).toBe('example.com/a');
    expect(normalizeUrlKey('http://www.Example.com/a/#top')).toBe(
      normalizeUrlKey('https://example.com/a'),
    );
    expect(isCommandBarPageUrl('chrome-extension://abc/empty-space.html?spaceId=1')).toBe(true);
    expect(isCommandBarPageUrl('chrome://newtab/')).toBe(true);
    expect(isCommandBarPageUrl('https://example.com/')).toBe(false);
  });
});

describe('site searches', () => {
  it('exposes the documented prefixes', () => {
    expect(SITE_SEARCHES.map((s) => s.prefix)).toEqual([
      'g',
      'gh',
      'yt',
      'wiki',
      'gpt',
      'pplx',
      'cl',
      'gem',
      'grok',
      'ai',
      'mdn',
      'npm',
      'arx',
      'sch',
      'x',
      'amz',
      'map',
      'rd',
    ]);
    for (const s of SITE_SEARCHES) expect(s.urlTemplate).toContain('%s');
  });

  it.each([
    ['g cats', 'google', 'https://www.google.com/search?q=cats'],
    ['gh react hooks', 'github', 'https://github.com/search?q=react%20hooks'],
    ['yt lofi beats', 'youtube', 'https://www.youtube.com/results?search_query=lofi%20beats'],
    ['wiki tokyo', 'wikipedia', 'https://en.wikipedia.org/w/index.php?search=tokyo'],
    ['gpt explain monads', 'chatgpt', 'https://chatgpt.com/?q=explain%20monads'],
    ['pplx best ramen', 'perplexity', 'https://www.perplexity.ai/search?q=best%20ramen'],
  ])('%j activates %s as the top result', (query, id, url) => {
    const result = buildCommandBarResults(base({ query }));
    expect(result.activeSiteSearch?.id).toBe(id);
    const top = result.items[0];
    expect(top?.kind).toBe('siteSearch');
    expect(top?.action).toEqual({ type: 'openUrl', url });
  });

  it('matchSiteSearchPrefix needs prefix + whitespace and is case-insensitive', () => {
    expect(matchSiteSearchPrefix('gh react hooks ')).toEqual({
      siteSearch: SITE_SEARCHES[1],
      term: 'react hooks ',
    });
    expect(matchSiteSearchPrefix('GH  react')?.term).toBe('react');
    expect(matchSiteSearchPrefix('gh ')?.term).toBe('');
    expect(matchSiteSearchPrefix('gh')).toBeUndefined();
    expect(matchSiteSearchPrefix('ghx react')).toBeUndefined();
    expect(matchSiteSearchPrefix('react gh x')).toBeUndefined();
  });

  it("'gh react hooks ' (trailing space) yields Search GitHub for 'react hooks'", () => {
    const result = buildCommandBarResults(base({ query: 'gh react hooks ' }));
    const top = result.items[0];
    expect(top?.kind).toBe('siteSearch');
    if (top?.kind === 'siteSearch') {
      expect(top.term).toBe('react hooks');
      expect(top.siteSearchId).toBe('github');
    }
    expect(result.term).toBe('react hooks');
  });

  it('prefix + space with no term activates the chip with no results', () => {
    const result = buildCommandBarResults(base({ query: 'yt ' }));
    expect(result.activeSiteSearch?.id).toBe('youtube');
    expect(result.items).toEqual([]);
  });

  it('honors an activeSiteSearchId chip (query is only the term)', () => {
    const result = buildCommandBarResults(base({ query: 'zod', activeSiteSearchId: 'github' }));
    expect(result.activeSiteSearch?.id).toBe('github');
    expect(result.items[0]?.action).toEqual({
      type: 'openUrl',
      url: 'https://github.com/search?q=zod',
    });
    // The prefix is not re-detected inside the term.
    const again = buildCommandBarResults(base({ query: 'g zod', activeSiteSearchId: 'github' }));
    expect(again.items[0]?.action).toEqual({
      type: 'openUrl',
      url: 'https://github.com/search?q=g%20zod',
    });
  });

  it('with a chip, also surfaces matching pages of that site', () => {
    const result = buildCommandBarResults(
      base({
        query: 'react',
        activeSiteSearchId: 'github',
        history: [
          { url: 'https://github.com/facebook/react', title: 'facebook/react' },
          { url: 'https://example.com/react', title: 'React on example' },
        ],
      }),
    );
    expect(ids(result.items)).toEqual(['site:github', 'history:https://github.com/facebook/react']);
  });

  it('suggestSiteSearch completes partial prefixes', () => {
    expect(suggestSiteSearch('gh')?.id).toBe('github');
    expect(suggestSiteSearch('g')?.id).toBe('google');
    expect(suggestSiteSearch('y')?.id).toBe('youtube');
    expect(suggestSiteSearch('wi')?.id).toBe('wikipedia');
    expect(suggestSiteSearch('pp')?.id).toBe('perplexity');
    expect(suggestSiteSearch('gp')?.id).toBe('chatgpt');
    expect(suggestSiteSearch('z')).toBeUndefined();
    expect(suggestSiteSearch('gh ')).toBeUndefined();
    expect(suggestSiteSearch('')).toBeUndefined();
    expect(suggestSiteSearch('github')).toBeUndefined();
  });

  it('exposes the partial state in the result', () => {
    expect(buildCommandBarResults(base({ query: 'gh' })).siteSearchSuggestion?.id).toBe('github');
    expect(buildCommandBarResults(base({ query: 'y' })).siteSearchSuggestion?.id).toBe('youtube');
    expect(buildCommandBarResults(base({ query: 'hello' })).siteSearchSuggestion).toBeUndefined();
    expect(buildCommandBarResults(base({ query: '' })).siteSearchSuggestion).toBeUndefined();
    const partial = buildCommandBarResults(base({ query: 'gh' }));
    expect(partial.activeSiteSearch).toBeUndefined();
  });
});

describe('web search fallback', () => {
  it.each([
    ['google', 'https://www.google.com/search?q=hello%20world'],
    ['duckduckgo', 'https://duckduckgo.com/?q=hello%20world'],
    ['brave', 'https://search.brave.com/search?q=hello%20world'],
  ] as const)('uses %s', (engine, url) => {
    const result = buildCommandBarResults(base({ query: 'hello world', searchEngine: engine }));
    const item = result.items.find((i) => i.kind === 'webSearch');
    expect(item?.action).toEqual({ type: 'openUrl', url });
    expect(buildSearchUrl(engine, 'hello world')).toBe(url);
    expect(item?.badge).toBe('search');
    expect(Object.keys(SEARCH_ENGINE_URLS)).toContain(engine);
  });

  it('defaults to google and encodes special characters and Japanese', () => {
    const result = buildCommandBarResults(base({ query: 'c++ & ぐーぐる' }));
    const item = result.items.find((i) => i.kind === 'webSearch');
    expect(item?.action).toEqual({
      type: 'openUrl',
      url: `https://www.google.com/search?q=${encodeURIComponent('c++ & ぐーぐる')}`,
    });
  });

  it('is the top result when nothing else matches', () => {
    const result = buildCommandBarResults(base({ query: 'qqqzzz nothing' }));
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.kind).toBe('webSearch');
  });
});

describe('direct URL navigation', () => {
  it('ranks Navigate first and keeps search as last fallback', () => {
    const result = buildCommandBarResults(base({ query: 'example.com/docs' }));
    expect(kinds(result.items)).toEqual(['navigate', 'webSearch']);
    expect(result.items[0]?.action).toEqual({ type: 'openUrl', url: 'https://example.com/docs' });
  });

  it('localhost gets http', () => {
    const result = buildCommandBarResults(base({ query: 'localhost:3000' }));
    expect(result.items[0]?.action).toEqual({ type: 'openUrl', url: 'http://localhost:3000' });
  });

  it('never offers navigation for dangerous schemes', () => {
    for (const query of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x']) {
      const result = buildCommandBarResults(base({ query }));
      expect(kinds(result.items)).not.toContain('navigate');
      for (const item of result.items) {
        if (item.action.type === 'openUrl') {
          expect(item.action.url).toMatch(/^https:\/\/www\.google\.com\/search/);
        }
      }
    }
  });

  it('an open tab for the same URL replaces the Navigate row', () => {
    const result = buildCommandBarResults(
      base({
        query: 'https://example.com/a',
        openTabs: [{ id: 1, windowId: 10, title: 'Example A', url: 'https://example.com/a' }],
      }),
    );
    expect(result.items[0]?.kind).toBe('tab');
    expect(result.items[0]?.badges).toContain('navigate');
    expect(result.items.filter((i) => i.url === 'https://example.com/a')).toHaveLength(1);
  });
});

describe('ranking across kinds', () => {
  it('same relevance: tab > favorite > pin > history > archived', () => {
    const result = buildCommandBarResults(
      base({
        query: 'zeta',
        activeSpaceId: 's2',
        archived: [
          {
            id: 'a1',
            url: 'https://archived.test/',
            title: 'Zeta archived',
            spaceName: 'Work',
            archivedAt: 1,
          },
        ],
        history: [{ url: 'https://history.test/', title: 'Zeta history' }],
        favorites: [{ id: 'fav1', url: 'https://fav.test/', title: 'Zeta favorite' }],
        openTabs: [{ id: 9, windowId: 1, title: 'Zeta tab', url: 'https://tab.test/' }],
        spaces: [
          space({
            id: 's2',
            name: 'Two',
            pinned: [{ kind: 'pin', id: 'pp', title: 'Zeta pin', url: 'https://pin.test/' }],
          }),
        ],
      }),
    );
    expect(kinds(result.items).slice(0, 5)).toEqual([
      'tab',
      'favorite',
      'pin',
      'history',
      'archived',
    ]);
  });

  it('prefix match beats a better-kind substring match', () => {
    const result = buildCommandBarResults(
      base({
        query: 'doc',
        openTabs: [{ id: 1, windowId: 1, title: 'My undocumented thing', url: 'https://a.test/' }],
        history: [{ url: 'https://b.test/', title: 'Docs home' }],
      }),
    );
    expect(result.items[0]?.id).toBe('history:https://b.test/');
  });

  it('fuzzy (subsequence) matches rank below prefix matches', () => {
    const result = buildCommandBarResults(
      base({
        query: 'ghb',
        history: [
          { url: 'https://one.test/', title: 'GitHub' },
          { url: 'https://two.test/', title: 'ghb notes' },
        ],
      }),
    );
    expect(result.items[0]?.id).toBe('history:https://two.test/');
    expect(ids(result.items)).toContain('history:https://one.test/');
  });

  it('title prefix beats URL-only match', () => {
    const result = buildCommandBarResults(
      base({
        query: 'pricing',
        history: [
          { url: 'https://aaa.test/pricing', title: 'Plans' },
          { url: 'https://bbb.test/', title: 'Pricing page' },
        ],
      }),
    );
    expect(result.items[0]?.id).toBe('history:https://bbb.test/');
  });

  it('multi-token queries need every token to match', () => {
    const result = buildCommandBarResults(
      base({
        query: 'react hooks',
        history: [
          { url: 'https://a.test/', title: 'React hooks guide' },
          { url: 'https://b.test/', title: 'React only' },
        ],
      }),
    );
    const historyIds = result.items.filter((i) => i.kind === 'history').map((i) => i.id);
    expect(historyIds).toEqual(['history:https://a.test/']);
  });

  it('matches host and URL path', () => {
    const result = buildCommandBarResults(
      base({ query: 'ycombinator', history: [{ url: 'https://news.ycombinator.com/item?id=1' }] }),
    );
    expect(result.items[0]?.kind).toBe('history');
  });

  it('is case-insensitive', () => {
    const lower = buildCommandBarResults(
      base({ query: 'github', history: [{ url: 'https://g.test/', title: 'GITHUB Home' }] }),
    );
    const upper = buildCommandBarResults(
      base({ query: 'GITHUB', history: [{ url: 'https://g.test/', title: 'github home' }] }),
    );
    expect(lower.items[0]?.kind).toBe('history');
    expect(upper.items[0]?.kind).toBe('history');
  });

  it('prefers tabs of the active Space on ties', () => {
    const result = buildCommandBarResults(
      base({
        query: 'notes',
        activeSpaceId: 's1',
        openTabs: [
          { id: 3, windowId: 1, title: 'Notes B', url: 'https://b.test/' },
          { id: 1, windowId: 1, title: 'Notes A', url: 'https://a.test/' },
        ],
      }),
    );
    expect(result.items[0]?.action).toMatchObject({ type: 'switchTab', tabId: 1 });
  });

  it('ties are stable (input order)', () => {
    const history = [
      { url: 'https://1.test/', title: 'Alpha one' },
      { url: 'https://2.test/', title: 'Alpha two' },
      { url: 'https://3.test/', title: 'Alpha three' },
    ].map((h) => ({ ...h, lastVisitTime: NOW }));
    const a = buildCommandBarResults(base({ query: 'alpha', history }));
    const b = buildCommandBarResults(base({ query: 'alpha', history }));
    expect(ids(a.items)).toEqual(ids(b.items));
    expect(ids(a.items).slice(0, 3)).toEqual([
      'history:https://1.test/',
      'history:https://2.test/',
      'history:https://3.test/',
    ]);
  });
});

describe('tabs, Spaces, pins', () => {
  it('tab items carry the owning Space name and switchTab action', () => {
    const result = buildCommandBarResults(
      base({
        query: 'figma',
        openTabs: [
          { id: 3, windowId: 7, title: 'Figma board', url: 'https://www.figma.com/board' },
        ],
      }),
    );
    const tab = result.items[0];
    expect(tab?.kind).toBe('tab');
    expect(tab?.badge).toBe('switchTab');
    expect(tab?.spaceName).toBe('遊び');
    expect(tab?.action).toEqual({ type: 'switchTab', tabId: 3, windowId: 7 });
  });

  it('pins carry space name and folder path', () => {
    const result = buildCommandBarResults(base({ query: 'lobsters' }));
    const pin = result.items[0];
    expect(pin?.kind).toBe('pin');
    expect(pin?.spaceName).toBe('遊び');
    expect(pin?.folderPath).toEqual(['Reading', 'Deep']);
    expect(pin?.action).toEqual({ type: 'openPin', pinId: 'p3' });
  });

  it('matches pins by folder name and Space name', () => {
    const byFolder = buildCommandBarResults(base({ query: 'reading' }));
    expect(byFolder.items.some((i) => i.kind === 'pin' && i.action.type === 'openPin')).toBe(true);
    const bySpace = buildCommandBarResults(base({ query: '遊び' }));
    expect(bySpace.items.filter((i) => i.kind === 'pin').length).toBeGreaterThanOrEqual(3);
  });

  it('ignores this extension’s own New Tab page and new-tab pages', () => {
    const result = buildCommandBarResults(
      base({
        query: 'arcline',
        openTabs: [
          { id: 1, windowId: 1, title: 'Arcline', url: 'chrome-extension://x/empty-space.html' },
          { id: 2, windowId: 1, title: 'Arcline', url: 'chrome://newtab/' },
        ],
      }),
    );
    expect(kinds(result.items)).not.toContain('tab');
  });

  it('space helpers', () => {
    expect(spaceNameForTab(SPACES, 2)).toBe('Work');
    expect(spaceNameForTab(SPACES, 3)).toBe('遊び');
    expect(spaceNameForTab(SPACES, 99)).toBeUndefined();
    expect(buildTabSpaceIndex(SPACES).get(1)?.id).toBe('s1');
    expect(flattenPinsWithPath(SPACES[1]?.pinned ?? []).map((p) => p.folderPath)).toEqual([
      [],
      ['Reading'],
      ['Reading', 'Deep'],
    ]);
  });

  it('archived items restore into the Space of the same name, else the active one', () => {
    const result = buildCommandBarResults(
      base({
        query: 'old',
        archived: [
          {
            id: 'a1',
            url: 'https://old1.test/',
            title: 'Old one',
            spaceName: '遊び',
            archivedAt: 1,
          },
          {
            id: 'a2',
            url: 'https://old2.test/',
            title: 'Old two',
            spaceName: 'Gone',
            archivedAt: 2,
          },
        ],
      }),
    );
    const byId = Object.fromEntries(result.items.map((i) => [i.id, i.action]));
    expect(byId['archived:a1']).toEqual({
      type: 'restoreArchived',
      archiveId: 'a1',
      spaceId: 's2',
    });
    expect(byId['archived:a2']).toEqual({
      type: 'restoreArchived',
      archiveId: 'a2',
      spaceId: 's1',
    });
  });
});

describe('dedupe', () => {
  it('open tab beats the same URL in history; badges merge', () => {
    const result = buildCommandBarResults(
      base({
        query: 'example',
        openTabs: [{ id: 1, windowId: 1, title: 'Example', url: 'https://example.com/page' }],
        history: [
          {
            url: 'https://www.example.com/page#frag',
            title: 'Example',
            visitCount: 50,
            lastVisitTime: NOW,
          },
        ],
      }),
    );
    const matches = result.items.filter((i) => i.url?.includes('example.com'));
    expect(matches).toHaveLength(1);
    expect(matches[0]?.kind).toBe('tab');
    expect(matches[0]?.badges).toEqual(['switchTab', 'history']);
  });

  it('favorite beats pin beats history for the same URL', () => {
    const result = buildCommandBarResults(
      base({
        query: 'figma',
        favorites: [{ id: 'f', title: 'Figma', url: 'https://figma.com/files' }],
        history: [{ url: 'https://figma.com/files', title: 'Figma' }],
      }),
    );
    const matches = result.items.filter((i) => i.url?.includes('figma.com'));
    expect(matches).toHaveLength(1);
    expect(matches[0]?.kind).toBe('favorite');
    expect(matches[0]?.badges).toEqual(expect.arrayContaining(['favorite', 'pinned', 'history']));
  });

  it('keeps distinct URLs apart', () => {
    const result = buildCommandBarResults(
      base({
        query: 'docs',
        history: [
          { url: 'https://a.test/docs', title: 'Docs' },
          { url: 'https://a.test/docs?x=1', title: 'Docs' },
        ],
      }),
    );
    expect(result.items.filter((i) => i.kind === 'history')).toHaveLength(2);
  });
});

describe('history signals', () => {
  it('more recent visits rank higher on equal relevance', () => {
    const result = buildCommandBarResults(
      base({
        query: 'news',
        history: [
          { url: 'https://old.test/', title: 'News', lastVisitTime: NOW - 200 * DAY },
          { url: 'https://new.test/', title: 'News', lastVisitTime: NOW - 1 * DAY },
        ],
      }),
    );
    expect(result.items[0]?.id).toBe('history:https://new.test/');
  });

  it('visit count breaks ties', () => {
    const result = buildCommandBarResults(
      base({
        query: 'blog',
        history: [
          { url: 'https://few.test/', title: 'Blog', lastVisitTime: NOW, visitCount: 1 },
          { url: 'https://many.test/', title: 'Blog', lastVisitTime: NOW, visitCount: 40 },
        ],
      }),
    );
    expect(result.items[0]?.id).toBe('history:https://many.test/');
  });

  it('recency never outranks a better match tier', () => {
    const result = buildCommandBarResults(
      base({
        query: 'react',
        history: [
          { url: 'https://sub.test/', title: 'Preact notes', lastVisitTime: NOW, visitCount: 999 },
          { url: 'https://pre.test/', title: 'React docs', lastVisitTime: NOW - 900 * DAY },
        ],
      }),
    );
    expect(result.items[0]?.id).toBe('history:https://pre.test/');
  });

  it('is deterministic for fixed now and tolerates missing fields', () => {
    const input = base({
      query: 'x',
      history: [{ url: 'https://x.test/', title: 'X', lastVisitTime: Number.NaN }],
    });
    expect(buildCommandBarResults(input)).toEqual(buildCommandBarResults(input));
  });
});

describe('empty query default list', () => {
  const openTabs = [
    { id: 1, windowId: 1, title: 'Work one', url: 'https://w1.test/' },
    { id: 2, windowId: 1, title: 'Work two', url: 'https://w2.test/' },
    { id: 3, windowId: 1, title: 'Play', url: 'https://p.test/' },
  ];

  it('lists active-Space tabs, then favorites, then quick actions', () => {
    const result = buildCommandBarResults(
      base({
        openTabs,
        favorites: [{ id: 'f1', title: 'Fav', url: 'https://fav.test/' }],
        history: [{ url: 'https://hist.test/', title: 'History' }],
      }),
    );
    expect(kinds(result.items)).toEqual([
      'tab',
      'tab',
      'favorite',
      'quickAction',
      'quickAction',
      'quickAction',
    ]);
    expect(ids(result.items).slice(0, 2)).toEqual(['tab:1', 'tab:2']);
    expect(result.items.some((i) => i.kind === 'history')).toBe(false);
    expect(result.items.find((i) => i.kind === 'quickAction')?.badge).toBe('action');
    expect(result.activeSiteSearch).toBeUndefined();
  });

  it('falls back to all tabs when the active Space has none', () => {
    const result = buildCommandBarResults(base({ openTabs, activeSpaceId: 'nope' }));
    expect(kinds(result.items).filter((k) => k === 'tab')).toHaveLength(3);
  });

  it('whitespace-only is empty', () => {
    expect(buildCommandBarResults(base({ query: '   ', openTabs })).items[0]?.kind).toBe('tab');
  });

  it('works with no data at all', () => {
    const result = buildCommandBarResults(base({ spaces: [], activeSpaceId: undefined }));
    expect(kinds(result.items)).toEqual(['quickAction', 'quickAction', 'quickAction']);
  });
});

describe('quick actions', () => {
  it.each([
    ['new space', 'newSpace'],
    ['dark mode', 'toggleTheme'],
    ['settings', 'openSettings'],
    ['clear today', 'clearTodayTabs'],
    ['onboarding', 'openOnboarding'],
    ['shortcuts', 'openShortcuts'],
    ['設定', 'openSettings'],
    ['ショートカット', 'openShortcuts'],
  ])('%j finds %s', (query, id) => {
    const result = buildCommandBarResults(base({ query }));
    expect(result.items.some((i) => i.kind === 'quickAction' && i.action.id === id)).toBe(true);
  });

  it('uses localized labels as title and searchable text', () => {
    const result = buildCommandBarResults(
      base({ query: 'せってい', actionLabels: { openSettings: 'せってい を ひらく' } }),
    );
    const item = result.items.find((i) => i.kind === 'quickAction');
    expect(item?.title).toBe('せってい を ひらく');
  });

  it('every quick action id is unique', () => {
    const idsList = QUICK_ACTIONS.map((a) => a.id);
    expect(new Set(idsList).size).toBe(idsList.length);
  });
});

describe('limit', () => {
  const history = Array.from({ length: 50 }, (_, i) => ({
    url: `https://site${i}.test/`,
    title: `Item ${i}`,
  }));

  it('defaults to 20 and honors explicit limits', () => {
    expect(buildCommandBarResults(base({ query: 'item', history })).items).toHaveLength(20);
    expect(buildCommandBarResults(base({ query: 'item', history, limit: 5 })).items).toHaveLength(
      5,
    );
    expect(buildCommandBarResults(base({ query: 'item', history, limit: 0 })).items).toHaveLength(
      0,
    );
    expect(buildCommandBarResults(base({ query: '', limit: 1 })).items).toHaveLength(1);
  });
});

describe('unicode / Japanese', () => {
  it('does not crash on Japanese and emoji queries', () => {
    expect(() => buildCommandBarResults(base({ query: 'ぐーぐる' }))).not.toThrow();
    expect(() => buildCommandBarResults(base({ query: '😀 テスト' }))).not.toThrow();
    const result = buildCommandBarResults(base({ query: 'ぐーぐる' }));
    expect(result.items.at(-1)?.kind).toBe('webSearch');
  });

  it('matches Japanese titles by substring', () => {
    const result = buildCommandBarResults(
      base({
        query: '天気',
        history: [
          { url: 'https://tenki.test/', title: '東京の天気予報' },
          { url: 'https://other.test/', title: '関係ないページ' },
        ],
      }),
    );
    const hist = result.items.filter((i) => i.kind === 'history');
    expect(hist.map((i) => i.id)).toEqual(['history:https://tenki.test/']);
  });

  it('folds katakana to hiragana and full-width to ASCII', () => {
    const result = buildCommandBarResults(
      base({
        query: 'ぐーぐる',
        history: [{ url: 'https://g.test/', title: 'グーグル 検索' }],
      }),
    );
    expect(result.items[0]?.id).toBe('history:https://g.test/');
    const wide = buildCommandBarResults(
      base({ query: 'ＧＩＴＨＵＢ', history: [{ url: 'https://h.test/', title: 'GitHub' }] }),
    );
    expect(wide.items[0]?.id).toBe('history:https://h.test/');
  });

  it('does not treat Japanese text as a URL', () => {
    expect(looksLikeUrl('ぐーぐる')).toBe(false);
    expect(looksLikeUrl('東京 天気')).toBe(false);
  });
});

describe('robustness', () => {
  it('skips entries with unusable URLs', () => {
    const result = buildCommandBarResults(
      base({
        query: 'bad',
        history: [
          { url: '', title: 'bad empty' },
          { url: 'javascript:alert(1)', title: 'bad js' },
        ],
        favorites: [{ id: 'x', title: 'bad fav', url: 'data:text/html,x' }],
      }),
    );
    expect(kinds(result.items)).toEqual(['webSearch']);
  });

  it('falls back to the host when a title is empty', () => {
    const result = buildCommandBarResults(
      base({ query: 'example', history: [{ url: 'https://example.com/a', title: '' }] }),
    );
    expect(result.items[0]?.title).toBe('example.com/a');
  });

  it('supports expanded AI & developer built-in site searches and custom site searches', () => {
    const claude = buildCommandBarResults(base({ query: 'cl summarize paper' }));
    expect(claude.activeSiteSearch?.id).toBe('claude');
    expect(claude.items[0]?.kind).toBe('siteSearch');
    expect(claude.items[0]?.url).toBe('https://claude.ai/new?q=summarize%20paper');

    const custom = buildCommandBarResults(
      base({
        query: 'docs hooks',
        customSiteSearches: [
          {
            id: 'custom:docs',
            prefix: 'docs',
            label: 'Internal Docs',
            urlTemplate: 'https://docs.example.com/search?q=%s',
          },
        ],
      }),
    );
    expect(custom.activeSiteSearch?.id).toBe('custom:docs');
    expect(custom.items[0]?.url).toBe('https://docs.example.com/search?q=hooks');
  });

  it('ranks exact Favorite alias matches #1 and attaches alias & shortcut metadata', () => {
    const result = buildCommandBarResults(
      base({
        query: 'gm',
        openTabs: [{ id: 1, windowId: 1, title: 'GM Notes', url: 'https://notes.example.com/gm' }],
        favorites: [{ id: 'fav-mail', title: 'Gmail', url: 'https://mail.google.com/' }],
        favoriteShortcuts: {
          'https://mail.google.com/': { alias: 'gm', shortcut: 'm' },
        },
      }),
    );
    expect(result.items[0]?.kind).toBe('favorite');
    if (result.items[0]?.kind === 'favorite') {
      expect(result.items[0].alias).toBe('gm');
      expect(result.items[0].shortcut).toBe('m');
    }
  });

  it('promotes Web Search to #1 on trailing space or multi-word queries while keeping bookmarks below', () => {
    const spaces: Space[] = [
      {
        id: 's1',
        name: 'Work',
        hue: 220,
        pinned: [
          {
            kind: 'pin',
            id: 'p1',
            title: 'React Hooks Guide',
            url: 'https://react.dev/reference/react/hooks',
          },
        ],
        tabIds: [],
      },
    ];
    // Single word without trailing space -> bookmark stays #1
    const single = buildCommandBarResults(base({ query: 'react', spaces }));
    expect(single.items[0]?.kind).toBe('pin');

    // Word + trailing space -> Web Search jumps to #1 (Arc behavior), bookmark remains below
    const trailingSpace = buildCommandBarResults(base({ query: 'react ', spaces }));
    expect(trailingSpace.items[0]?.kind).toBe('webSearch');
    expect(trailingSpace.items.some((item) => item.kind === 'pin')).toBe(true);

    // Multi-word query -> Web Search jumps to #1
    const multiWord = buildCommandBarResults(base({ query: 'react hooks', spaces }));
    expect(multiWord.items[0]?.kind).toBe('webSearch');
    expect(multiWord.items.some((item) => item.kind === 'pin')).toBe(true);
  });
});
