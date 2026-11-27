import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CliError, readJson, writeExport } from './common.mjs';
import { arcSidebarPaths, browsers, discoverProfiles, hasArcline, selectProfile } from './profiles.mjs';
import { addPin, arclineRoot, exportBookmarks, lintBookmarks, lintWorkspace, listSpaces, readBookmarks, searchBookmarks, treeAllRoots, treeBookmarks } from './bookmarks.mjs';
import { parseArcSidebar } from './arc.mjs';
import { bridgeStatus, callBridge, installBridge, uninstallBridge } from './bridge.mjs';
import { searchHistory } from './history.mjs';
import { openBrowser } from './open.mjs';

export const help = `Arcline 1.0.0 — local browser workspace CLI (Node.js 22+)

Usage: arcline <command> [subcommand] [options]

Read & Navigation:
  doctor                         Inspect profiles, Arcline root, Arc file, extension build
  spaces [--live] [--include-ids]
                                 List Spaces, recursive pin/folder counts and Favorites
  tree [--space <name|id>] [--live]
                                 Show full recursive tree with bookmark IDs for every node
  lint [--live] [--all-roots]    Detect duplicate Spaces/folders/URLs, empty folders, URL titles
  search <query> [--history] [--include-ids]
                                 Search Favorites, pinned links/folders, optionally History
  export [--out <file>] [--include-ids] [--all-roots]
                                 Export clean portable workspace JSON
  import-arc [--file <path>] [--out <file>]
                                 Parse StorableSidebar.json; no browser mutation
  open [url or search words]     Launch browser; no query opens its New Tab page

Live Editing (via Native Messaging bridge — Brave/Chrome stays open & Syncs cleanly!):
  bridge install [--browser brave|chrome] [--extension-id <id>]
  bridge status | uninstall [--browser brave|chrome]
  bookmarks tree [--root bar|other|mobile] [--live]
  bookmarks delete --id <id> [--recursive] [--dry-run]
  bookmarks move --id <id> --space <name|id> [--folder <a/b>] [--index <n>]
  space create --name <name> [--hue <0-359>] [--icon <icon>]
  space rename --space <name|id> --name <newName>
  space theme --space <name|id> [--hue <0-359>] [--icon <icon>]
  space delete --space <name|id> [--dry-run]
  pin add --space <name|id> --url <url> [--title <title>] [--folder <a/b>]
  pin rename --id <id> --title <title>
  pin move --id <id> --space <name|id> [--folder <a/b>] [--index <n>]
  pin delete --id <id> [--recursive] [--dry-run]
  folder create --space <name|id> --title <title> [--parent <a/b>]
  folder rename --id <id> --title <title>
  folder delete --id <id> [--recursive] [--dry-run]
  favorite add --url <url> [--title <title>]
  favorite delete --id <id> | --url <url>
  site-search list
  site-search add --prefix <p> --label <name> --url <template-with-%s> [--accent <#hex>]
  site-search edit --prefix <p> [--new-prefix <p2>] [--label <name>] [--url <tpl>] [--accent <#hex>]
  site-search delete --prefix <p>
  site-search enable|disable --id <id|prefix>
  add-pin --space <name> --url <url> [--title <title>] [--folder <path>] [--force]

Profile options (doctor/spaces/tree/lint/search/add-pin/export):
  --browser brave|chrome|chromium|arc   (or env ARCLINE_BROWSER)
  --profile <directory>                 (or env ARCLINE_PROFILE; e.g. Default)
  --bookmarks <path>                    Explicit Bookmarks file; History is its sibling

Common options:
  --json                        One {ok, command, data, warnings} object on stdout
  --help, -h                    Show help
  --version                     Print 1.0.0
`;

