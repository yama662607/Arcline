import { mergeArchive, selectTabsToArchive } from '../core/archive';
import { groupColorForHue, nextHue } from '../core/colors';
import { isOverlayCapableUrl } from '../core/overlay-continuity';
import { findFavoriteUrlMatch } from '../core/shortcut-keys';
import {
  favoritesFolder,
  findBookmark,
  isSafeNavigableUrl,
  isSpaceFolder,
  pinsIn,
  spaceOfBookmark,
  tabUrl,
  uniqueName,
} from '../core/snapshot';
import type { ArchivedTab, Command, ImportedNode, TabInfo } from '../core/types';
import {
  activeSpaceOf,
  boundTab,
  boundTabIds,
  findSpace,
  groupSpaceOf,
  hueOf,
  loadContext,
  reloadRoot,
  reloadTabs,
  spaceOfTab,
  spaceTabs,
  temporaryTabs,
  type WindowContext,
} from './context';
import { collapseOtherSpaces, groupTabs, updateSpaceGroups } from './groups';
import { retry, SerialQueue } from './queue';
import { reconcile } from './reconcile';
import { ensureRoot } from './root';
import {
  dropTabActivity,
  getLastActiveTab,
  getParkedTab,
  parkTab,
  rememberActiveTab,
  rememberFolderOpen,
  setActiveSpace,
  setBinding,
  setLastPage,
  stampTabActivity,
  storage,
  unparkTab,
} from './storage';

async function activateTab(tabId: number): Promise<void> {
  await retry(() => chrome.tabs.update(tabId, { active: true }));
}

async function openTabInSpace(
  ctx: WindowContext,
  spaceId: string,
  url?: string,
  active = true,
): Promise<chrome.tabs.Tab> {
  const safeUrl = url && isSafeNavigableUrl(url) ? url.trim() : undefined;
  const resolvedUrl = safeUrl ?? buildEmptySpaceUrl(spaceId, false) ?? undefined;
  const tab = await chrome.tabs.create({ windowId: ctx.windowId, url: resolvedUrl, active });
  ctx.tabs.push(tab as TabInfo);
  if (tab.id !== undefined) {
    await groupTabs(ctx, spaceId, [tab.id]);
  }
  return tab;
}

async function keepActiveInSpace(ctx: WindowContext, closingIds: number[]): Promise<void> {
  const active = ctx.tabs.find((t) => t.active);
  if (active?.id === undefined || !closingIds.includes(active.id)) return;
  const spaceId = activeSpaceOf(ctx);
  const remaining = spaceTabs(ctx, spaceId).filter(
    (t): t is TabInfo & { id: number } => t.id !== undefined && !closingIds.includes(t.id),
  );
  const next = remaining.at(-1);
  if (next) {
    await activateTab(next.id);
    return;
  }
  const fav = ctx.tabs.find(
    (t): t is TabInfo & { id: number } =>
      t.id !== undefined && Boolean(t.pinned) && !closingIds.includes(t.id),
  );
  if (fav) {
    await activateTab(fav.id);
    return;
  }
  await openTabInSpace(ctx, spaceId);
}

async function leaveFavorites(ctx: WindowContext, tab: TabInfo): Promise<void> {
  const tabId = tab.id;
  if (tabId === undefined) return;
  const binding = ctx.bindings[tabId];
  if (binding?.kind === 'favorite') {
    ctx.bindings = await setBinding(tabId, undefined);
    await chrome.bookmarks.remove(binding.id).catch(() => undefined);
  }
  if (tab.pinned) {
    await retry(() => chrome.tabs.update(tabId, { pinned: false }));
  }
}

async function placeTab(
  ctx: WindowContext,
  tabId: number,
  spaceId: string,
  index?: number,
): Promise<void> {
  await groupTabs(ctx, spaceId, [tabId]);
  await reloadTabs(ctx);
  const moving = ctx.tabs.find((t) => t.id === tabId);
  if (!moving || moving.index === undefined || index === undefined) return;
  const others = temporaryTabs(ctx, spaceId).filter((t) => t.id !== tabId);
  const anchor = others[index];
  const last = others.at(-1);
  let target: number | undefined;
  if (anchor?.index !== undefined) {
    target = moving.index < anchor.index ? anchor.index - 1 : anchor.index;
  } else if (last?.index !== undefined && moving.index <= last.index) {
    target = last.index;
  }
  if (target !== undefined && target !== moving.index) {
    await retry(() => chrome.tabs.move(tabId, { index: target }));
  }
}

function isEmptySpacePageUrl(url?: string): boolean {
  if (!url) return false;
  return url.includes('/empty-space.html');
}

function buildEmptySpaceUrl(
  spaceId: string,
  openOverlay: boolean,
  commandBar = false,
): string | null {
  const getUrl = chrome.runtime?.getURL;
  if (typeof getUrl !== 'function') return null;
  const base = getUrl('empty-space.html');
  const params = new URLSearchParams({ spaceId });
  if (openOverlay) params.set('openOverlay', '1');
  if (commandBar) params.set('commandBar', '1');
  return `${base}?${params.toString()}`;
}

