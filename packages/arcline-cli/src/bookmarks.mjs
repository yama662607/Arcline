import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { CliError, countNodes, durableWrite, portable, readJson, sanitizeUrl } from './common.mjs';
import { browserRunning } from './profiles.mjs';

export function arclineRoot(document) {
  const matches = document?.roots?.other?.children?.filter(n => n.type === 'folder' && n.name === 'Arcline') ?? [];
  if (matches.length > 1) throw new CliError('AMBIGUOUS_ROOT', 'Multiple Arcline folders exist in Other Bookmarks. Resolve the duplicate folders first.');
  if (!matches.length) throw new CliError('NO_ARCLINE_ROOT', 'Other Bookmarks / Arcline is missing. Initialize Arcline in the browser first.');
  return matches[0];
}

function cleanNode(node, includeIds = false) {
  const idPart = includeIds && node.id !== undefined ? { id: String(node.id) } : {};
  if (node.type === 'url') return { ...idPart, kind: 'pin', title: node.name || node.url, url: node.url };
  if (node.type === 'folder') {
    return {
      ...idPart,
      kind: 'folder',
      title: node.name || '',
      children: (node.children ?? []).map(child => cleanNode(child, includeIds)).filter(Boolean),
    };
  }
  return null;
}

const ROOT_KEY_MAP = [
  { key: 'bar', prop: 'bookmark_bar', fallbackTitle: 'Bookmarks Bar' },
  { key: 'other', prop: 'other', fallbackTitle: 'Other Bookmarks' },
  { key: 'mobile', prop: 'synced', fallbackTitle: 'Mobile Bookmarks' },
];

export function treeAllRoots(document, rootFilter = '') {
  const filter = rootFilter.trim().toLowerCase();
  const roots = [];
  for (const { key, prop, fallbackTitle } of ROOT_KEY_MAP) {
    if (filter && filter !== 'all' && filter !== key) continue;
    const node = document?.roots?.[prop];
    if (!node || typeof node !== 'object') continue;
    const nodes = (node.children ?? []).map(child => cleanNode(child, true)).filter(Boolean);
    roots.push({
      key,
      id: node.id !== undefined ? String(node.id) : null,
      title: node.name || fallbackTitle,
      ...countNodes(nodes),
      nodes,
    });
  }
  return { roots };
}

export function extractExternalRoots(document, { includeIds = false } = {}) {
  const roots = [];
  for (const { key, prop, fallbackTitle } of ROOT_KEY_MAP) {
    const node = document?.roots?.[prop];
    if (!node || typeof node !== 'object') continue;
    const rawChildren = (node.children ?? []).filter(
      child => !(key === 'other' && child.type === 'folder' && child.name === 'Arcline'),
    );
    const nodes = rawChildren.map(child => cleanNode(child, includeIds)).filter(Boolean);
    roots.push({
      key,
      ...(includeIds && node.id !== undefined ? { id: String(node.id) } : {}),
      title: node.name || fallbackTitle,
      ...countNodes(nodes),
      nodes,
    });
  }
  return roots;
}

export function exportBookmarks(document, { includeIds = false, allRoots = false } = {}) {
  const root = arclineRoot(document);
  const favorites = [];
  const spaces = [];
  for (const node of root.children ?? []) {
    if (node.type !== 'folder') continue;
    const children = (node.children ?? []).map(child => cleanNode(child, includeIds)).filter(Boolean);
    if (node.name === 'Favorites') favorites.push(...children);
    else spaces.push({ ...(includeIds && node.id !== undefined ? { id: String(node.id) } : {}), name: node.name, pinned: children });
  }
  const base = portable(favorites, spaces);
  if (!allRoots) return base;
  return { ...base, externalRoots: extractExternalRoots(document, { includeIds }) };
}

export function listSpaces(document, { includeIds = false } = {}) {
  const workspace = exportBookmarks(document, { includeIds });
  return {
    favorites: workspace.favorites,
    favoriteCounts: countNodes(workspace.favorites),
    spaces: workspace.spaces.map(space => ({
      ...(includeIds && space.id !== undefined ? { id: space.id } : {}),
      name: space.name,
      ...countNodes(space.pinned),
    })),
    stats: workspace.stats,
  };
}