const globalOptions = ['json', 'help', 'version'];
const profileOptions = ['browser', 'profile', 'bookmarks'];
const commandOptions = {
  doctor: [...profileOptions],
  spaces: [...profileOptions, 'live', 'include-ids'],
  tree: [...profileOptions, 'space', 'live'],
  lint: [...profileOptions, 'live', 'all-roots'],
  search: [...profileOptions, 'history', 'limit', 'include-ids'],
  'add-pin': [...profileOptions, 'space', 'url', 'title', 'folder', 'force'],
  export: [...profileOptions, 'out', 'include-ids', 'all-roots'],
  'import-arc': ['file', 'out'],
  open: ['browser', 'profile'],
  bridge: ['browser', 'extension-id'],
  bookmarks: [...profileOptions, 'root', 'live', 'id', 'space', 'folder', 'index', 'recursive', 'dry-run'],
  space: ['space', 'name', 'hue', 'icon', 'dry-run'],
  pin: ['id', 'space', 'url', 'title', 'folder', 'index', 'recursive', 'dry-run'],
  folder: ['id', 'space', 'title', 'parent', 'recursive', 'dry-run'],
  favorite: ['id', 'url', 'title'],
  'site-search': ['id', 'prefix', 'new-prefix', 'label', 'url', 'accent'],
};

const subcommandCommands = new Set(['bridge', 'bookmarks', 'space', 'pin', 'folder', 'favorite', 'site-search']);

export function parseCli(argv) {
  const stringOpts = [
    'browser', 'profile', 'bookmarks', 'limit', 'space', 'url', 'title', 'folder', 'out', 'file',
    'extension-id', 'name', 'hue', 'icon', 'id', 'index', 'parent', 'prefix', 'new-prefix', 'label', 'accent', 'root',
  ];
  const options = Object.fromEntries(stringOpts.map(name => [name, { type: 'string' }]));
  for (const name of ['json', 'history', 'force', 'version', 'live', 'include-ids', 'dry-run', 'recursive', 'all-roots']) {
    options[name] = { type: 'boolean' };
  }
  options.help = { type: 'boolean', short: 'h' };
  let parsed;
  try { parsed = parseArgs({ args: argv, options, allowPositionals: true, strict: true }); }
  catch (error) { throw new CliError('INVALID_ARGUMENT', error.message); }
  const { values, positionals } = parsed;
  const command = positionals.shift();
  if (values.help || values.version || !command) {
    if (!command && !values.help && !values.version && Object.keys(values).some(k => k !== 'json')) throw new CliError('INVALID_ARGUMENT', 'A command is required.');
    return { command: values.version ? 'version' : 'help', options: values, args: [] };
  }
  if (!Object.hasOwn(commandOptions, command)) throw new CliError('UNKNOWN_COMMAND', `Unknown command: ${command}. Use --help.`);
  for (const name of Object.keys(values)) {
    if (![...globalOptions, ...commandOptions[command]].includes(name)) throw new CliError('INVALID_ARGUMENT', `--${name} is not supported by ${command}.`);
    if (typeof values[name] === 'string' && !values[name].trim()) throw new CliError('INVALID_ARGUMENT', `--${name} must not be empty.`);
  }
  if (values.browser && !browsers.includes(values.browser)) throw new CliError('INVALID_BROWSER', `Unknown browser: ${values.browser}.`);
  if (values.profile && (['.', '..'].includes(values.profile) || /[/\\]/u.test(values.profile))) throw new CliError('INVALID_PROFILE', '--profile must be a directory name, not a path.');
  if (!['open', 'search'].includes(command) && !subcommandCommands.has(command) && positionals.length) {
    throw new CliError('INVALID_ARGUMENT', `${command} does not accept positional arguments.`);
  }
  if (subcommandCommands.has(command) && positionals.length !== 1) {
    throw new CliError('INVALID_ARGUMENT', `${command} requires a single subcommand (see --help).`);
  }
  if (command === 'search' && !positionals.join(' ').trim()) throw new CliError('INVALID_ARGUMENT', 'search requires a nonempty query.');
  if (command === 'add-pin' && (!values.space || !values.url)) throw new CliError('INVALID_ARGUMENT', 'add-pin requires --space and --url.');
  if (values.limit !== undefined && (!/^\d+$/.test(values.limit) || Number(values.limit) < 1 || Number(values.limit) > 10000)) throw new CliError('INVALID_LIMIT', '--limit must be an integer between 1 and 10000.');
  return { command, options: values, args: positionals };
}