function notifyOverlayOpen(tabId: number): void {
  if (typeof chrome.tabs.sendMessage !== 'function') return;
  chrome.tabs.sendMessage(tabId, { arclineOverlay: 'open' }).catch(() => undefined);
  // Second delivery after a short micro-delay handles tabs that were discarded or still finishing load
  setTimeout(() => {
    chrome.tabs.sendMessage(tabId, { arclineOverlay: 'open' }).catch(() => undefined);
  }, 110);
}

async function switchSpace(
  ctx: WindowContext,
  spaceId: string,
  options: { open?: boolean; keepOverlayOpen?: boolean; allowEmptyPage?: boolean } = {},
): Promise<void> {
  if (!findSpace(ctx, spaceId)) return;
  const previous = activeSpaceOf(ctx);
  const activeTab = ctx.tabs.find((t) => t.active);
  if (
    activeTab?.id !== undefined &&
    previous !== spaceId &&
    spaceOfTab(ctx, activeTab) === previous
  ) {
    await rememberActiveTab(ctx.windowId, previous, activeTab.id);
  }
  await setActiveSpace(ctx.windowId, spaceId);

  const tabs = spaceTabs(ctx, spaceId);
  const remembered = await getLastActiveTab(ctx.windowId, spaceId);
  const target =
    tabs.find((t) => t.id === remembered) ?? temporaryTabs(ctx, spaceId).at(-1) ?? tabs.at(-1);

  if (target?.id !== undefined) {
    await unparkTab(ctx.windowId);
    await activateTab(target.id);
    if (options.keepOverlayOpen) {
      notifyOverlayOpen(target.id);
    }
  } else if (options.open || activeTab?.id === undefined) {
    await openTabInSpace(ctx, spaceId);
  } else {
    const settings = await storage.getSettings();
    const emptyUrl =
      options.allowEmptyPage !== false && settings.openEmptySpacePage
        ? buildEmptySpaceUrl(spaceId, Boolean(options.keepOverlayOpen))
        : null;
    if (emptyUrl) {
      // Reuse an existing empty-space color page tab if the user was already on one
      const reusableEmptyTab = ctx.tabs.find(
        (t) => t.id !== undefined && isEmptySpacePageUrl(tabUrl(t)),
      );
      if (reusableEmptyTab?.id !== undefined) {
        await unparkTab(ctx.windowId);
        await groupTabs(ctx, spaceId, [reusableEmptyTab.id]);
        await retry(() =>
          chrome.tabs.update(reusableEmptyTab.id as number, { url: emptyUrl, active: true }),
        );
      } else {
        await unparkTab(ctx.windowId);
        await openTabInSpace(ctx, spaceId, emptyUrl, true);
      }
    } else {
      await parkTab(ctx.windowId, activeTab.id);
      if (options.keepOverlayOpen && activeTab.id !== undefined) {
        notifyOverlayOpen(activeTab.id);
      }
    }
  }
  await collapseOtherSpaces(ctx, spaceId);
}

async function moveBookmarkSafe(id: string, parentId: string, index?: number): Promise<void> {
  const [node] = await chrome.bookmarks.get(id);
  if (!node) return;
  let targetIndex = index;
  if (
    targetIndex !== undefined &&
    node.parentId === parentId &&
    node.index !== undefined &&
    node.index < targetIndex
  ) {
    targetIndex -= 1;
  }
  const children = await chrome.bookmarks.getChildren(parentId);
  const maxIndex = node.parentId === parentId ? Math.max(0, children.length - 1) : children.length;
  if (targetIndex !== undefined) {
    targetIndex = Math.max(0, Math.min(targetIndex, maxIndex));
  }
  await chrome.bookmarks.move(id, { parentId, index: targetIndex });
}

async function deleteBookmarkCascade(windowId: number, id: string): Promise<void> {
  const ctx = await loadContext(windowId);
  const node = findBookmark(ctx.root, id);
  if (!node) return;
  const affectedPinIds = new Set(pinsIn(node).map((p) => p.id));
  affectedPinIds.add(id);

  // Close bound tabs across all windows before removing bookmark
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  for (const win of windows) {
    if (win.id === undefined) continue;
    const wctx = await loadContext(win.id);
    const closingIds: number[] = [];
    for (const pinId of affectedPinIds) {
      closingIds.push(...boundTabIds(wctx, pinId));
    }
    if (closingIds.length > 0) {
      await keepActiveInSpace(wctx, closingIds);
      await retry(() => chrome.tabs.remove(closingIds)).catch(() => undefined);
      for (const tid of closingIds) {
        await setBinding(tid, undefined);
      }
    }
  }

  if (node.url !== undefined) {
    await chrome.bookmarks.remove(id).catch(() => undefined);
  } else {
    await chrome.bookmarks.removeTree(id).catch(() => undefined);
  }
}