export function searchBookmarks(document, query, { includeIds = false } = {}) {
  const workspace = exportBookmarks(document, { includeIds });
  const needle = query.toLowerCase();
  const results = [];
  function walk(nodes, source, space, parents = []) {
    for (const node of nodes) {
      const location = [...parents, node.title];
      if ([node.title, node.url, space, ...parents].filter(Boolean).some(s => s.toLowerCase().includes(needle))) {
        results.push({
          ...(includeIds && node.id !== undefined ? { id: node.id } : {}),
          source,
          kind: node.kind,
          space,
          title: node.title,
          ...(node.url ? { url: node.url } : {}),
          path: location,
        });
      }
      if (node.kind === 'folder') walk(node.children, source, space, location);
    }
  }
  walk(workspace.favorites, 'favorite', null);
  for (const space of workspace.spaces) walk(space.pinned, 'pin', space.name);
  return results;
}

export function treeBookmarks(document, spaceRef) {
  const workspace = exportBookmarks(document, { includeIds: true });
  if (spaceRef) {
    const trimmed = spaceRef.trim();
    const byId = workspace.spaces.find(s => s.id === trimmed);
    const byName = workspace.spaces.filter(s => s.name === trimmed);
    let target = byId;
    if (!target) {
      if (byName.length === 1) target = byName[0];
      else if (byName.length > 1) {
        const ids = byName.map(s => s.id).join(', ');
        throw new CliError('AMBIGUOUS_SPACE', `Multiple Spaces named ${JSON.stringify(trimmed)} (candidate IDs: ${ids}); specify the Space ID instead.`);
      } else {
        throw new CliError('INVALID_SPACE', `Space not found: ${JSON.stringify(trimmed)}.`);
      }
    }
    return {
      space: { id: target.id, name: target.name, ...countNodes(target.pinned) },
      nodes: target.pinned,
    };
  }
  return {
    favorites: workspace.favorites,
    spaces: workspace.spaces.map(s => ({
      id: s.id,
      name: s.name,
      ...countNodes(s.pinned),
      nodes: s.pinned,
    })),
  };
}

function folderSignature(node) {
  if (node.kind === 'pin') return `P:${node.title}\u0000${node.url}`;
  return `F:${node.title}[${(node.children ?? []).map(folderSignature).join(',')}]`;
}