function resolveManifestName(directory, manifest) {
  const rawName = manifest?.name;
  if (typeof rawName !== 'string') return null;
  const match = rawName.match(/^__MSG_([A-Za-z0-9_]+)__$/u);
  if (!match) return rawName;
  const locale = typeof manifest?.default_locale === 'string' && manifest.default_locale ? manifest.default_locale : 'en';
  try {
    const messages = readJson(path.join(directory, '_locales', locale, 'messages.json'));
    return messages?.[match[1]]?.message ?? null;
  } catch {
    return null;
  }
}

function extensionStatus() {
  const directory = fileURLToPath(new URL('../../../extension/dist/', import.meta.url));
  const required = [
    'manifest.json',
    'background.js',
    'overlay.js',
    'sidepanel.html',
    'empty-space.html',
    'onboarding.html',
    '_locales/en/messages.json',
  ];
  const missing = required.filter(name => !fs.existsSync(path.join(directory, name)));
  let manifest;
  let error;
  if (!missing.includes('manifest.json')) {
    try { manifest = readJson(path.join(directory, 'manifest.json')); } catch (e) { error = e.message; }
  }
  const resolvedName = manifest ? resolveManifestName(directory, manifest) : null;
  return { directory, exists: fs.existsSync(directory), ready: !missing.length && !error && resolvedName === 'Arcline', missing,
    version: manifest?.version ?? null, ...(error ? { error } : {}) };
}

export function doctor(options) {
  const profiles = discoverProfiles(options).map(profile => ({ ...profile, arclineRoot: hasArcline(profile) }));
  const warnings = [];
  let selected = null;
  let bookmarkRoot = null;
  try {
    selected = selectProfile(options, profiles);
    const root = arclineRoot(readBookmarks(selected));
    bookmarkRoot = { found: true, path: 'Other Bookmarks / Arcline', id: root.id };
  } catch (error) {
    warnings.push(error.message);
    bookmarkRoot = { found: false, error: error.message };
  }
  const arc = arcSidebarPaths().map(file => ({ file, available: fs.existsSync(file) }));
  const extension = extensionStatus();
  if (!extension.ready) warnings.push('Extension build is unavailable or incomplete at the repository-relative extension/dist path.');
  return { data: { profiles, selected, bookmarkRoot, arc, extension }, warnings };
}