async function importNodesRecursive(parentId: string, nodes: ImportedNode[]): Promise<void> {
  for (const node of nodes) {
    if (node.kind === 'pin') {
      if (!isSafeNavigableUrl(node.url)) continue;
      await chrome.bookmarks.create({ parentId, title: node.title, url: node.url.trim() });
    } else {
      const folder = await chrome.bookmarks.create({ parentId, title: node.title });
      await importNodesRecursive(folder.id, node.children);
    }
  }
}

export class Engine {
  private queue = new SerialQueue();
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private allTimer: ReturnType<typeof setTimeout> | undefined;

  run(command: Command): Promise<unknown> {
    return this.queue.run(() => this.execute(command));
  }

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    return this.queue.run(task);
  }

  reconcile(windowId: number, options?: { recover?: boolean }): Promise<void> {
    return this.enqueue(() => reconcile(windowId, options));
  }

  async reconcileAll(options: { recover?: boolean } = {}): Promise<void> {
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    for (const win of windows) {
      if (win.id !== undefined) await this.reconcile(win.id, options);
    }
  }

  scheduleReconcile(windowId: number | undefined, delay = 60): void {
    if (windowId === undefined || windowId < 0) return;
    const prev = this.timers.get(windowId);
    if (prev) clearTimeout(prev);
    this.timers.set(
      windowId,
      setTimeout(() => {
        this.timers.delete(windowId);
        this.reconcile(windowId).catch((err) => console.warn('[Arcline] reconcile failed', err));
      }, delay),
    );
  }

  scheduleReconcileAll(delay = 80): void {
    if (this.allTimer) clearTimeout(this.allTimer);
    this.allTimer = setTimeout(() => {
      this.allTimer = undefined;
      this.reconcileAll().catch((err) => console.warn('[Arcline] reconcileAll failed', err));
    }, delay);
  }

  onTabActivated(tabId: number, windowId: number): Promise<void> {
    return this.enqueue(async () => {
      await stampTabActivity([tabId]);
      const parked = await getParkedTab(windowId);
      const unparked =
        parked !== undefined && parked !== tabId && (await unparkTab(windowId)) !== undefined;
      const ctx = await loadContext(windowId);
      const tab = ctx.tabs.find((t) => t.id === tabId);
      const spaceId = tab ? spaceOfTab(ctx, tab) : undefined;
      if (spaceId) await rememberActiveTab(windowId, spaceId, tabId);
      if (spaceId && spaceId !== activeSpaceOf(ctx)) {
        this.scheduleReconcile(windowId, 0);
      } else if (unparked) {
        await collapseOtherSpaces(ctx, activeSpaceOf(ctx));
      }
    });
  }

  onTabUpdated(tabId: number, url: string | undefined): Promise<void> {
    if (!url) return Promise.resolve();
    return this.enqueue(async () => {
      await stampTabActivity([tabId]);
      const bindings = await storage.getBindings();
      const binding = bindings[tabId];
      if (binding) {
        await setLastPage(binding.id, url);
      }
    });
  }

  onTabRemoved(tabId: number): Promise<void> {
    return this.enqueue(async () => {
      await setBinding(tabId, undefined);
      await dropTabActivity(tabId);
    });
  }

  private async execute(cmd: Command): Promise<unknown> {
    switch (cmd.type) {
      case 'reconcile':
        return reconcile(cmd.windowId, { recover: cmd.recover });

      case 'switchSpace':
        return switchSpace(await loadContext(cmd.windowId), cmd.spaceId, {
          keepOverlayOpen: cmd.keepOverlayOpen,
          allowEmptyPage: true,
        });

      case 'shiftSpace': {
        const ctx = await loadContext(cmd.windowId);
        if (ctx.spaces.length < 2) return;
        const idx = ctx.spaces.findIndex((s) => s.id === activeSpaceOf(ctx));
        const next = ctx.spaces[(idx + cmd.offset + ctx.spaces.length) % ctx.spaces.length];
        if (next) {
          return switchSpace(ctx, next.id, {
            keepOverlayOpen: cmd.keepOverlayOpen,
            allowEmptyPage: true,
          });
        }
        return;
      }

      case 'createSpace': {
        const ctx = await loadContext(cmd.windowId);
        const title = uniqueName(
          cmd.name,
          ctx.spaces.map((s) => s.title),
        );
        const hue = cmd.hue ?? nextHue(ctx.spaces.map((s) => hueOf(ctx, s.id)));
        await storage.setSpaceMeta({
          ...ctx.spaceMeta,
          [title]: { hue, icon: cmd.icon },
        });
        const folder = await chrome.bookmarks.create({ parentId: ctx.ids.rootId, title });
        await switchSpace(await loadContext(cmd.windowId), folder.id, { allowEmptyPage: false });
        return folder.id;
      }

      case 'updateSpace': {
        const lastFocused = await chrome.windows.getLastFocused();
        const winId = lastFocused.id;
        if (winId === undefined) return;
        const ctx = await loadContext(winId);
        const space = findSpace(ctx, cmd.spaceId);
        if (!space) return;
        const nextTitle = cmd.name?.trim()
          ? cmd.name.trim() === space.title
            ? space.title
            : uniqueName(
                cmd.name.trim(),
                ctx.spaces.filter((s) => s.id !== cmd.spaceId).map((s) => s.title),
              )
          : space.title;
        const prevMeta = ctx.spaceMeta[space.title] ?? { hue: hueOf(ctx, cmd.spaceId) };
        const nextIcon =
          cmd.icon === '' ? undefined : cmd.icon !== undefined ? cmd.icon : prevMeta.icon;
        const nextMeta = {
          hue: cmd.hue ?? prevMeta.hue,
          icon: nextIcon,
          theme: cmd.theme !== undefined ? cmd.theme : prevMeta.theme,
        };
        const updatedMeta = { ...ctx.spaceMeta };
        delete updatedMeta[space.title];
        updatedMeta[nextTitle] = nextMeta;
        await storage.setSpaceMeta(updatedMeta);
        if (nextTitle !== space.title) {
          await chrome.bookmarks.update(cmd.spaceId, { title: nextTitle });
        }
        await updateSpaceGroups(cmd.spaceId, {
          title: nextTitle,
          color: groupColorForHue(nextMeta.hue),
        });
        return;
      }

      case 'deleteSpace': {
        const ctx = await loadContext(cmd.windowId);
        const idx = ctx.spaces.findIndex((s) => s.id === cmd.spaceId);
        const doomed = ctx.spaces[idx];
        if (!doomed || ctx.spaces.length <= 1) return;
        const others = ctx.spaces.filter((s) => s.id !== cmd.spaceId);
        const fallback = others[idx] ?? others[idx - 1] ?? others[0];
        if (!fallback) return;

        const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
        for (const win of windows) {
          if (win.id === undefined) continue;
          const wctx = await loadContext(win.id);
          if (activeSpaceOf(wctx) === cmd.spaceId) {
            await switchSpace(wctx, fallback.id, { open: true });
          }
          const tabIds = spaceTabs(await loadContext(win.id), cmd.spaceId)
            .map((t) => t.id)
            .filter((id): id is number => id !== undefined);
          if (tabIds.length > 0) {
            await retry(() => chrome.tabs.remove(tabIds)).catch(() => undefined);
          }
        }

        const meta = { ...(await storage.getSpaceMeta()) };
        delete meta[doomed.title];
        await storage.setSpaceMeta(meta);
        await chrome.bookmarks.removeTree(cmd.spaceId);
        return;
      }

      case 'moveSpace': {
        const ids = await ensureRoot();
        const children = await chrome.bookmarks.getChildren(ids.rootId);
        const spaces = children.filter((n) => isSpaceFolder(n, ids.favoritesId));
        const target = spaces[cmd.index];
        if (!target || target.id === cmd.spaceId) return;
        await moveBookmarkSafe(cmd.spaceId, ids.rootId, target.index);
        return;
      }

      case 'openFavorite': {
        const ctx = await loadContext(cmd.windowId);
        const existing = boundTab(ctx, cmd.favoriteId);
        if (existing?.id !== undefined) {
          await activateTab(existing.id);
          return existing.id;
        }
        const fav = findBookmark(ctx.root, cmd.favoriteId);
        if (!isSafeNavigableUrl(fav?.url)) return;
        const tab = await chrome.tabs.create({
          windowId: cmd.windowId,
          url: fav.url,
          pinned: true,
          active: true,
        });
        if (tab.id !== undefined) {
          await setBinding(tab.id, { kind: 'favorite', id: fav.id });
          await setLastPage(fav.id, fav.url);
        }
        return tab.id;
      }

      case 'addFavorite': {
        const ctx = await loadContext(cmd.windowId);
        const binding = ctx.bindings[cmd.tabId];
        if (binding?.kind === 'pin') {
          return this.execute({
            type: 'favoritePin',
            windowId: cmd.windowId,
            pinId: binding.id,
            index: cmd.index,
          });
        }
        const tab = ctx.tabs.find((t) => t.id === cmd.tabId);
        const url = tab && tabUrl(tab);
        if (!tab || !isSafeNavigableUrl(url)) return;
        const created = await chrome.bookmarks.create({
          parentId: ctx.ids.favoritesId,
          index: cmd.index,
          title: tab.title || url,
          url,
        });
        await setBinding(cmd.tabId, { kind: 'favorite', id: created.id });
        await setLastPage(created.id, url);
        await retry(() => chrome.tabs.update(cmd.tabId, { pinned: true }));
        return created.id;
      }

      case 'addUrlFavorite': {
        if (!isSafeNavigableUrl(cmd.url)) return;
        const safeUrl = cmd.url.trim();
        const ids = await ensureRoot();
        const created = await chrome.bookmarks.create({
          parentId: ids.favoritesId,
          index: cmd.index,
          title: cmd.title || safeUrl,
          url: safeUrl,
        });
        return created.id;
      }

      case 'favoritePin': {
        const ctx = await loadContext(cmd.windowId);
        await moveBookmarkSafe(cmd.pinId, ctx.ids.favoritesId, cmd.index);
        for (const tabId of boundTabIds(ctx, cmd.pinId)) {
          await setBinding(tabId, { kind: 'favorite', id: cmd.pinId });
          await retry(() => chrome.tabs.update(tabId, { pinned: true })).catch(() => undefined);
        }
        return cmd.pinId;
      }

      case 'openFavoriteByUrl': {
        const ctx = await loadContext(cmd.windowId);
        const favFolder = favoritesFolder(ctx.root, ctx.ids.favoritesId);
        const favs = (favFolder?.children ?? []).flatMap((n) =>
          typeof n.url === 'string' ? [{ id: n.id, url: n.url }] : [],
        );
        const match = findFavoriteUrlMatch(favs, cmd.url);
        if (match) {
          return this.execute({
            type: 'openFavorite',
            windowId: cmd.windowId,
            favoriteId: match.id,
          });
        }
        if (isSafeNavigableUrl(cmd.url)) {
          await openTabInSpace(ctx, activeSpaceOf(ctx), cmd.url, true);
        }
        return;
      }

      case 'unloadFavorite': {
        const ctx = await loadContext(cmd.windowId);
        const tabId = boundTab(ctx, cmd.favoriteId)?.id;
        if (tabId === undefined) return;
        await keepActiveInSpace(ctx, [tabId]);
        await retry(() => chrome.tabs.remove(tabId));
        await setBinding(tabId, undefined);
        return;
      }

      case 'resetFavorite': {
        const ctx = await loadContext(cmd.windowId);
        const tabId = boundTab(ctx, cmd.favoriteId)?.id;
        const url = findBookmark(ctx.root, cmd.favoriteId)?.url;
        if (tabId !== undefined && isSafeNavigableUrl(url)) {
          await retry(() => chrome.tabs.update(tabId, { url }));
        }
        return;
      }

      case 'replaceFavoriteUrl': {
        const ctx = await loadContext(cmd.windowId);
        const tab = boundTab(ctx, cmd.favoriteId);
        const nextUrl = tab && tabUrl(tab);
        if (!isSafeNavigableUrl(nextUrl)) return;
        await chrome.bookmarks.update(cmd.favoriteId, { url: nextUrl });
        await setLastPage(cmd.favoriteId, nextUrl);
        return;
      }

      case 'removeFavorite':
        return deleteBookmarkCascade(cmd.windowId, cmd.favoriteId);

      case 'moveFavorite': {
        const ids = await ensureRoot();
        await moveBookmarkSafe(cmd.favoriteId, ids.favoritesId, cmd.index);
        return;
      }

      case 'openPin': {
        const ctx = await loadContext(cmd.windowId);
        const existing = boundTab(ctx, cmd.pinId);
        if (existing?.id !== undefined) {
          await activateTab(existing.id);
          return existing.id;
        }
        const pin = findBookmark(ctx.root, cmd.pinId);
        const spaceId = spaceOfBookmark(ctx.root, ctx.ids.favoritesId, cmd.pinId);
        if (!isSafeNavigableUrl(pin?.url) || !spaceId) return;
        const tab = await chrome.tabs.create({
          windowId: cmd.windowId,
          url: pin.url,
          active: true,
        });
        ctx.tabs.push(tab as TabInfo);
        if (tab.id !== undefined) {
          await setBinding(tab.id, { kind: 'pin', id: pin.id });
          await setLastPage(pin.id, pin.url);
          await groupTabs(ctx, spaceId, [tab.id]);
        }
        if (spaceId !== activeSpaceOf(ctx)) {
          await setActiveSpace(ctx.windowId, spaceId);
          await collapseOtherSpaces(ctx, spaceId);
        }
        return tab.id;
      }

      case 'unloadPin': {
        const ctx = await loadContext(cmd.windowId);
        const tabId = boundTab(ctx, cmd.pinId)?.id;
        if (tabId === undefined) return;
        await keepActiveInSpace(ctx, [tabId]);
        await retry(() => chrome.tabs.remove(tabId));
        await setBinding(tabId, undefined);
        return;
      }

      case 'resetPin': {
        const ctx = await loadContext(cmd.windowId);
        const tabId = boundTab(ctx, cmd.pinId)?.id;
        const url = findBookmark(ctx.root, cmd.pinId)?.url;
        if (tabId !== undefined && isSafeNavigableUrl(url)) {
          await retry(() => chrome.tabs.update(tabId, { url }));
        }
        return;
      }

      case 'replacePinUrl': {
        const ctx = await loadContext(cmd.windowId);
        const tab = boundTab(ctx, cmd.pinId);
        const nextUrl = tab && tabUrl(tab);
        if (!isSafeNavigableUrl(nextUrl)) return;
        await chrome.bookmarks.update(cmd.pinId, { url: nextUrl });
        await setLastPage(cmd.pinId, nextUrl);
        return;
      }

      case 'pinTab': {
        const ctx = await loadContext(cmd.windowId);
        const tab = ctx.tabs.find((t) => t.id === cmd.tabId);
        const url = tab && tabUrl(tab);
        if (!tab || !isSafeNavigableUrl(url)) return;
        await leaveFavorites(ctx, tab);
        const created = await chrome.bookmarks.create({
          parentId: cmd.parentId,
          index: cmd.index,
          title: tab.title || url,
          url,
        });
        await setBinding(cmd.tabId, { kind: 'pin', id: created.id });
        await setLastPage(created.id, url);
        await reloadRoot(ctx);
        const spaceId = spaceOfBookmark(ctx.root, ctx.ids.favoritesId, created.id);
        const groupSpace = groupSpaceOf(ctx, tab.groupId);
        if (spaceId && spaceId !== groupSpace) {
          await groupTabs(ctx, spaceId, [cmd.tabId]);
        }
        return created.id;
      }

      case 'unpin': {
        const ctx = await loadContext(cmd.windowId);
        const pin = findBookmark(ctx.root, cmd.pinId);
        if (!isSafeNavigableUrl(pin?.url)) return;
        let tabId = boundTab(ctx, cmd.pinId)?.id;
        if (tabId === undefined) {
          const tab = await chrome.tabs.create({
            windowId: cmd.windowId,
            url: pin.url,
            active: false,
          });
          ctx.tabs.push(tab as TabInfo);
          tabId = tab.id;
        }
        for (const id of boundTabIds(ctx, cmd.pinId)) {
          await setBinding(id, undefined);
        }
        await chrome.bookmarks.remove(cmd.pinId);
        await reloadRoot(ctx);
        if (tabId !== undefined) {
          await placeTab(ctx, tabId, cmd.spaceId, cmd.index);
        }
        return;
      }

      case 'togglePin': {
        const ctx = await loadContext(cmd.windowId);
        const binding = ctx.bindings[cmd.tabId];
        if (binding?.kind === 'favorite') {
          return deleteBookmarkCascade(cmd.windowId, binding.id);
        }
        const pinSpace =
          binding?.kind === 'pin'
            ? spaceOfBookmark(ctx.root, ctx.ids.favoritesId, binding.id)
            : undefined;
        if (binding?.kind === 'pin' && pinSpace) {
          return this.execute({
            type: 'unpin',
            windowId: cmd.windowId,
            pinId: binding.id,
            spaceId: pinSpace,
          });
        }
        const tab = ctx.tabs.find((t) => t.id === cmd.tabId);
        const spaceId = (tab && spaceOfTab(ctx, tab)) || activeSpaceOf(ctx);
        return this.execute({
          type: 'pinTab',
          windowId: cmd.windowId,
          tabId: cmd.tabId,
          parentId: spaceId,
        });
      }

      case 'createFolder': {
        const folder = await chrome.bookmarks.create({
          parentId: cmd.parentId,
          index: cmd.index,
          title: cmd.title.trim() || 'New Folder',
        });
        await rememberFolderOpen(folder.id);
        return folder.id;
      }

      case 'openFolderPins': {
        const ctx = await loadContext(cmd.windowId);
        const folder = findBookmark(ctx.root, cmd.folderId);
        const spaceId = spaceOfBookmark(ctx.root, ctx.ids.favoritesId, cmd.folderId);
        if (!folder || !spaceId) return 0;
        const folderPins = pinsIn(folder);
        let opened = 0;
        const createdIds: number[] = [];
        for (const pin of folderPins) {
          if (!isSafeNavigableUrl(pin.url) || boundTab(ctx, pin.id)) continue;
          const tab = await chrome.tabs.create({
            windowId: cmd.windowId,
            url: pin.url,
            active: false,
          });
          ctx.tabs.push(tab as TabInfo);
          if (tab.id !== undefined) {
            await setBinding(tab.id, { kind: 'pin', id: pin.id });
            await setLastPage(pin.id, pin.url);
            createdIds.push(tab.id);
            opened += 1;
          }
        }
        if (createdIds.length > 0) {
          await groupTabs(ctx, spaceId, createdIds);
        }
        return opened;
      }

      case 'renameBookmark': {
        const title = cmd.title.trim();
        if (!title) return;
        await chrome.bookmarks.update(cmd.id, { title });
        return;
      }

      case 'deleteBookmark':
        return deleteBookmarkCascade(cmd.windowId, cmd.id);

      case 'moveNode': {
        const ctx = await loadContext(cmd.windowId);
        if (cmd.id === cmd.parentId) return;
        const movingNode = findBookmark(ctx.root, cmd.id);
        if (!movingNode) return;
        // Prevent moving a folder into one of its own descendants
        if (findBookmark(movingNode, cmd.parentId)) return;

        await moveBookmarkSafe(cmd.id, cmd.parentId, cmd.index);
        await reloadRoot(ctx);

        const targetIsFavorites = cmd.parentId === ctx.ids.favoritesId;
        const targetSpaceId = spaceOfBookmark(ctx.root, ctx.ids.favoritesId, cmd.id);
        const affectedPins = pinsIn(movingNode);
        for (const pin of affectedPins) {
          for (const tabId of boundTabIds(ctx, pin.id)) {
            if (targetIsFavorites) {
              await setBinding(tabId, { kind: 'favorite', id: pin.id });
              await retry(() => chrome.tabs.update(tabId, { pinned: true })).catch(() => undefined);
            } else if (targetSpaceId) {
              const tab = ctx.tabs.find((t) => t.id === tabId);
              if (tab?.pinned) {
                await retry(() => chrome.tabs.update(tabId, { pinned: false })).catch(
                  () => undefined,
                );
              }
              await setBinding(tabId, { kind: 'pin', id: pin.id });
              await groupTabs(ctx, targetSpaceId, [tabId]);
            }
          }
        }
        return;
      }

      case 'openTab': {
        const ctx = await loadContext(cmd.windowId);
        if (!cmd.url) {
          const settings = await storage.getSettings();
          const activeTab = ctx.tabs.find((t) => t.active);
          const activeUrl = activeTab ? tabUrl(activeTab) : undefined;
          const canShowModal =
            settings.commandBarOpenMode === 'popup' &&
            activeTab?.id !== undefined &&
            typeof chrome.tabs.sendMessage === 'function' &&
            (isOverlayCapableUrl(activeUrl) || isEmptySpacePageUrl(activeUrl));
          if (canShowModal && activeTab?.id !== undefined) {
            try {
              await chrome.tabs.sendMessage(activeTab.id, { arclineCommandBar: 'open' });
              if (cmd.spaceId !== activeSpaceOf(ctx)) {
                await setActiveSpace(ctx.windowId, cmd.spaceId);
                await collapseOtherSpaces(ctx, cmd.spaceId);
              }
              return activeTab.id;
            } catch {
              // Content script not ready (e.g. tab loaded before extension install); fall back below
            }
          }
          const fallbackUrl = buildEmptySpaceUrl(cmd.spaceId, false, true) ?? undefined;
          const tab = await openTabInSpace(ctx, cmd.spaceId, fallbackUrl, true);
          if (cmd.spaceId !== activeSpaceOf(ctx)) {
            await setActiveSpace(ctx.windowId, cmd.spaceId);
            await collapseOtherSpaces(ctx, cmd.spaceId);
          }
          return tab.id;
        }
        const tab = await openTabInSpace(ctx, cmd.spaceId, cmd.url, true);
        if (cmd.spaceId !== activeSpaceOf(ctx)) {
          await setActiveSpace(ctx.windowId, cmd.spaceId);
          await collapseOtherSpaces(ctx, cmd.spaceId);
        }
        return tab.id;
      }

      case 'activateTab': {
        await activateTab(cmd.tabId);
        return;
      }

      case 'reloadTab': {
        await retry(() => chrome.tabs.reload(cmd.tabId));
        return;
      }

      case 'duplicateTab': {
        const ctx = await loadContext(cmd.windowId);
        const orig = ctx.tabs.find((t) => t.id === cmd.tabId);
        const url = orig && tabUrl(orig);
        if (!orig || !url) return;
        const spaceId = spaceOfTab(ctx, orig) || activeSpaceOf(ctx);
        const created = await openTabInSpace(ctx, spaceId, url, true);
        return created.id;
      }

      case 'closeTab': {
        const ctx = await loadContext(cmd.windowId);
        await keepActiveInSpace(ctx, [cmd.tabId]);
        await retry(() => chrome.tabs.remove(cmd.tabId)).catch(() => undefined);
        await setBinding(cmd.tabId, undefined);
        await dropTabActivity(cmd.tabId);
        return;
      }

      case 'closeOtherSpaceTabs': {
        const ctx = await loadContext(cmd.windowId);
        const ids = temporaryTabs(ctx, cmd.spaceId)
          .map((t) => t.id)
          .filter((id): id is number => id !== undefined && id !== cmd.keepTabId);
        if (ids.length === 0) return 0;
        await keepActiveInSpace(ctx, ids);
        await retry(() => chrome.tabs.remove(ids)).catch(() => undefined);
        return ids.length;
      }

      case 'moveTab': {
        const ctx = await loadContext(cmd.windowId);
        const tab = ctx.tabs.find((t) => t.id === cmd.tabId);
        if (!tab) return;
        await leaveFavorites(ctx, tab);
        await placeTab(ctx, cmd.tabId, cmd.spaceId, cmd.index);
        return;
      }

      case 'clearSpaceTabs': {
        const ctx = await loadContext(cmd.windowId);
        const ids = temporaryTabs(ctx, cmd.spaceId)
          .map((t) => t.id)
          .filter((id): id is number => id !== undefined);
        if (ids.length === 0) return;
        await keepActiveInSpace(ctx, ids);
        await retry(() => chrome.tabs.remove(ids)).catch(() => undefined);
        return;
      }

      case 'toggleMuteTab': {
        const tab = await chrome.tabs.get(cmd.tabId).catch(() => undefined);
        if (!tab) return;
        await retry(() => chrome.tabs.update(cmd.tabId, { muted: !tab.mutedInfo?.muted }));
        return;
      }

      case 'restoreArchived': {
        const archived = await storage.getArchivedTabs();
        const entry = archived.find((a) => a.id === cmd.archiveId);
        if (!entry) return;
        const ctx = await loadContext(cmd.windowId);
        await openTabInSpace(ctx, cmd.spaceId, entry.url, true);
        await storage.setArchivedTabs(archived.filter((a) => a.id !== cmd.archiveId));
        return;
      }

      case 'removeArchived': {
        const archived = await storage.getArchivedTabs();
        await storage.setArchivedTabs(archived.filter((a) => a.id !== cmd.archiveId));
        return;
      }

      case 'clearArchive': {
        await storage.setArchivedTabs([]);
        return;
      }

      case 'closeNativeSidePanel':
        return;

      case 'runAutoArchive': {
        const settings = await storage.getSettings();
        if (settings.autoArchiveHours <= 0) return 0;
        const activity = await storage.getTabActivity();
        const nowMs = Date.now();
        const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
        const incoming: ArchivedTab[] = [];

        for (const win of windows) {
          if (win.id === undefined) continue;
          const ctx = await loadContext(win.id);
          const stale = selectTabsToArchive({
            tabs: ctx.tabs,
            bindings: ctx.bindings,
            activity,
            nowMs,
            thresholdHours: settings.autoArchiveHours,
          });
          if (stale.length === 0) continue;
          const ids = stale.map((t) => t.id);
          for (const t of stale) {
            const spId = spaceOfTab(ctx, t);
            const spName = (spId && findSpace(ctx, spId)?.title) || 'Space';
            incoming.push({
              id: `${t.id}-${nowMs}`,
              url: t.url,
              title: t.title || t.url,
              spaceName: spName,
              archivedAt: nowMs,
            });
          }
          await retry(() => chrome.tabs.remove(ids)).catch(() => undefined);
          for (const id of ids) await dropTabActivity(id);
        }

        if (incoming.length > 0) {
          const existing = await storage.getArchivedTabs();
          await storage.setArchivedTabs(mergeArchive(existing, incoming));
        }
        return incoming.length;
      }

      case 'importArc': {
        const ctx = await loadContext(cmd.windowId);
        // 1. Import Favorites (avoiding exact URL duplicates already in Favorites)
        const existingFavs = await chrome.bookmarks.getChildren(ctx.ids.favoritesId);
        const existingFavUrls = new Set(existingFavs.map((f) => f.url).filter(Boolean));
        for (const fav of cmd.data.favorites) {
          if (!isSafeNavigableUrl(fav.url)) continue;
          const safeUrl = fav.url.trim();
          if (existingFavUrls.has(safeUrl)) continue;
          existingFavUrls.add(safeUrl);
          await chrome.bookmarks.create({
            parentId: ctx.ids.favoritesId,
            title: fav.title,
            url: safeUrl,
          });
        }

        // 2. Import Spaces (merging into matching Space name if empty default, else creating)
        const nextMeta = { ...ctx.spaceMeta };
        const existingNames = new Set(ctx.spaces.map((s) => s.title));

        for (const sp of cmd.data.spaces) {
          let targetSpaceId: string | undefined;
          const matchingExisting = ctx.spaces.find((s) => s.title === sp.name);
          if (matchingExisting && (matchingExisting.children?.length ?? 0) === 0) {
            targetSpaceId = matchingExisting.id;
          } else {
            const title = existingNames.has(sp.name)
              ? uniqueName(sp.name, Array.from(existingNames))
              : sp.name;
            existingNames.add(title);
            const created = await chrome.bookmarks.create({
              parentId: ctx.ids.rootId,
              title,
            });
            targetSpaceId = created.id;
            if (sp.hue !== undefined || sp.icon !== undefined || sp.theme !== undefined) {
              nextMeta[title] = {
                hue: sp.hue ?? nextMeta[title]?.hue ?? 235,
                icon: sp.icon,
                theme: sp.theme,
              };
            }
          }
          if (
            (sp.hue !== undefined || sp.icon !== undefined || sp.theme !== undefined) &&
            matchingExisting
          ) {
            nextMeta[matchingExisting.title] = {
              hue: sp.hue ?? nextMeta[matchingExisting.title]?.hue ?? 235,
              icon: sp.icon ?? nextMeta[matchingExisting.title]?.icon,
              theme: sp.theme ?? nextMeta[matchingExisting.title]?.theme,
            };
          }
          await importNodesRecursive(targetSpaceId, sp.pinned);
        }

        await storage.setSpaceMeta(nextMeta);
        await reconcile(cmd.windowId, { recover: true });
        return { ok: true };
      }
    }
  }
}