export function lintWorkspace({ favorites = [], spaces = [], externalRoots = [] }) {
  const duplicateSpaces = [];
  const spaceByName = new Map();
  for (const s of spaces) {
    const arr = spaceByName.get(s.name) ?? [];
    arr.push(s);
    spaceByName.set(s.name, arr);
  }
  for (const [name, list] of spaceByName.entries()) {
    if (list.length > 1) {
      const sigs = new Set(
        list.map(s => folderSignature({ kind: 'folder', title: s.name, children: s.nodes ?? s.pinned ?? [] })),
      );
      duplicateSpaces.push({
        name,
        count: list.length,
        ids: list.map(s => s.id ?? null),
        identicalContent: sigs.size === 1,
      });
    }
  }

  const duplicateFolders = [];
  const emptyFolders = [];
  const urlOccurrences = new Map();
  const urlAsTitlePins = [];

  const checkSiblings = (nodes, scopeName, parentPath, inArcline) => {
    const foldersByTitle = new Map();
    for (const node of nodes ?? []) {
      const nodePath = [...parentPath, node.title];
      if (node.kind === 'folder') {
        const list = foldersByTitle.get(node.title) ?? [];
        list.push(node);
        foldersByTitle.set(node.title, list);
        if (!node.children || node.children.length === 0) {
          emptyFolders.push({ id: node.id ?? null, space: scopeName, inArcline, path: nodePath });
        } else {
          checkSiblings(node.children, scopeName, nodePath, inArcline);
        }
      } else if (node.kind === 'pin' && node.url) {
        const occ = urlOccurrences.get(node.url) ?? [];
        occ.push({ id: node.id ?? null, space: scopeName, inArcline, path: nodePath, title: node.title });
        urlOccurrences.set(node.url, occ);
        if (/^https?:\/\//i.test(node.title.trim())) {
          const titleNorm = node.title.trim().replace(/\/+$/, '');
          const urlNorm = node.url.trim().replace(/\/+$/, '');
          urlAsTitlePins.push({
            id: node.id ?? null,
            space: scopeName,
            inArcline,
            path: nodePath,
            title: node.title,
            url: node.url,
            mismatchedUrl: titleNorm !== urlNorm,
          });
        }
      }
    }
    for (const [title, list] of foldersByTitle.entries()) {
      if (list.length > 1) {
        const sigs = new Set(list.map(folderSignature));
        duplicateFolders.push({
          space: scopeName,
          inArcline,
          parentPath,
          title,
          count: list.length,
          ids: list.map(n => n.id ?? null),
          identicalContent: sigs.size === 1,
        });
      }
    }
  };

  checkSiblings(favorites, 'Favorites', [], true);
  for (const s of spaces) {
    checkSiblings(s.nodes ?? s.pinned ?? [], s.name, [s.name], true);
  }
  for (const ext of externalRoots) {
    const label = ext.title || ext.key || 'External';
    const filteredNodes = (ext.nodes ?? []).filter(
      n => !(ext.key === 'other' && n.kind === 'folder' && n.title === 'Arcline'),
    );
    checkSiblings(filteredNodes, label, [label], false);
  }

  const duplicateUrls = [];
  for (const [url, occurrences] of urlOccurrences.entries()) {
    if (occurrences.length > 1) {
      const hasArcline = occurrences.some(o => o.inArcline);
      const hasExternal = occurrences.some(o => !o.inArcline);
      duplicateUrls.push({
        url,
        count: occurrences.length,
        crossRoot: hasArcline && hasExternal,
        occurrences,
      });
    }
  }

  return {
    summary: {
      duplicateSpaces: duplicateSpaces.length,
      duplicateFolders: duplicateFolders.length,
      duplicateUrls: duplicateUrls.length,
      crossRootDuplicateUrls: duplicateUrls.filter(d => d.crossRoot).length,
      extraUrlCopies: duplicateUrls.reduce((sum, item) => sum + item.count - 1, 0),
      emptyFolders: emptyFolders.length,
      urlAsTitlePins: urlAsTitlePins.length,
      mismatchedUrlTitlePins: urlAsTitlePins.filter(p => p.mismatchedUrl).length,
    },
    duplicateSpaces,
    duplicateFolders,
    duplicateUrls,
    emptyFolders,
    urlAsTitlePins,
  };
}

export function lintBookmarks(document, { allRoots = false } = {}) {
  const tree = treeBookmarks(document);
  const externalRoots = allRoots ? extractExternalRoots(document, { includeIds: true }) : [];
  return lintWorkspace({ ...tree, externalRoots });
}

// Chromium BookmarkCodec hashes ID (UTF-8), name (UTF-16LE), type, then URL/children.
// https://chromium.googlesource.com/chromium/src/+/main/components/bookmarks/browser/bookmark_codec.cc
export function bookmarkChecksum(document, algorithm = 'md5') {
  const hash = createHash(algorithm);
  function walk(node) {
    hash.update(String(node.id));
    hash.update(node.name ?? '', 'utf16le');
    hash.update(node.type);
    if (node.type === 'url') hash.update(node.url);
    else for (const child of node.children ?? []) walk(child);
  }
  for (const key of ['bookmark_bar', 'other', 'synced']) if (document.roots[key]) walk(document.roots[key]);
  return hash.digest('hex');
}