export async function execute({ command, options, args }) {
  const warnings = [];
  if (command === 'help') return { data: { help }, warnings };
  if (command === 'version') return { data: { version: '1.0.0' }, warnings };
  if (command === 'doctor') return doctor(options);
  if (command === 'open') return { data: await openBrowser(args.join(' '), options), warnings };
  if (command === 'bridge') {
    const sub = args[0];
    if (sub === 'install') return { data: installBridge({ browser: options.browser ?? 'brave', extensionId: options['extension-id'] }), warnings };
    if (sub === 'uninstall') return { data: uninstallBridge({ browser: options.browser ?? 'brave' }), warnings };
    if (sub === 'status') return { data: await bridgeStatus(), warnings };
    throw new CliError('INVALID_ARGUMENT', `Unknown bridge subcommand: ${sub}. Use install, status, or uninstall.`);
  }
  if (command === 'bookmarks') {
    const sub = args[0];
    if (sub === 'tree') {
      if (options.live) {
        const live = await callBridge('bookmarks.tree', options.root ? { root: options.root } : {});
        return { data: { ...live, via: 'bridge' }, warnings };
      }
      const profile = selectProfile(options);
      return { data: treeAllRoots(readBookmarks(profile), options.root ?? ''), warnings };
    }
    if (sub === 'delete') {
      if (!options.id) throw new CliError('INVALID_ARGUMENT', 'bookmarks delete requires --id.');
      return { data: await callBridge('bookmarks.delete', { id: options.id, recursive: Boolean(options.recursive), dryRun: Boolean(options['dry-run']) }), warnings };
    }
    if (sub === 'move') {
      if (!options.id || !options.space) throw new CliError('INVALID_ARGUMENT', 'bookmarks move requires --id and --space.');
      const index = options.index !== undefined ? Number(options.index) : undefined;
      return { data: await callBridge('bookmarks.move', { id: options.id, space: options.space, folder: options.folder, ...(Number.isInteger(index) ? { index } : {}) }), warnings };
    }
    throw new CliError('INVALID_ARGUMENT', `Unknown bookmarks subcommand: ${sub}. Use tree, delete, or move.`);
  }
  if (command === 'space') {
    const sub = args[0];
    if (sub === 'create') {
      if (!options.name) throw new CliError('INVALID_ARGUMENT', 'space create requires --name.');
      const hue = options.hue !== undefined ? Number(options.hue) : undefined;
      return { data: await callBridge('space.create', { name: options.name, ...(Number.isFinite(hue) ? { hue } : {}), ...(options.icon ? { icon: options.icon } : {}) }), warnings };
    }
    if (sub === 'rename') {
      if (!options.space || !options.name) throw new CliError('INVALID_ARGUMENT', 'space rename requires --space and --name.');
      return { data: await callBridge('space.rename', { space: options.space, name: options.name }), warnings };
    }
    if (sub === 'theme') {
      if (!options.space) throw new CliError('INVALID_ARGUMENT', 'space theme requires --space.');
      const hue = options.hue !== undefined ? Number(options.hue) : undefined;
      if (hue === undefined && options.icon === undefined) {
        throw new CliError('INVALID_ARGUMENT', 'space theme requires --hue and/or --icon.');
      }
      return { data: await callBridge('space.theme', { space: options.space, ...(Number.isFinite(hue) ? { hue } : {}), ...(options.icon !== undefined ? { icon: options.icon } : {}) }), warnings };
    }
    if (sub === 'delete') {
      if (!options.space) throw new CliError('INVALID_ARGUMENT', 'space delete requires --space.');
      return { data: await callBridge('space.delete', { space: options.space, dryRun: Boolean(options['dry-run']) }), warnings };
    }
    throw new CliError('INVALID_ARGUMENT', `Unknown space subcommand: ${sub}. Use create, rename, theme, or delete.`);
  }
  if (command === 'pin') {
    const sub = args[0];
    if (sub === 'add') {
      if (!options.space || !options.url) throw new CliError('INVALID_ARGUMENT', 'pin add requires --space and --url.');
      return { data: await callBridge('pin.add', { space: options.space, url: options.url, title: options.title, folder: options.folder }), warnings };
    }
    if (sub === 'rename') {
      if (!options.id || !options.title) throw new CliError('INVALID_ARGUMENT', 'pin rename requires --id and --title.');
      return { data: await callBridge('pin.rename', { id: options.id, title: options.title }), warnings };
    }
    if (sub === 'move') {
      if (!options.id || !options.space) throw new CliError('INVALID_ARGUMENT', 'pin move requires --id and --space.');
      const index = options.index !== undefined ? Number(options.index) : undefined;
      return { data: await callBridge('pin.move', { id: options.id, space: options.space, folder: options.folder, ...(Number.isInteger(index) ? { index } : {}) }), warnings };
    }
    if (sub === 'delete') {
      if (!options.id) throw new CliError('INVALID_ARGUMENT', 'pin delete requires --id.');
      return { data: await callBridge('pin.delete', { id: options.id, recursive: Boolean(options.recursive), dryRun: Boolean(options['dry-run']) }), warnings };
    }
    throw new CliError('INVALID_ARGUMENT', `Unknown pin subcommand: ${sub}. Use add, rename, move, or delete.`);
  }
  if (command === 'folder') {
    const sub = args[0];
    if (sub === 'create') {
      if (!options.space || !options.title) throw new CliError('INVALID_ARGUMENT', 'folder create requires --space and --title.');
      return { data: await callBridge('folder.create', { space: options.space, title: options.title, parent: options.parent }), warnings };
    }
    if (sub === 'rename') {
      if (!options.id || !options.title) throw new CliError('INVALID_ARGUMENT', 'folder rename requires --id and --title.');
      return { data: await callBridge('folder.rename', { id: options.id, title: options.title }), warnings };
    }
    if (sub === 'delete') {
      if (!options.id) throw new CliError('INVALID_ARGUMENT', 'folder delete requires --id.');
      return { data: await callBridge('folder.delete', { id: options.id, recursive: Boolean(options.recursive), dryRun: Boolean(options['dry-run']) }), warnings };
    }
    throw new CliError('INVALID_ARGUMENT', `Unknown folder subcommand: ${sub}. Use create, rename, or delete.`);
  }
  if (command === 'favorite') {
    const sub = args[0];
    if (sub === 'add') {
      if (!options.url) throw new CliError('INVALID_ARGUMENT', 'favorite add requires --url.');
      return { data: await callBridge('favorite.add', { url: options.url, title: options.title }), warnings };
    }
    if (sub === 'delete') {
      if (!options.id && !options.url) throw new CliError('INVALID_ARGUMENT', 'favorite delete requires --id or --url.');
      return { data: await callBridge('favorite.delete', { id: options.id, url: options.url }), warnings };
    }
    throw new CliError('INVALID_ARGUMENT', `Unknown favorite subcommand: ${sub}. Use add or delete.`);
  }
  if (command === 'site-search') {
    const sub = args[0];
    if (sub === 'list') return { data: await callBridge('siteSearch.list'), warnings };
    if (sub === 'add') {
      if (!options.prefix || !options.label || !options.url) throw new CliError('INVALID_ARGUMENT', 'site-search add requires --prefix, --label, and --url.');
      return { data: await callBridge('siteSearch.add', { prefix: options.prefix, label: options.label, urlTemplate: options.url, accent: options.accent }), warnings };
    }
    if (sub === 'edit') {
      if (!options.prefix) throw new CliError('INVALID_ARGUMENT', 'site-search edit requires --prefix.');
      return { data: await callBridge('siteSearch.edit', { prefix: options.prefix, newPrefix: options['new-prefix'], label: options.label, urlTemplate: options.url, accent: options.accent }), warnings };
    }
    if (sub === 'delete') {
      if (!options.prefix && !options.id) throw new CliError('INVALID_ARGUMENT', 'site-search delete requires --prefix or --id.');
      return { data: await callBridge('siteSearch.delete', { prefix: options.prefix, id: options.id }), warnings };
    }
    if (sub === 'enable' || sub === 'disable') {
      const target = options.id ?? options.prefix;
      if (!target) throw new CliError('INVALID_ARGUMENT', `site-search ${sub} requires --id or --prefix.`);
      return { data: await callBridge('siteSearch.setEnabled', { id: target, enabled: sub === 'enable' }), warnings };
    }
    throw new CliError('INVALID_ARGUMENT', `Unknown site-search subcommand: ${sub}. Use list, add, edit, delete, enable, or disable.`);
  }
  if (command === 'import-arc') {
    const file = options.file ? path.resolve(options.file) : arcSidebarPaths().find(file => fs.existsSync(file));
    if (!file) throw new CliError('NO_ARC_FILE', 'StorableSidebar.json was not found. Specify --file <path>.');
    const document = parseArcSidebar(readJson(file));
    const out = options.out ? writeExport(options.out, document) : undefined;
    return { data: document, warnings, ...(out ? { out } : {}) };
  }
  if (command === 'spaces' && options.live) {
    const live = await callBridge('spaces.list');
    return { data: { ...live, via: 'bridge' }, warnings };
  }
  if (command === 'tree' && options.live) {
    const live = await callBridge('space.tree', options.space ? { space: options.space } : {});
    return { data: { ...live, via: 'bridge' }, warnings };
  }
  if (command === 'lint' && options.live) {
    const liveTree = await callBridge('space.tree');
    let externalRoots = [];
    if (options['all-roots']) {
      const all = await callBridge('bookmarks.tree');
      externalRoots = all.roots ?? [];
    }
    return { data: { ...lintWorkspace({ ...liveTree, externalRoots }), via: 'bridge' }, warnings };
  }
  const profile = selectProfile(options);
  if (command === 'add-pin') {
    // Prefer live Native Messaging bridge when connected (safe while browser is running & Syncs cleanly!)
    if (!options.bookmarks) {
      const status = await bridgeStatus();
      if (status.connected) {
        const data = await callBridge('pin.add', {
          space: options.space,
          url: options.url,
          title: options.title,
          folder: options.folder,
        });
        return { data: { ...data, via: 'bridge' }, warnings };
      }
    }
    const { warnings: writeWarnings, ...data } = addPin(profile, options);
    return { data, warnings: writeWarnings };
  }
  const includeIds = Boolean(options['include-ids']);
  if (command === 'search') {
    const query = args.join(' ');
    const limit = Number(options.limit ?? 20);
    let results = [];
    try { results = searchBookmarks(readBookmarks(profile), query, { includeIds }); }
    catch (error) { if (!options.history) throw error; warnings.push(error.message); }
    let history = { requested: Boolean(options.history), searched: false, days: 30 };
    if (options.history) {
      try {
        const matches = await searchHistory(profile.history, query, limit);
        results.push(...matches);
        history.searched = true;
      } catch (error) { warnings.push(`History search failed: ${error.message}`); history = { ...history, error: error.message }; }
    }
    return { data: { query, limit, results: results.slice(0, limit), history }, warnings };
  }
  const allRoots = Boolean(options['all-roots']);
  const bookmarks = readBookmarks(profile);
  if (command === 'spaces') return { data: listSpaces(bookmarks, { includeIds }), warnings };
  if (command === 'tree') return { data: treeBookmarks(bookmarks, options.space), warnings };
  if (command === 'lint') return { data: lintBookmarks(bookmarks, { allRoots }), warnings };
  const document = exportBookmarks(bookmarks, { includeIds, allRoots });
  const out = options.out ? writeExport(options.out, document) : undefined;
  return { data: document, warnings, ...(out ? { out } : {}) };
}

