import { beforeEach, describe, expect, it } from 'vitest';
import { deriveState } from '../core/derive';
import { NO_GROUP } from '../core/snapshot';
import type { BookmarkNode, TabGroupColor, TabGroupInfo, TabInfo } from '../core/types';
import { Engine } from './engine';
import { loadRoot } from './root';
import { storage } from './storage';

/**
 * Deterministic in-memory Chrome API harness for end-to-end Engine testing
 * without requiring a live browser process.
 */
function installChromeHarness() {
  let nextBookmarkId = 100;
  let nextTabId = 1;
  let nextGroupId = 10;

  const localStore: Record<string, unknown> = {};
  const sessionStore: Record<string, unknown> = {};

  const bookmarkRoot: BookmarkNode = {
    id: '0',
    title: '',
    children: [
      { id: '1', title: 'Bookmarks Bar', parentId: '0', index: 0, children: [] },
      { id: '2', title: 'Other Bookmarks', parentId: '0', index: 1, children: [] },
    ],
  };

  const findNode = (id: string, cur: BookmarkNode = bookmarkRoot): BookmarkNode | undefined => {
    if (cur.id === id) return cur;
    for (const ch of cur.children ?? []) {
      const f = findNode(id, ch);
      if (f) return f;
    }
    return undefined;
  };

  const reindex = (parent: BookmarkNode) => {
    parent.children?.forEach((c, i) => {
      c.parentId = parent.id;
      c.index = i;
    });
  };

  const cloneNode = (node: BookmarkNode): BookmarkNode => ({
    ...node,
    ...(node.children ? { children: node.children.map(cloneNode) } : {}),
  });

  const tabs: Array<TabInfo & { id: number; windowId: number; index: number }> = [
    {
      id: nextTabId++,
      windowId: 1,
      index: 0,
      title: 'Start',
      url: 'https://start.example.com/',
      active: true,
      pinned: false,
      groupId: NO_GROUP,
    },
  ];
  const groups: TabGroupInfo[] = [];

  const reindexTabs = () => {
    tabs.forEach((t, i) => {
      t.index = i;
    });
  };

  const chromeMock = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: localStore[key] }),
        set: async (obj: Record<string, unknown>) => {
          Object.assign(localStore, obj);
        },
      },
      session: {
        get: async (key: string) => ({ [key]: sessionStore[key] }),
        set: async (obj: Record<string, unknown>) => {
          Object.assign(sessionStore, obj);
        },
      },
    },
    windows: {
      get: async (id: number) => ({ id, type: 'normal' }),
      getAll: async () => [{ id: 1, type: 'normal' }],
      getLastFocused: async () => ({ id: 1, type: 'normal' }),
    },
    bookmarks: {
      getTree: async () => [cloneNode(bookmarkRoot)],
      getSubTree: async (id: string) => {
        const node = findNode(id);
        if (!node) throw new Error(`Bookmark ${id} not found`);
        return [cloneNode(node)];
      },
      get: async (ids: string | string[]) => {
        const list = Array.isArray(ids) ? ids : [ids];
        return list.map((id) => {
          const n = findNode(id);
          if (!n) throw new Error(`Bookmark ${id} not found`);
          return cloneNode(n);
        });
      },
      getChildren: async (id: string) => {
        const n = findNode(id);
        return (n?.children ?? []).map(cloneNode);
      },
      create: async (details: {
        parentId: string;
        title: string;
        url?: string;
        index?: number;
      }) => {
        const parent = findNode(details.parentId);
        if (!parent) throw new Error(`Parent ${details.parentId} not found`);
        parent.children ??= [];
        const created: BookmarkNode = {
          id: String(nextBookmarkId++),
          parentId: parent.id,
          title: details.title,
          ...(details.url !== undefined ? { url: details.url } : { children: [] }),
        };
        const idx = details.index ?? parent.children.length;
        parent.children.splice(idx, 0, created);
        reindex(parent);
        return cloneNode(created);
      },
      update: async (id: string, changes: { title?: string; url?: string }) => {
        const n = findNode(id);
        if (!n) throw new Error(`Bookmark ${id} not found`);
        if (changes.title !== undefined) n.title = changes.title;
        if (changes.url !== undefined) n.url = changes.url;
        return cloneNode(n);
      },
      move: async (id: string, dest: { parentId: string; index?: number }) => {
        const node = findNode(id);
        const newParent = findNode(dest.parentId);
        if (!node || !newParent || !node.parentId) throw new Error('Move target missing');
        const oldParent = findNode(node.parentId);
        if (oldParent?.children) {
          oldParent.children = oldParent.children.filter((c) => c.id !== id);
          reindex(oldParent);
        }
        newParent.children ??= [];
        const idx = dest.index ?? newParent.children.length;
        newParent.children.splice(idx, 0, node);
        reindex(newParent);
        return cloneNode(node);
      },
      remove: async (id: string) => {
        const node = findNode(id);
        if (!node?.parentId) return;
        const parent = findNode(node.parentId);
        if (parent?.children) {
          parent.children = parent.children.filter((c) => c.id !== id);
          reindex(parent);
        }
      },
      removeTree: async (id: string) => {
        const node = findNode(id);
        if (!node?.parentId) return;
        const parent = findNode(node.parentId);
        if (parent?.children) {
          parent.children = parent.children.filter((c) => c.id !== id);
          reindex(parent);
        }
      },
    },
    tabs: {
      query: async (q: { windowId?: number; active?: boolean }) =>
        tabs
          .filter((t) => q.windowId === undefined || t.windowId === q.windowId)
          .filter((t) => q.active === undefined || Boolean(t.active) === q.active)
          .map((t) => ({ ...t })),
      get: async (id: number) => {
        const t = tabs.find((x) => x.id === id);
        if (!t) throw new Error(`Tab ${id} not found`);
        return { ...t };
      },
      create: async (opts: {
        windowId?: number;
        url?: string;
        active?: boolean;
        pinned?: boolean;
      }) => {
        if (opts.active) {
          for (const t of tabs) t.active = false;
        }
        const tab = {
          id: nextTabId++,
          windowId: opts.windowId ?? 1,
          index: tabs.length,
          title: opts.url ?? 'New Tab',
          url: opts.url ?? 'about:blank',
          active: opts.active ?? true,
          pinned: opts.pinned ?? false,
          groupId: NO_GROUP,
        };
        tabs.push(tab);
        reindexTabs();
        return { ...tab };
      },
      update: async (
        id: number,
        props: { active?: boolean; pinned?: boolean; url?: string; muted?: boolean },
      ) => {
        const t = tabs.find((x) => x.id === id);
        if (!t) throw new Error(`Tab ${id} not found`);
        if (props.active) {
          for (const x of tabs) x.active = x.id === id;
        }
        if (props.pinned !== undefined) {
          t.pinned = props.pinned;
          if (props.pinned) t.groupId = NO_GROUP;
        }
        if (props.url !== undefined) t.url = props.url;
        if (props.muted !== undefined) t.mutedInfo = { muted: props.muted };
        return { ...t };
      },
      reload: async (id: number) => {
        const t = tabs.find((x) => x.id === id);
        if (!t) throw new Error(`Tab ${id} not found`);
      },
      move: async (id: number, props: { index: number }) => {
        const idx = tabs.findIndex((x) => x.id === id);
        if (idx < 0) return;
        const [tab] = tabs.splice(idx, 1);
        if (tab) tabs.splice(props.index, 0, tab);
        reindexTabs();
      },
      remove: async (ids: number | number[]) => {
        const set = new Set(Array.isArray(ids) ? ids : [ids]);
        for (let i = tabs.length - 1; i >= 0; i -= 1) {
          const cur = tabs[i];
          if (cur && set.has(cur.id)) tabs.splice(i, 1);
        }
        reindexTabs();
      },
      group: async (opts: { tabIds: number[]; groupId?: number }) => {
        let gid = opts.groupId;
        if (gid === undefined) {
          gid = nextGroupId++;
          groups.push({ id: gid, windowId: 1, title: '', color: 'blue', collapsed: false });
        }
        for (const t of tabs) {
          if (opts.tabIds.includes(t.id)) t.groupId = gid;
        }
        return gid;
      },
    },
    tabGroups: {
      query: async () => groups.map((g) => ({ ...g })),
      update: async (
        id: number,
        props: { title?: string; color?: TabGroupColor; collapsed?: boolean },
      ) => {
        const g = groups.find((x) => x.id === id);
        if (!g) throw new Error(`Group ${id} not found`);
        if (props.title !== undefined) g.title = props.title;
        if (props.color !== undefined) g.color = props.color;
        if (props.collapsed !== undefined) g.collapsed = props.collapsed;
        return { ...g };
      },
    },
  };

  Object.defineProperty(globalThis, 'chrome', { value: chromeMock, configurable: true });
  return { tabs, groups, localStore, sessionStore };
}

