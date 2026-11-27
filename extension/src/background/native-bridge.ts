import { SITE_SEARCHES } from '../core/command-bar';
import { sanitizeCustomSiteSearch } from '../core/settings';
import { findFavoriteUrlMatch } from '../core/shortcut-keys';
import { isSafeNavigableUrl, spaceFolders } from '../core/snapshot';
import type { BookmarkNode, CustomSiteSearch } from '../core/types';
import type { Engine } from './engine';
import { ensureRoot, loadRoot } from './root';
import { storage } from './storage';

const NATIVE_HOST_NAME = 'com.arcline.bridge';

interface BridgeRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface BridgeResponse {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

async function resolveNormalWindowId(): Promise<number> {
  const win = await chrome.windows
    .getLastFocused({ windowTypes: ['normal'] })
    .catch(() => undefined);
  if (win?.id !== undefined) return win.id;
  const all = await chrome.windows.getAll({ windowTypes: ['normal'] }).catch(() => []);
  if (all[0]?.id !== undefined) return all[0].id;
  throw new Error('No normal browser window is open.');
}

async function resolveSpaceByIdOrName(spaceRef: string): Promise<BookmarkNode> {
  const trimmed = spaceRef.trim();
  if (!trimmed) throw new Error('Space name or ID is required.');
  const { ids, root } = await loadRoot();
  const spaces = spaceFolders(root, ids.favoritesId);
  const byId = spaces.find((s) => s.id === trimmed);
  if (byId) return byId;
  const byName = spaces.filter((s) => s.title === trimmed);
  if (byName.length === 1 && byName[0]) return byName[0];
  if (byName.length > 1) {
    throw new Error(`Multiple Spaces named "${trimmed}"; specify the Space ID instead.`);
  }
  throw new Error(`Space not found: "${trimmed}"`);
}

async function ensureFolderPath(spaceNode: BookmarkNode, folderPath?: string): Promise<string> {
  if (!folderPath?.trim()) return spaceNode.id;
  const parts = folderPath
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  let parentId = spaceNode.id;
  for (const part of parts) {
    const children = await chrome.bookmarks.getChildren(parentId);
    const existing = children.find((c) => c.url === undefined && c.title === part);
    if (existing) {
      parentId = existing.id;
    } else {
      const created = await chrome.bookmarks.create({ parentId, title: part });
      parentId = created.id;
    }
  }
  return parentId;
}

function summarizeTree(node: BookmarkNode): { pins: number; folders: number } {
  let pins = 0;
  let folders = 0;
  const walk = (children: BookmarkNode[] | undefined) => {
    for (const c of children ?? []) {
      if (c.url) pins += 1;
      else {
        folders += 1;
        walk(c.children);
      }
    }
  };
  walk(node.children);
  return { pins, folders };
}

async function handleBridgeMethod(
  engine: Engine,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  switch (method) {
    case 'ping': {
      const { ids, root } = await loadRoot();
      const spaces = spaceFolders(root, ids.favoritesId);
      return {
        extensionId: chrome.runtime.id,
        version: chrome.runtime.getManifest().version,
        spacesCount: spaces.length,
      };
    }

    case 'spaces.list': {
      const [{ ids, root }, spaceMeta] = await Promise.all([loadRoot(), storage.getSpaceMeta()]);
      const favFolder = (root.children ?? []).find((c) => c.id === ids.favoritesId);
      const favorites = (favFolder?.children ?? [])
        .filter((c): c is BookmarkNode & { url: string } => typeof c.url === 'string')
        .map((c) => ({ id: c.id, title: c.title, url: c.url }));
      const spaces = spaceFolders(root, ids.favoritesId).map((s) => {
        const counts = summarizeTree(s);
        const meta = spaceMeta[s.title];
        return {
          id: s.id,
          name: s.title,
          hue: meta?.hue ?? null,
          icon: meta?.icon ?? null,
          pins: counts.pins,
          folders: counts.folders,
        };
      });
      return { favorites, spaces };
    }

    case 'space.create': {
      const name = typeof params.name === 'string' ? params.name.trim() : '';
      if (!name) throw new Error('name is required.');
      const hue =
        typeof params.hue === 'number' && Number.isFinite(params.hue) ? params.hue : undefined;
      const icon =
        typeof params.icon === 'string' && params.icon.trim() ? params.icon.trim() : undefined;
      const windowId = await resolveNormalWindowId();
      const id = await engine.run({ type: 'createSpace', windowId, name, hue, icon });
      return { id, name };
    }

    case 'space.rename': {
      const spaceRef = typeof params.space === 'string' ? params.space : '';
      const name = typeof params.name === 'string' ? params.name.trim() : '';
      if (!name) throw new Error('name is required.');
      const space = await resolveSpaceByIdOrName(spaceRef);
      await engine.run({ type: 'updateSpace', spaceId: space.id, name });
      return { id: space.id, previousName: space.title, name };
    }

    case 'space.delete': {
      const spaceRef = typeof params.space === 'string' ? params.space : '';
      const space = await resolveSpaceByIdOrName(spaceRef);
      const windowId = await resolveNormalWindowId();
      await engine.run({ type: 'deleteSpace', windowId, spaceId: space.id });
      return { deleted: true, id: space.id, name: space.title };
    }

    case 'pin.add': {
      const spaceRef = typeof params.space === 'string' ? params.space : '';
      const url = typeof params.url === 'string' ? params.url.trim() : '';
      const title = typeof params.title === 'string' ? params.title.trim() : '';
      const folder = typeof params.folder === 'string' ? params.folder : undefined;
      if (!isSafeNavigableUrl(url)) throw new Error('A safe http(s) URL is required.');
      const space = await resolveSpaceByIdOrName(spaceRef);
      const parentId = await ensureFolderPath(space, folder);
      const created = await chrome.bookmarks.create({
        parentId,
        title: title || url,
        url,
      });
      return {
        id: created.id,
        title: created.title,
        url: created.url,
        space: space.title,
        folder: folder ?? null,
      };
    }

    case 'pin.rename': {
      const id = typeof params.id === 'string' ? params.id.trim() : '';
      const title = typeof params.title === 'string' ? params.title.trim() : '';
      if (!id || !title) throw new Error('id and title are required.');
      await engine.run({ type: 'renameBookmark', id, title });
      return { id, title };
    }

    case 'pin.move': {
      const id = typeof params.id === 'string' ? params.id.trim() : '';
      const spaceRef = typeof params.space === 'string' ? params.space : '';
      const folder = typeof params.folder === 'string' ? params.folder : undefined;
      const index =
        typeof params.index === 'number' && Number.isInteger(params.index) && params.index >= 0
          ? params.index
          : undefined;
      if (!id || !spaceRef) throw new Error('id and space are required.');
      const space = await resolveSpaceByIdOrName(spaceRef);
      const parentId = await ensureFolderPath(space, folder);
      const windowId = await resolveNormalWindowId();
      await engine.run({ type: 'moveNode', windowId, id, parentId, index });
      return { id, space: space.title, parentId, folder: folder ?? null };
    }

    case 'pin.delete': {
      const id = typeof params.id === 'string' ? params.id.trim() : '';
      if (!id) throw new Error('id is required.');
      const windowId = await resolveNormalWindowId();
      await engine.run({ type: 'deleteBookmark', windowId, id });
      return { deleted: true, id };
    }

    case 'folder.create': {
      const spaceRef = typeof params.space === 'string' ? params.space : '';
      const title = typeof params.title === 'string' ? params.title.trim() : '';
      const parent = typeof params.parent === 'string' ? params.parent : undefined;
      if (!spaceRef || !title) throw new Error('space and title are required.');
      const space = await resolveSpaceByIdOrName(spaceRef);
      const parentId = await ensureFolderPath(space, parent);
      const created = await chrome.bookmarks.create({ parentId, title });
      return { id: created.id, title: created.title, space: space.title, parent: parent ?? null };
    }

    case 'favorite.add': {
      const url = typeof params.url === 'string' ? params.url.trim() : '';
      const title = typeof params.title === 'string' ? params.title.trim() : '';
      if (!isSafeNavigableUrl(url)) throw new Error('A safe http(s) URL is required.');
      const id = await engine.run({ type: 'addUrlFavorite', url, title: title || url });
      return { id, title: title || url, url };
    }

    case 'favorite.delete': {
      const favId = typeof params.id === 'string' ? params.id.trim() : '';
      const favUrl = typeof params.url === 'string' ? params.url.trim() : '';
      const { favoritesId } = await ensureRoot();
      const children = await chrome.bookmarks.getChildren(favoritesId);
      let targetId = favId;
      if (!targetId && favUrl) {
        const list = children.flatMap((c) =>
          typeof c.url === 'string' ? [{ id: c.id, url: c.url }] : [],
        );
        targetId = findFavoriteUrlMatch(list, favUrl)?.id ?? '';
      }
      if (!targetId) throw new Error('Favorite not found.');
      const windowId = await resolveNormalWindowId();
      await engine.run({ type: 'removeFavorite', windowId, favoriteId: targetId });
      return { deleted: true, id: targetId };
    }

    case 'siteSearch.list': {
      const settings = await storage.getSettings();
      const disabled = new Set(settings.disabledSiteSearchIds);
      const customByPrefix = new Map<string, CustomSiteSearch>();
      for (const c of settings.customSiteSearches) {
        customByPrefix.set(c.prefix.toLowerCase(), c);
      }
      const builtIn = SITE_SEARCHES.map((s) => ({
        id: s.id,
        prefix: s.prefix,
        label: s.label,
        urlTemplate: s.urlTemplate,
        accent: s.accent,
        builtIn: true,
        enabled: !disabled.has(s.id),
        overriddenByCustom: customByPrefix.has(s.prefix.toLowerCase()),
      }));
      const custom = settings.customSiteSearches.map((c) => ({
        id: c.id,
        prefix: c.prefix,
        label: c.label,
        urlTemplate: c.urlTemplate,
        accent: c.accent ?? '#6366f1',
        builtIn: false,
        enabled: !disabled.has(c.id),
      }));
      return { builtIn, custom, disabledSiteSearchIds: settings.disabledSiteSearchIds };
    }

    case 'siteSearch.add': {
      const settings = await storage.getSettings();
      const rawPrefix = typeof params.prefix === 'string' ? params.prefix.trim().toLowerCase() : '';
      const cleaned = sanitizeCustomSiteSearch({
        id: `custom:${rawPrefix}`,
        prefix: rawPrefix,
        label: params.label,
        urlTemplate: params.urlTemplate ?? params.url,
        accent: params.accent,
      });
      if (!cleaned) {
        throw new Error(
          'Invalid site search: prefix (a-z/0-9), label, and http(s) URL with %s are required.',
        );
      }
      const rest = settings.customSiteSearches.filter(
        (c) => c.prefix.toLowerCase() !== cleaned.prefix.toLowerCase(),
      );
      await storage.setSettings({
        ...settings,
        customSiteSearches: [...rest, cleaned],
      });
      return cleaned;
    }

    case 'siteSearch.edit': {
      const settings = await storage.getSettings();
      const targetPrefix =
        typeof params.prefix === 'string' ? params.prefix.trim().toLowerCase() : '';
      const existing = settings.customSiteSearches.find(
        (c) => c.prefix.toLowerCase() === targetPrefix || c.id === targetPrefix,
      );
      const builtIn = SITE_SEARCHES.find(
        (s) => s.prefix.toLowerCase() === targetPrefix || s.id === targetPrefix,
      );
      const base = existing ?? builtIn;
      if (!base) throw new Error(`Site search not found: "${targetPrefix}"`);
      const nextPrefix =
        typeof params.newPrefix === 'string' && params.newPrefix.trim()
          ? params.newPrefix.trim().toLowerCase()
          : base.prefix;
      const cleaned = sanitizeCustomSiteSearch({
        id: existing?.id ?? `custom:${nextPrefix}`,
        prefix: nextPrefix,
        label: typeof params.label === 'string' && params.label.trim() ? params.label : base.label,
        urlTemplate:
          typeof params.urlTemplate === 'string' && params.urlTemplate.trim()
            ? params.urlTemplate
            : typeof params.url === 'string' && params.url.trim()
              ? params.url
              : base.urlTemplate,
        accent:
          typeof params.accent === 'string' && params.accent.trim() ? params.accent : base.accent,
      });
      if (!cleaned) throw new Error('Invalid updated site search fields.');
      const rest = settings.customSiteSearches.filter(
        (c) =>
          c.id !== existing?.id &&
          c.prefix.toLowerCase() !== targetPrefix &&
          c.prefix.toLowerCase() !== cleaned.prefix.toLowerCase(),
      );
      await storage.setSettings({
        ...settings,
        customSiteSearches: [...rest, cleaned],
      });
      return cleaned;
    }

    case 'siteSearch.delete': {
      const settings = await storage.getSettings();
      const target =
        typeof params.prefix === 'string'
          ? params.prefix.trim().toLowerCase()
          : typeof params.id === 'string'
            ? params.id.trim().toLowerCase()
            : '';
      const match = settings.customSiteSearches.find(
        (c) => c.prefix.toLowerCase() === target || c.id.toLowerCase() === target,
      );
      if (!match) throw new Error(`Custom site search not found: "${target}"`);
      await storage.setSettings({
        ...settings,
        customSiteSearches: settings.customSiteSearches.filter((c) => c.id !== match.id),
        disabledSiteSearchIds: settings.disabledSiteSearchIds.filter((id) => id !== match.id),
      });
      return { deleted: true, id: match.id, prefix: match.prefix };
    }

    case 'siteSearch.setEnabled': {
      const settings = await storage.getSettings();
      const ref =
        typeof params.id === 'string'
          ? params.id.trim()
          : typeof params.prefix === 'string'
            ? params.prefix.trim()
            : '';
      const enabled = Boolean(params.enabled);
      const lower = ref.toLowerCase();
      const customMatch = settings.customSiteSearches.find(
        (c) => c.id.toLowerCase() === lower || c.prefix.toLowerCase() === lower,
      );
      const builtInMatch = SITE_SEARCHES.find(
        (s) => s.id.toLowerCase() === lower || s.prefix.toLowerCase() === lower,
      );
      const targetId = customMatch?.id ?? builtInMatch?.id;
      if (!targetId) throw new Error(`Site search not found: "${ref}"`);
      const nextDisabled = new Set(settings.disabledSiteSearchIds);
      if (enabled) nextDisabled.delete(targetId);
      else nextDisabled.add(targetId);
      await storage.setSettings({
        ...settings,
        disabledSiteSearchIds: [...nextDisabled],
      });
      return { id: targetId, enabled };
    }

    default:
      throw new Error(`Unknown bridge method: ${method}`);
  }
}

export function startNativeBridge(engine: Engine): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.connectNative) return;
  let port: chrome.runtime.Port | null = null;
  let retryDelayMs = 3000;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const connect = () => {
    if (port) return;
    try {
      const nextPort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
      port = nextPort;
      nextPort.onMessage.addListener((raw: unknown) => {
        retryDelayMs = 3000;
        const req = raw as BridgeRequest | undefined;
        if (!req || typeof req.id !== 'string' || typeof req.method !== 'string') return;
        void handleBridgeMethod(engine, req.method, req.params ?? {})
          .then((data) => {
            const resp: BridgeResponse = { id: req.id, ok: true, data };
            try {
              nextPort.postMessage(resp);
            } catch {
              // Port closed mid-request
            }
          })
          .catch((err) => {
            const resp: BridgeResponse = {
              id: req.id,
              ok: false,
              error: {
                code: 'BRIDGE_ERROR',
                message: err instanceof Error ? err.message : String(err),
              },
            };
            try {
              nextPort.postMessage(resp);
            } catch {
              // Port closed mid-request
            }
          });
      });

      nextPort.onDisconnect.addListener(() => {
        // Consume lastError silently so Chrome never logs an uncaught error when the optional bridge isn't installed
        const errMsg = chrome.runtime.lastError?.message ?? '';
        port = null;
        if (/not found/i.test(errMsg)) {
          // Optional native host not installed on this machine — don't spam reconnects
          return;
        }
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          connect();
        }, retryDelayMs);
        retryDelayMs = Math.min(30_000, retryDelayMs * 2);
      });
    } catch {
      port = null;
    }
  };

  connect();
}