function human(command, result) {
  const data = result.data;
  if (command === 'help') return help;
  if (command === 'version') return data.version;
  if (command === 'spaces') {
    const favCount = data.favoriteCounts ? `${data.favoriteCounts.pins} links, ${data.favoriteCounts.folders} folders` : `${data.favorites.length} links`;
    return [
      `Global Favorites: ${favCount}`,
      ...data.favorites.map(node => `  ${node.id ? `[${node.id}] ` : ''}${node.title}${node.url ? ` — ${node.url}` : ' (folder)'}`),
      ...data.spaces.map(space => `${space.id ? `[${space.id}] ` : ''}${space.name}: ${space.pins} pins, ${space.folders} folders`),
    ].join('\n');
  }
  if (command === 'search') return data.results.length ? data.results.map(item => `[${item.source}${item.space ? ` / ${item.space}` : ''}] ${item.title}${item.url ? `\n  ${item.url}` : ' (folder)'}`).join('\n') : 'No matches.';
  if (command === 'open') return `Opened ${data.browser}: ${data.url}`;
  if (command === 'add-pin') return `Added ${data.pin.title} to ${data.space}.\nBackup: ${data.backup}`;
  if (result.out) return `Exported to ${result.out}\n${JSON.stringify(data.stats)}`;
  return JSON.stringify(data, null, 2);
}

export async function main(argv = process.argv.slice(2), io = process) {
  let invocation;
  try {
    invocation = parseCli(argv);
    const result = await execute(invocation);
    if (invocation.options.json) io.stdout.write(`${JSON.stringify({ ok: true, command: invocation.command, ...result }, null, 2)}\n`);
    else {
      io.stdout.write(`${human(invocation.command, result)}\n`);
      for (const warning of result.warnings) io.stderr.write(`Warning: ${warning}\n`);
    }
    return 0;
  } catch (error) {
    const envelope = { ok: false, command: invocation?.command ?? null,
      error: { code: error.code ?? 'FAILED', message: error.message }, warnings: [] };
    if (invocation?.options.json || argv.includes('--json')) io.stdout.write(`${JSON.stringify(envelope)}\n`);
    else io.stderr.write(`arcline: ${error.message}\n`);
    return 1;
  }
}
