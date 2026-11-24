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

function cleanNode(node) {
  if (node.type === 'url') return { kind: 'pin', title: node.name || node.url, url: node.url };
  if (node.type === 'folder') return { kind: 'folder', title: node.name || '', children: (node.children ?? []).map(cleanNode).filter(Boolean) };
  return null;
}

export function exportBookmarks(document) {
  const root = arclineRoot(document);
  const favorites = [];
  const spaces = [];
  for (const node of root.children ?? []) {
    if (node.type !== 'folder') continue;
    const children = (node.children ?? []).map(cleanNode).filter(Boolean);
    if (node.name === 'Favorites') favorites.push(...children);
    else spaces.push({ name: node.name, pinned: children });
  }
  return portable(favorites, spaces);
}

export function listSpaces(document) {
  const workspace = exportBookmarks(document);
  return { favorites: workspace.favorites, favoriteCounts: countNodes(workspace.favorites),
    spaces: workspace.spaces.map(space => ({ name: space.name, ...countNodes(space.pinned) })),
    stats: workspace.stats };
}

export function searchBookmarks(document, query) {
  const workspace = exportBookmarks(document);
  const needle = query.toLowerCase();
  const results = [];
  function walk(nodes, source, space, parents = []) {
    for (const node of nodes) {
      const location = [...parents, node.title];
      if ([node.title, node.url, space, ...parents].filter(Boolean).some(s => s.toLowerCase().includes(needle))) {
        results.push({ source, kind: node.kind, space, title: node.title,
          ...(node.url ? { url: node.url } : {}), path: location });
      }
      if (node.kind === 'folder') walk(node.children, source, space, location);
    }
  }
  walk(workspace.favorites, 'favorite', null);
  for (const space of workspace.spaces) walk(space.pinned, 'pin', space.name);
  return results;
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
  if (matches.length !== 1) throw new CliError('INVALID_SPACE', `Expected one existing Space named ${JSON.stringify(space)}; found ${matches.length}.`);
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