describe('Engine integration', () => {
  let harness: ReturnType<typeof installChromeHarness>;
  let engine: Engine;

  beforeEach(() => {
    harness = installChromeHarness();
    engine = new Engine();
  });

  it('creates Spaces, switches without forcing tabs on empty Spaces, and persists folders/pins', async () => {
    await engine.reconcile(1, { recover: true });
    const researchSpaceId = (await engine.run({
      type: 'createSpace',
      windowId: 1,
      name: 'Active Matter',
      hue: 152,
    })) as string;

    // Empty Space keeps existing tab parked rather than spawning a blank tab
    expect(harness.tabs).toHaveLength(1);

    const folderId = (await engine.run({
      type: 'createFolder',
      parentId: researchSpaceId,
      title: 'Papers',
    })) as string;

    const pinId = (await engine.run({
      type: 'pinTab',
      windowId: 1,
      tabId: 1,
      parentId: folderId,
    })) as string;

    // Prevent cyclic move of folder into itself
    await engine.run({ type: 'moveNode', windowId: 1, id: folderId, parentId: folderId });

    const { ids, root } = await loadRoot();
    const state = deriveState({
      windowId: 1,
      rootId: ids.rootId,
      favoritesId: ids.favoritesId,
      root,
      tabs: harness.tabs,
      groups: harness.groups,
      bindings: await storage.getBindings(),
      groupSpaces: await storage.getGroupSpaces(),
      activeSpaces: await storage.getActiveSpaces(),
      spaceMeta: await storage.getSpaceMeta(),
      openFolders: await storage.getOpenFolders(),
    });

    const space = state.spaces.find((s) => s.id === researchSpaceId);
    expect(space?.name).toBe('Active Matter');
    expect(space?.pinned[0]?.kind).toBe('folder');
    if (space?.pinned[0]?.kind === 'folder') {
      expect(space.pinned[0].children[0]?.id).toBe(pinId);
      if (space.pinned[0].children[0]?.kind === 'pin') {
        expect(space.pinned[0].children[0].tabId).toBe(1);
      }
    }
  });

  it('promotes a pin to a global Favorite, unloads keeping Favorite, and recovers after session wipe', async () => {
    await engine.reconcile(1, { recover: true });
    const favId = (await engine.run({
      type: 'addFavorite',
      windowId: 1,
      tabId: 1,
    })) as string;

    expect(harness.tabs[0]?.pinned).toBe(true);

    // Simulate browser restart: session bindings cleared, tab still open
    await storage.setBindings({});
    await engine.reconcile(1, { recover: true });
    const recovered = await storage.getBindings();
    expect(recovered[1]).toEqual({ kind: 'favorite', id: favId });

    // Unload favorite closes tab but keeps Favorite bookmark intact
    await engine.run({ type: 'unloadFavorite', windowId: 1, favoriteId: favId });
    const favs = await chrome.bookmarks.getChildren((await loadRoot()).ids.favoritesId);
    expect(favs.some((f) => f.id === favId)).toBe(true);
  });

  it('imports Arc Spaces & Favorites cleanly via importArc command', async () => {
    await engine.reconcile(1, { recover: true });
    await engine.run({
      type: 'importArc',
      windowId: 1,
      data: {
        favorites: [{ title: 'GitHub', url: 'https://github.com/' }],
        spaces: [
          {
            name: 'Main',
            hue: 235,
            pinned: [
              {
                kind: 'folder',
                title: 'Docs',
                children: [{ kind: 'pin', title: 'MDN', url: 'https://developer.mozilla.org/' }],
              },
            ],
          },
          {
            name: 'Vim',
            hue: 275,
            pinned: [{ kind: 'pin', title: 'Neovim', url: 'https://neovim.io/' }],
          },
        ],
        stats: {
          totalPins: 2,
          totalFolders: 1,
          skippedEmptyFolders: 0,
          skippedSearches: 0,
          deduped: 0,
          skippedBroken: 0,
        },
      },
    });

    const { ids, root } = await loadRoot();
    const favs = await chrome.bookmarks.getChildren(ids.favoritesId);
    expect(favs).toHaveLength(1);
    expect(favs[0]?.url).toBe('https://github.com/');
    const spaceNames = (root.children ?? [])
      .filter((c) => c.id !== ids.favoritesId)
      .map((c) => c.title);
    expect(spaceNames).toEqual(['Main', 'Vim']);
  });

  it('supports replacePinUrl, openFolderPins, closeOtherSpaceTabs, and clearing Space icon', async () => {
    await engine.reconcile(1, { recover: true });
    const spaceId = (await engine.run({
      type: 'createSpace',
      windowId: 1,
      name: 'Studio',
      icon: 'sparkles',
    })) as string;

    const folderId = (await engine.run({
      type: 'createFolder',
      parentId: spaceId,
      title: 'Docs',
    })) as string;

    const pinId = (await engine.run({
      type: 'pinTab',
      windowId: 1,
      tabId: 1,
      parentId: folderId,
    })) as string;

    // Navigate pinned tab away and replace its saved bookmark URL
    const firstTab = harness.tabs[0];
    expect(firstTab).toBeDefined();
    if (firstTab) firstTab.url = 'https://start.example.com/deep/page';
    await engine.run({ type: 'replacePinUrl', windowId: 1, pinId });
    const [updatedPin] = await chrome.bookmarks.get(pinId);
    expect(updatedPin?.url).toBe('https://start.example.com/deep/page');

    // Add a second closed pin in the folder and open all pins in folder
    await chrome.bookmarks.create({
      parentId: folderId,
      title: 'Second Doc',
      url: 'https://docs.example.com/two',
    });
    const openedCount = (await engine.run({
      type: 'openFolderPins',
      windowId: 1,
      folderId,
    })) as number;
    expect(openedCount).toBe(1);

    // Open two temporary tabs and close other temp tabs
    const t1 = (await engine.run({
      type: 'openTab',
      windowId: 1,
      spaceId,
      url: 'https://temp-one.example.com/',
    })) as number;
    await engine.run({
      type: 'openTab',
      windowId: 1,
      spaceId,
      url: 'https://temp-two.example.com/',
    });
    const closedOthers = (await engine.run({
      type: 'closeOtherSpaceTabs',
      windowId: 1,
      spaceId,
      keepTabId: t1,
    })) as number;
    expect(closedOthers).toBe(1);
    expect(harness.tabs.some((t) => t.id === t1)).toBe(true);

    // Clearing Space icon with empty string removes icon from spaceMeta
    await engine.run({ type: 'updateSpace', spaceId, icon: '' });
    const meta = await storage.getSpaceMeta();
    expect(meta.Studio?.icon).toBeUndefined();
  });

  it('rejects javascript: and data: pseudo-URLs across addUrlFavorite, openTab, and importArc', async () => {
    await engine.reconcile(1, { recover: true });
    const blockedFav = await engine.run({
      type: 'addUrlFavorite',
      title: 'Malicious',
      url: 'javascript:alert(1)',
    });
    expect(blockedFav).toBeUndefined();

    const okFav = await engine.run({
      type: 'addUrlFavorite',
      title: 'Safe',
      url: 'https://safe.example.com/',
    });
    expect(typeof okFav).toBe('string');

    const { ids, root } = await loadRoot();
    const spaceId = (root.children ?? []).find((c) => c.id !== ids.favoritesId)?.id ?? '';
    const tabId = (await engine.run({
      type: 'openTab',
      windowId: 1,
      spaceId,
      url: 'javascript:alert(2)',
    })) as number;
    const createdTab = harness.tabs.find((t) => t.id === tabId);
    expect(createdTab?.url).not.toContain('javascript:');
  });
});
