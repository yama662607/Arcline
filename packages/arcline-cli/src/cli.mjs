import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CliError, readJson, writeExport } from './common.mjs';
import { arcSidebarPaths, browsers, discoverProfiles, hasArcline, selectProfile } from './profiles.mjs';
import { addPin, arclineRoot, exportBookmarks, listSpaces, readBookmarks, searchBookmarks } from './bookmarks.mjs';
import { parseArcSidebar } from './arc.mjs';
import { searchHistory } from './history.mjs';
import { openBrowser } from './open.mjs';

export const help = `Arcline 1.0.0 — local browser workspace CLI (Node.js 22+)

Usage: arcline <command> [options]

Commands:
  doctor                         Inspect profiles, Arcline root, Arc file, extension build
  spaces                         List Spaces, recursive pin/folder counts and Favorites
  search <query> [--history]      Search Favorites, pinned links/folders, optionally History
           [--limit 20]          Maximum combined results (1–10000); History: last 30 days
  add-pin --space <name> --url <url> [--title <title>] [--folder <path>] [--force]
                                 Add a pin to an existing Space, creating nested folders
  export [--out <file>]           Export clean portable workspace JSON
  import-arc [--file <path>] [--out <file>]
                                 Parse StorableSidebar.json; no browser mutation
  open [url or search words]      Launch browser; no query opens its New Tab page

Profile options (doctor/spaces/search/add-pin/export):
  --browser brave|chrome|chromium|arc
  --profile <directory>          Example: Default or 'Profile 1' (not display name)
  --bookmarks <path>             Explicit Bookmarks file; History is its sibling
  Automatic selection prefers profiles containing Arcline; ambiguity is an error.

Common options:
  --json                        One {ok, command, data, warnings} object on stdout
  --help, -h                    Show help
  --version                     Print 1.0.0

open options: --browser brave|chrome (default brave), --profile <directory>
Writes: quit the browser first. --force accepts overwrite risk; backups are retained.
Exports: --out creates a new file and refuses to overwrite existing files.
New Tab honors any installed extension override. Direct Command Bar activation is
not available through this filesystem CLI; use the extension's browser shortcut.
`;

const globalOptions = ['json', 'help', 'version'];
const profileOptions = ['browser', 'profile', 'bookmarks'];
const commandOptions = {
  doctor: [...profileOptions], spaces: [...profileOptions],
  search: [...profileOptions, 'history', 'limit'],
  'add-pin': [...profileOptions, 'space', 'url', 'title', 'folder', 'force'],
  export: [...profileOptions, 'out'], 'import-arc': ['file', 'out'], open: ['browser', 'profile'],
};

export function parseCli(argv) {
  const options = Object.fromEntries(['browser', 'profile', 'bookmarks', 'limit', 'space', 'url', 'title', 'folder', 'out', 'file'].map(name => [name, { type: 'string' }]));
  for (const name of ['json', 'history', 'force', 'version']) options[name] = { type: 'boolean' };
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
  if (!['open', 'search'].includes(command) && positionals.length) throw new CliError('INVALID_ARGUMENT', `${command} does not accept positional arguments.`);
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
  if (command === 'import-arc') {
    const file = options.file ? path.resolve(options.file) : arcSidebarPaths().find(file => fs.existsSync(file));
    if (!file) throw new CliError('NO_ARC_FILE', 'StorableSidebar.json was not found. Specify --file <path>.');
    const document = parseArcSidebar(readJson(file));
    const out = options.out ? writeExport(options.out, document) : undefined;
    return { data: document, warnings, ...(out ? { out } : {}) };
  }
  const profile = selectProfile(options);
  if (command === 'add-pin') {
    const { warnings: writeWarnings, ...data } = addPin(profile, options);
    return { data, warnings: writeWarnings };
  }
  if (command === 'search') {
    const query = args.join(' ');
    const limit = Number(options.limit ?? 20);
    let results = [];
    try { results = searchBookmarks(readBookmarks(profile), query); }
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
  const bookmarks = readBookmarks(profile);
  if (command === 'spaces') return { data: listSpaces(bookmarks), warnings };
  const document = exportBookmarks(bookmarks);
  const out = options.out ? writeExport(options.out, document) : undefined;
  return { data: document, warnings, ...(out ? { out } : {}) };
}

function human(command, result) {
  const data = result.data;
  if (command === 'help') return help;
  if (command === 'version') return data.version;
  if (command === 'spaces') return [
    `Global Favorites: ${data.favoriteCounts.pins} links, ${data.favoriteCounts.folders} folders`,
    ...data.favorites.map(node => `  ${node.title}${node.url ? ` — ${node.url}` : ' (folder)'}`),
    ...data.spaces.map(space => `${space.name}: ${space.pins} pins, ${space.folders} folders`),
  ].join('\n');
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