export function addPinToDocument(document, { space, url, title, folder }) {
  const cleanUrl = sanitizeUrl(url);
  if (!space?.trim()) throw new CliError('INVALID_SPACE', '--space is required.');
  const root = arclineRoot(document);
  const matches = (root.children ?? []).filter(n => n.type === 'folder' && n.name === space && n.name !== 'Favorites');
  if (matches.length !== 1) {
    const extra = matches.length > 1 ? ` (candidate IDs: ${matches.map(m => m.id).join(', ')})` : '';
    throw new CliError('INVALID_SPACE', `Expected one existing Space named ${JSON.stringify(space)}; found ${matches.length}${extra}.`);
  }
  let maxId = 0n;
  function scan(node) {
    if (/^\d+$/.test(String(node.id))) maxId = BigInt(node.id) > maxId ? BigInt(node.id) : maxId;
    for (const child of node.children ?? []) scan(child);
  }
  for (const node of Object.values(document.roots)) if (node && typeof node === 'object') scan(node);
  const timestamp = (BigInt(Date.now()) * 1000n + 11644473600000000n).toString();
  const makeNode = (type, name) => ({ id: String(++maxId), guid: randomUUID(), type, name,
    date_added: timestamp, date_last_used: '0', ...(type === 'folder' ? { date_modified: timestamp, children: [] } : {}) });
  let parent = matches[0];
  const ancestors = [document.roots.other, root, parent];
  if (folder !== undefined) {
    const parts = folder.split('/').map(s => s.trim());
    if (parts.some(s => !s || s === '.' || s === '..')) throw new CliError('INVALID_FOLDER', '--folder must be a nonempty slash-separated folder path.');
    for (const part of parts) {
      const folders = (parent.children ?? []).filter(n => n.type === 'folder' && n.name === part);
      if (folders.length > 1) throw new CliError('AMBIGUOUS_FOLDER', `Multiple folders named ${part}.`);
      let child = folders[0];
      if (!child) { child = makeNode('folder', part); (parent.children ??= []).push(child); }
      parent = child;
      ancestors.push(parent);
    }
  }
  const pin = { ...makeNode('url', title?.trim() || cleanUrl), url: cleanUrl };
  (parent.children ??= []).push(pin);
  for (const ancestor of ancestors) ancestor.date_modified = timestamp;
  document.checksum = bookmarkChecksum(document);
  if ('checksum_sha256' in document) document.checksum_sha256 = bookmarkChecksum(document, 'sha256');
  return pin;
}

export function addPin(profile, options, { checkRunning = browserRunning } = {}) {
  // Resolve symlinks before selecting a sibling lock/backup/temp file.
  const file = fs.realpathSync(profile.bookmarks);
  const lock = `${file}.arcline.lock`;
  let lockFd;
  try { lockFd = fs.openSync(lock, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new CliError('WRITE_LOCKED', `Another writer may be active: ${lock}. Remove this lock only after confirming no arcline process is writing.`);
    throw error;
  }
  const temporary = `${file}.arcline-${randomUUID()}.tmp`;
  let backup;
  const warnings = [];
  function guardBrowser() {
    const running = checkRunning(profile.browser);
    if (running !== false) {
      const message = running === true
        ? 'Browser is running. It may overwrite bookmark edits. Quit it before writing, or explicitly use --force.'
        : 'Could not verify whether the browser is running. Quit it and retry, or explicitly use --force.';
      if (!options.force) throw new CliError('BROWSER_RUNNING', message);
      if (!warnings.includes(message)) warnings.push(message);
    }
  }
  try {
    fs.writeFileSync(lockFd, `${process.pid}\n`);
    guardBrowser();
    const original = fs.readFileSync(file);
    const originalStat = fs.statSync(file);
    const document = JSON.parse(original.toString('utf8'));
    const pin = addPinToDocument(document, options);
    durableWrite(temporary, `${JSON.stringify(document, null, 2)}\n`, originalStat.mode & 0o777);
    backup = `${file}.arcline-${Date.now()}-${randomUUID()}.bak`;
    durableWrite(backup, original);
    guardBrowser();
    if (!fs.readFileSync(file).equals(original)) throw new CliError('CONCURRENT_CHANGE', 'Bookmarks changed while preparing the edit; no changes were written. Retry after closing the browser.');
    fs.renameSync(temporary, file);
    // Windows does not support opening directories for fsync.
    if (process.platform !== 'win32') {
      const directory = fs.openSync(path.dirname(file), 'r');
      try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
    }
    return { pin: { title: pin.name, url: pin.url, id: pin.id }, space: options.space,
      folder: options.folder ?? null, bookmarks: file, backup, warnings };
  } finally {
    fs.closeSync(lockFd);
    fs.rmSync(temporary, { force: true });
    fs.rmSync(lock, { force: true });
  }
}

export const readBookmarks = profile => readJson(profile.bookmarks);
