import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { sanitizeUrl, writeExport } from '../src/common.mjs';
import { addPin, addPinToDocument, arclineRoot, bookmarkChecksum, exportBookmarks, lintBookmarks, listSpaces, searchBookmarks, treeBookmarks } from '../src/bookmarks.mjs';
import { parseArcSidebar } from '../src/arc.mjs';
import { arcSidebarPaths, browserRoots, browserRunning, discoverProfiles, selectProfile } from '../src/profiles.mjs';
import { copyHistory, searchHistory } from '../src/history.mjs';
import { launchSpec, openTarget } from '../src/open.mjs';
import { parseCli } from '../src/cli.mjs';

const bin = fileURLToPath(new URL('../bin/arcline.mjs', import.meta.url));
const cli = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
const folder = (id, name, children = []) => ({ id, name, type: 'folder', date_added: '1', date_modified: '1', children });
const pin = (id, name, url) => ({ id, name, type: 'url', url });
function fixture() {
  return { version: 1, checksum: 'old', checksum_sha256: 'old-sha', sync_metadata: 'keep-me', roots: {
    bookmark_bar: folder('1', 'Bookmarks bar', [pin('99', 'Unrelated', 'https://outside.example/')]),
    other: folder('2', 'Localized Other', [folder('4', 'Arcline', [
      folder('5', 'Favorites', [pin('6', 'GitHub', 'https://github.com/')]),
      folder('7', 'Research', [folder('8', 'Papers', [pin('9', 'Quantum paper', 'https://example.com/paper')]), pin('10', 'Docs', 'https://example.com/docs')]),
      folder('11', 'Personal'),
    ])]), synced: folder('3', 'Mobile bookmarks'),
  } };
}
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arcline-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function stored(t) {
  const directory = temporary(t);
  const file = path.join(directory, 'Bookmarks');
  fs.writeFileSync(file, JSON.stringify(fixture()));
  return { directory, file, profile: { bookmarks: file, browser: null } };
}
function arcFixture() {
  const tab = (id, url, title) => ({ id, title, data: { tab: { savedURL: url, savedTitle: id } } });
  return { sidebar: { containers: [{ global: {} }, {
    spaces: ['space-id', { id: 'space-id', title: 'Science', containerIDs: ['pinned', 'pins', 'unpinned', 'today'], customInfo: { iconType: { emoji: '🔬' } } }],
    topAppsContainerIDs: [{ default: true }, 'top'],
    items: ['pins', { id: 'pins', childrenIds: ['folder', 'duplicate', 'unsafe', 'data', 'empty', 'search', 'mobile', 'wrapper', 'missing'] },
      { id: 'folder', title: 'Papers', data: { list: {} }, childrenIds: ['paper', 'folder'] },
      tab('paper', 'https://example.com/paper', 'A paper'), tab('duplicate', 'https://example.com/paper'),
      tab('unsafe', 'javascript:alert(1)'), tab('data', 'data:text/html,bad'),
      { id: 'empty', title: 'Empty', data: { itemContainer: {} }, childrenIds: [] },
      tab('search', 'https://www.google.com/search?q=x'), tab('mobile', 'file:///private/var/mobile/old'),
      { id: 'wrapper', data: { itemContainer: {} }, childrenIds: ['other'] }, tab('other', 'https://example.org/'),
      { id: 'top', childrenIds: ['favorite', 'bad-favorite'] }, tab('favorite', 'https://github.com/', 'GitHub'), tab('bad-favorite', 'java\nscript:evil'),
      { id: 'today', childrenIds: ['temporary'] }, tab('temporary', 'https://temporary.example/'),
    ],
  }] } };
}

test('exports only Arcline with portable nested structure and recursive counts', () => {
  const original = fixture();
  const result = exportBookmarks(original);
  assert.equal(result.format, 'arcline');
  assert.equal(result.version, '1.0.0');
  assert.deepEqual(result.stats, { spaces: 2, favorites: 1, pins: 2, folders: 1 });
  assert.equal(result.spaces[0].pinned[0].children[0].title, 'Quantum paper');
  assert.ok(!JSON.stringify(result).includes('outside.example'));
  assert.ok(!JSON.stringify(result).includes('date_added'));
  assert.deepEqual(original, fixture());
});

test('lists global favorites, spaces and counts including empty Spaces', () => {
  const result = listSpaces(fixture());
  assert.deepEqual(result.spaces, [{ name: 'Research', pins: 2, folders: 1 }, { name: 'Personal', pins: 0, folders: 0 }]);
  assert.equal(result.favorites[0].url, 'https://github.com/');
});

test('search matches title, URL, Space and nested folder path without unrelated bookmarks', () => {
  assert.equal(searchBookmarks(fixture(), 'GITHUB')[0].source, 'favorite');
  assert.equal(searchBookmarks(fixture(), 'Quantum')[0].space, 'Research');
  assert.equal(searchBookmarks(fixture(), '/docs')[0].title, 'Docs');
  assert.equal(searchBookmarks(fixture(), 'papers').length, 2);
  assert.deepEqual(searchBookmarks(fixture(), 'paper')[1].path, ['Papers', 'Quantum paper']);
  assert.equal(searchBookmarks(fixture(), 'Research').length, 3);
  assert.equal(searchBookmarks(fixture(), 'outside').length, 0);
});

test('missing and ambiguous Arcline roots fail explicitly', () => {
  assert.throws(() => arclineRoot({}), { code: 'NO_ARCLINE_ROOT' });
  const document = fixture();
  document.roots.other.children.push(structuredClone(document.roots.other.children[0]));
  assert.throws(() => arclineRoot(document), { code: 'AMBIGUOUS_ROOT' });
});

test('URL sanitizer rejects executable, obfuscated, relative and malformed URLs', () => {
  for (const url of ['javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'data:text/html,x', 'vbscript:x', 'java\nscript:x', 'https://good.test/\u0000', '//relative.test', '/relative', '', 'https://', 'custom:action']) {
    assert.throws(() => sanitizeUrl(url), { name: 'Error' }, url);
  }
  assert.equal(sanitizeUrl(' https://example.com '), 'https://example.com/');
  assert.equal(sanitizeUrl('file:///tmp/report.pdf'), 'file:///tmp/report.pdf');
});

test('add-pin preserves metadata and unrelated nodes, creates nested folders and unique IDs', () => {
  const document = fixture();
  const added = addPinToDocument(document, { space: 'Research', folder: 'New/Deep', url: 'https://example.net', title: 'New pin' });
  assert.equal(added.id, '102');
  assert.match(added.guid, /^[0-9a-f-]{36}$/);
  assert.ok(BigInt(added.date_added) > 11644473600000000n);
  assert.equal(document.sync_metadata, 'keep-me');
  assert.deepEqual(document.roots.bookmark_bar, fixture().roots.bookmark_bar);
  assert.equal(exportBookmarks(document).spaces[0].pinned[2].children[0].children[0].url, 'https://example.net/');
  assert.equal(document.checksum, bookmarkChecksum(document));
  assert.equal(document.checksum_sha256, bookmarkChecksum(document, 'sha256'));
});

test('checksum follows Chromium order and UTF-16 title encoding independently', () => {
  const document = { roots: { other: folder('2', 'é', [pin('4', '日本', 'https://example.com/')]), bookmark_bar: folder('1', 'Bar'), synced: folder('3', '') } };
  const hash = createHash('md5');
  for (const [id, name, type, url] of [['1', 'Bar', 'folder'], ['2', 'é', 'folder'], ['4', '日本', 'url', 'https://example.com/'], ['3', '', 'folder']]) {
    hash.update(id).update(Buffer.from(name, 'utf16le')).update(type);
    if (url) hash.update(url);
  }
  assert.equal(bookmarkChecksum(document), hash.digest('hex'));
});

test('add-pin rejects unknown/duplicate Spaces, unsafe URLs and invalid folder paths', () => {
  for (const options of [{ space: 'Missing' }, { space: 'Favorites' }, { space: 'Research', folder: '../oops' }, { space: 'Research', folder: 'a//b' }, { space: 'Research', url: 'data:text/html,x' }]) {
    assert.throws(() => addPinToDocument(fixture(), { url: 'https://example.com/', ...options }));
  }
  const document = fixture();
  arclineRoot(document).children.push(folder('105', 'Research'));
  assert.throws(() => addPinToDocument(document, { space: 'Research', url: 'https://example.com/' }), { code: 'INVALID_SPACE' });
});

test('atomic pin write retains exact original backup and removes transient files', t => {
  const { directory, file, profile } = stored(t);
  const original = fs.readFileSync(file);
  const result = addPin(profile, { space: 'Personal', url: 'https://example.org/' }, { checkRunning: () => false });
  assert.deepEqual(fs.readFileSync(result.backup), original);
  assert.equal(exportBookmarks(JSON.parse(fs.readFileSync(file))).spaces[1].pinned.length, 1);
  assert.equal(fs.readdirSync(directory).length, 2);
});

test('running or unknown browser refuses writes, force reports warning', t => {
  const { file, profile } = stored(t);
  const original = fs.readFileSync(file);
  const options = { space: 'Personal', url: 'https://example.org/' };
  for (const state of [true, null]) {
    assert.throws(() => addPin(profile, options, { checkRunning: () => state }), { code: 'BROWSER_RUNNING' });
    assert.deepEqual(fs.readFileSync(file), original);
  }
  const result = addPin(profile, { ...options, force: true }, { checkRunning: () => true });
  assert.equal(result.warnings.length, 1);
});

test('concurrent bookmark modification is detected even with force', t => {
  const { file, profile } = stored(t);
  let calls = 0;
  const concurrent = JSON.stringify({ ...fixture(), concurrent: true });
  assert.throws(() => addPin(profile, { space: 'Personal', url: 'https://example.org/', force: true }, {
    checkRunning: () => { if (++calls === 2) fs.writeFileSync(file, concurrent); return false; },
  }), { code: 'CONCURRENT_CHANGE' });
  assert.equal(fs.readFileSync(file, 'utf8'), concurrent);
  assert.ok(!fs.existsSync(`${file}.arcline.lock`));
});

test('exclusive writer lock is respected and never removed by another writer', t => {
  const { file, profile } = stored(t);
  fs.writeFileSync(`${file}.arcline.lock`, 'other');
  assert.throws(() => addPin(profile, { space: 'Personal', url: 'https://example.org/' }), { code: 'WRITE_LOCKED' });
  assert.equal(fs.readFileSync(`${file}.arcline.lock`, 'utf8'), 'other');
});

test('portable output refuses overwrite, including Bookmarks itself', t => {
  const { directory, file } = stored(t);
  const original = fs.readFileSync(file);
  assert.throws(() => writeExport(file, exportBookmarks(fixture())), { code: 'EEXIST' });
  assert.deepEqual(fs.readFileSync(file), original);
  const output = path.join(directory, 'workspace.json');
  writeExport(output, exportBookmarks(fixture()));
  assert.deepEqual(JSON.parse(fs.readFileSync(output)), exportBookmarks(fixture()));
});

test('Arc import handles mixed dictionaries, nested folders, unsafe links, cycles and cleanup stats', () => {
  const result = parseArcSidebar(arcFixture());
  assert.equal(result.spaces[0].name, 'Science');
  assert.equal(result.spaces[0].icon, '🔬');
  assert.equal(result.spaces[0].pinned[0].children[0].title, 'A paper');
  assert.equal(result.spaces[0].pinned[1].url, 'https://example.org/');
  assert.equal(result.favorites[0].title, 'GitHub');
  assert.deepEqual(result.stats, { spaces: 1, favorites: 1, pins: 2, folders: 1,
    skippedUnsafe: 3, skippedBroken: 1, skippedSearches: 1, skippedEmptyFolders: 1, deduped: 1, skippedReferences: 2 });
  assert.ok(!JSON.stringify(result).includes('temporary.example'));
});

test('Arc parentID favorites, multiple containers and empty Spaces are supported', () => {
  const input = arcFixture();
  const container = input.sidebar.containers[1];
  container.items.find(item => item.id === 'top').childrenIds = [];
  container.items.find(item => item.id === 'favorite').parentID = 'top';
  input.sidebar.containers.push({ spaces: [{ title: 'Empty', containerIDs: [] }], items: [] });
  const result = parseArcSidebar(input);
  assert.equal(result.favorites.length, 1);
  assert.deepEqual(result.spaces[1], { name: 'Empty', pinned: [] });
  assert.throws(() => parseArcSidebar({ sidebar: { containers: 'bad' } }), { code: 'INVALID_ARC' });
  assert.throws(() => parseArcSidebar(null), { code: 'INVALID_ARC' });
});

test('profile roots cover macOS, Linux XDG and Windows local app data', () => {
  assert.ok(browserRoots({ platform: 'darwin', home: '/home/test', env: {} }).some(r => r.userDataDir === '/home/test/Library/Application Support/Arc/User Data'));
  assert.ok(browserRoots({ platform: 'linux', home: '/home/test', env: { XDG_CONFIG_HOME: '/config' } }).some(r => r.userDataDir === '/config/google-chrome'));
  assert.ok(browserRoots({ platform: 'win32', home: 'C:\\Users\\Test', env: { LOCALAPPDATA: 'C:\\Local' } }).some(r => r.userDataDir === 'C:\\Local\\BraveSoftware\\Brave-Browser\\User Data'));
  assert.equal(arcSidebarPaths({ platform: 'darwin', home: '/test', env: {} })[0], '/test/Library/Application Support/Arc/StorableSidebar.json');
});

test('profile discovery honors filters, Local State labels and explicit file override', t => {
  const directory = temporary(t);
  for (const name of ['Default', 'Profile 1']) {
    fs.mkdirSync(path.join(directory, name));
    fs.writeFileSync(path.join(directory, name, 'Bookmarks'), JSON.stringify(fixture()));
  }
  fs.writeFileSync(path.join(directory, 'Local State'), JSON.stringify({ profile: { info_cache: { 'Profile 1': { name: 'Work' } } } }));
  const roots = [{ browser: 'brave', userDataDir: directory }];
  const profiles = discoverProfiles({ roots });
  assert.equal(profiles.length, 2);
  assert.equal(profiles[1].name, 'Work');
  assert.equal(discoverProfiles({ roots, browser: 'chrome' }).length, 0);
  assert.equal(discoverProfiles({ roots, profile: 'Default' }).length, 1);
  assert.throws(() => selectProfile({}, profiles), { code: 'AMBIGUOUS_PROFILE' });
  assert.throws(() => selectProfile({}, []), { code: 'NO_PROFILE' });
  const explicit = selectProfile({ bookmarks: profiles[1].bookmarks }, profiles);
  assert.equal(explicit.profile, 'Profile 1');
});

test('browser process detection distinguishes executables from unrelated names', () => {
  for (const [platform, output, browser] of [
    ['darwin', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser\n', 'brave'],
    ['darwin', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome\n', 'chrome'],
    ['linux', '/opt/google/chrome/chrome\n', 'chrome'],
    ['linux', '/usr/lib/chromium/chromium\n', 'chromium'],
    ['win32', '"brave.exe","123","Console"\n', 'brave'],
    ['win32', '"Arc.exe","123","Console"\n', 'arc'],
  ]) assert.equal(browserRunning(browser, { platform, run: () => ({ status: 0, stdout: output }) }), true);
  assert.equal(browserRunning('brave', { run: () => ({ status: 0, stdout: '/usr/bin/node\n/usr/bin/bash' }) }), false);
  assert.equal(browserRunning('brave', { run: () => ({ status: 1 }) }), null);
});

test('open resolves URLs/domains/searches/New Tab and refuses unsafe schemes', () => {
  assert.equal(openTarget('https://example.com/a'), 'https://example.com/a');
  assert.equal(openTarget('example.com/a'), 'https://example.com/a');
  assert.equal(openTarget('localhost:8080'), 'https://localhost:8080/');
  assert.equal(openTarget('quantum & optics'), 'https://www.google.com/search?q=quantum%20%26%20optics');
  assert.equal(openTarget(''), 'brave://newtab/');
  assert.equal(openTarget('', 'chrome'), 'chrome://newtab/');
  assert.throws(() => openTarget('javascript:alert(1)'), { code: 'UNSAFE_URL' });
  assert.throws(() => openTarget('data:text/html,x'), { code: 'UNSAFE_URL' });
});

test('browser launch plans pass arguments without a shell on all supported platforms', () => {
  const url = 'https://example.com/?q=$(anything)';
  assert.deepEqual(launchSpec('chrome', url, { platform: 'darwin', profile: 'Profile 1' }), {
    command: 'open', args: ['-n', '-a', 'Google Chrome', '--args', '--profile-directory=Profile 1', url],
  });
  assert.deepEqual(launchSpec('brave', url, { platform: 'darwin' }), {
    command: 'open', args: ['-a', 'Brave Browser', url],
  });
  assert.equal(launchSpec('brave', url, { platform: 'win32', env: { LOCALAPPDATA: 'C:\\Local' }, exists: () => true }).command, 'C:\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe');
  assert.equal(launchSpec('chrome', url, { platform: 'linux', env: { PATH: '/bin' }, exists: p => p.endsWith('/google-chrome') }).command, '/bin/google-chrome');
  assert.throws(() => launchSpec('arc', url), { code: 'INVALID_BROWSER' });
});

test('argument parser rejects unknown options, invalid limits and stray flags', () => {
  for (const args of [['search'], ['search', 'x', '--limit', '0'], ['search', 'x', '--limit', '1.2'], ['search', 'x', '--limit', '10001'], ['spaces', '--force'], ['spaces', '--browser', 'unknown'], ['spaces', '--profile', '../Default'], ['add-pin', '--space', 'Main'], ['open', '--url', 'x'], ['spaces', '--wat']]) assert.throws(() => parseCli(args));
  assert.equal(parseCli(['--json', 'search', 'two', 'words']).args.join(' '), 'two words');
});

test('CLI help and version execute cleanly', () => {
  const result = cli('--help');
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  for (const command of ['doctor', 'spaces', 'search', 'add-pin', 'export', 'import-arc', 'open']) assert.ok(result.stdout.includes(command));
  assert.equal(cli('--version').stdout.trim(), '1.0.0');
});

test('CLI JSON envelope, search limit and readable spaces output', t => {
  const { file } = stored(t);
  const result = cli('spaces', '--bookmarks', file, '--json');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(JSON.parse(result.stdout).data.spaces.length, 2);
  assert.ok(cli('spaces', '--bookmarks', file).stdout.includes('Research: 2 pins, 1 folders'));
  const search = JSON.parse(cli('search', 'paper', '--bookmarks', file, '--limit', '1', '--json').stdout);
  assert.equal(search.data.results.length, 1);
});

test('CLI reports machine-readable errors with nonzero exit codes', t => {
  const { directory } = stored(t);
  for (const args of [['spaces', '--bookmarks', path.join(directory, 'absent')], ['search', 'x', '--limit', 'oops'], ['unknown']]) {
    const result = cli(...args, '--json');
    assert.equal(result.status, 1);
    const error = JSON.parse(result.stdout);
    assert.equal(error.ok, false);
    assert.ok(error.error.code);
    assert.equal(result.stderr, '');
  }
});

test('CLI export writes portable JSON and does not overwrite its input', t => {
  const { directory, file } = stored(t);
  const output = path.join(directory, 'export.json');
  const result = cli('export', '--bookmarks', file, '--out', output, '--json');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(output)), exportBookmarks(fixture()));
  assert.deepEqual(JSON.parse(cli('export', '--bookmarks', file).stdout), exportBookmarks(fixture()));
  assert.equal(cli('export', '--bookmarks', file, '--out', file, '--json').status, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), fixture());
});

test('CLI import-arc uses explicit file and exports stats without modifying source', t => {
  const directory = temporary(t);
  const file = path.join(directory, 'StorableSidebar.json');
  const output = path.join(directory, 'arc-workspace.json');
  const input = JSON.stringify(arcFixture());
  fs.writeFileSync(file, input);
  const result = cli('import-arc', '--file', file, '--out', output, '--json');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).data.stats.pins, 2);
  assert.equal(JSON.parse(fs.readFileSync(output)).spaces[0].name, 'Science');
  assert.equal(fs.readFileSync(file, 'utf8'), input);
});

test('CLI add-pin operates only on fixture with explicit force and exposes backup', t => {
  const { file } = stored(t);
  const result = cli('add-pin', '--bookmarks', file, '--space', 'Personal', '--url', 'https://new.example/', '--title', 'New', '--folder', 'Links', '--force', '--json');
  assert.equal(result.status, 0, result.stdout);
  const response = JSON.parse(result.stdout);
  assert.ok(fs.existsSync(response.data.backup));
  assert.equal(response.data.pin.title, 'New');
  assert.equal(exportBookmarks(JSON.parse(fs.readFileSync(file))).spaces[1].pinned[0].title, 'Links');
});

test('doctor reports root and build/Arc availability even without a usable profile', t => {
  const { directory, file } = stored(t);
  const result = cli('doctor', '--bookmarks', file, '--json');
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout).data;
  assert.equal(data.bookmarkRoot.found, true);
  assert.equal(typeof data.extension.ready, 'boolean');
  assert.ok(Array.isArray(data.arc));
  const missing = JSON.parse(cli('doctor', '--bookmarks', path.join(directory, 'missing'), '--json').stdout);
  assert.equal(missing.data.bookmarkRoot.found, false);
  assert.ok(missing.warnings.length);
});

test('missing optional history produces explicit partial-result warning', t => {
  const { file } = stored(t);
  const result = cli('search', 'GitHub', '--bookmarks', file, '--history', '--json');
  const response = JSON.parse(result.stdout);
  assert.equal(result.status, 0);
  assert.equal(response.data.results[0].source, 'favorite');
  assert.equal(response.data.history.searched, false);
  assert.ok(response.warnings.some(w => w.includes('History search failed')));
});

test('history snapshot refuses an active rollback journal without touching source', t => {
  const directory = temporary(t);
  const source = path.join(directory, 'source');
  const target = path.join(directory, 'copy');
  fs.mkdirSync(target);
  fs.writeFileSync(source, 'original');
  fs.writeFileSync(`${source}-journal`, 'active');
  assert.throws(() => copyHistory(source, target), { code: 'HISTORY_BUSY' });
  assert.equal(fs.readFileSync(source, 'utf8'), 'original');
});

async function historyFixture(t) {
  // Tests use the same dependency-free backend choices as the CLI.
  let sqlite;
  try { sqlite = await import('node:sqlite'); } catch { sqlite = null; }
  const { directory, file } = stored(t);
  const history = path.join(directory, 'History');
  const now = Date.now();
  const recent = now * 1000 + 11644473600000000;
  const old = (now - 40 * 86400000) * 1000 + 11644473600000000;
  const sql = `CREATE TABLE urls (id INTEGER PRIMARY KEY, url TEXT, title TEXT, last_visit_time INTEGER);
    INSERT INTO urls VALUES (1, 'https://history.example/older', 'History older', ${recent - 1000000}),
      (2, 'https://history.example/latest', 'History latest', ${recent}),
      (3, 'https://history.example/old', 'History old', ${old}),
      (4, 'https://literal.example/', '100%_literal', ${recent});`;
  if (sqlite) {
    const db = new sqlite.DatabaseSync(history);
    db.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;');
    db.exec(sql);
    t.after(() => db.close());
    return { history, now, directory, file, sqlite, db };
  }
  const result = spawnSync('sqlite3', [history, sql], { encoding: 'utf8' });
  assert.equal(result.status, 0, 'Install sqlite3 to test history on early Node.js 22.');
  return { history, now, directory, file, sqlite };
}

test('history reads recent WAL data from a copy, sorts and limits without modifying live files', async t => {
  const { history, now, sqlite } = await historyFixture(t);
  const before = fs.readFileSync(history);
  const wal = fs.existsSync(`${history}-wal`) ? fs.readFileSync(`${history}-wal`) : null;
  const results = await searchHistory(history, 'HISTORY', 1, { now, sqliteModule: sqlite });
  assert.equal(results.length, 1);
  assert.equal(results[0].url, 'https://history.example/latest');
  assert.equal(results[0].lastVisited, new Date(now).toISOString());
  assert.deepEqual(fs.readFileSync(history), before);
  if (wal) assert.deepEqual(fs.readFileSync(`${history}-wal`), wal);
  assert.equal((await searchHistory(history, 'history', 20, { now })).length, 2);
  assert.equal((await searchHistory(history, '%_', 20, { now }))[0].title, '100%_literal');
  assert.equal((await searchHistory(history, "' OR 1=1 --", 20, { now })).length, 0);
});

test('sqlite3 fallback uses readonly copied file and safely transports query text', async t => {
  const { history, now } = await historyFixture(t);
  let snapshot;
  await searchHistory(history, "x'; DROP TABLE urls;--", 5, { now, sqliteModule: null, run: (command, args) => {
    assert.equal(command, 'sqlite3');
    assert.deepEqual(args.slice(0, 2), ['-readonly', '-json']);
    snapshot = args[2];
    assert.notEqual(snapshot, history);
    assert.ok(fs.existsSync(snapshot));
    assert.ok(!args[3].includes('DROP TABLE'));
    assert.ok(args[3].includes("CAST(X'"));
    return { status: 0, stdout: '[]' };
  } });
  assert.ok(!fs.existsSync(path.dirname(snapshot)));
});

test('sqlite3 fallback executes against real fixture when sqlite3 is available', async t => {
  const probe = spawnSync('sqlite3', ['-version'], { encoding: 'utf8' });
  if (probe.error?.code === 'ENOENT') return t.skip('Optional sqlite3 executable is not installed; native backend is tested.');
  const { history, now } = await historyFixture(t);
  const results = await searchHistory(history, 'history', 20, { now, sqliteModule: null });
  assert.equal(results.length, 2);
  assert.equal(results[0].title, 'History latest');
});

test('CLI combines bookmark matches and history with total limit', async t => {
  const { file } = await historyFixture(t);
  const result = cli('search', 'example', '--bookmarks', file, '--history', '--limit', '4', '--json');
  assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout).data;
  assert.equal(data.history.searched, true);
  assert.equal(data.results.length, 4);
  assert.equal(data.results[0].source, 'pin');
  assert.ok(data.results.some(r => r.source === 'history'));
});

test('tree, lint, and --include-ids expose bookmark IDs and detect duplicates/empty/URL-title pins', () => {
  const doc = fixture();
  const root = arclineRoot(doc);
  // Add duplicate Space, duplicate identical folder, duplicate URL, empty folder, and mismatched URL title
  root.children.push(folder('200', 'Research', [
    folder('201', 'Papers', [pin('202', 'Quantum paper', 'https://example.com/paper')]),
    folder('203', 'Papers', [pin('204', 'Quantum paper', 'https://example.com/paper')]),
    folder('205', 'EmptyDir', []),
    pin('206', 'https://other.example/redirect', 'https://scitan.net/typing'),
  ]));

  const spacesWithIds = listSpaces(doc, { includeIds: true });
  assert.equal(spacesWithIds.spaces[0].id, '7');
  assert.equal(spacesWithIds.favorites[0].id, '6');

  const searchWithIds = searchBookmarks(doc, 'Quantum', { includeIds: true });
  assert.equal(searchWithIds[0].id, '9');

  // Duplicate Space name error lists candidate IDs
  assert.throws(() => treeBookmarks(doc, 'Research'), err => err.code === 'AMBIGUOUS_SPACE' && err.message.includes('7') && err.message.includes('200'));

  const byId = treeBookmarks(doc, '200');
  assert.equal(byId.space.id, '200');
  assert.equal(byId.nodes[0].id, '201');

  const report = lintBookmarks(doc);
  assert.equal(report.summary.duplicateSpaces, 1);
  assert.deepEqual(report.duplicateSpaces[0].ids, ['7', '200']);
  assert.equal(report.summary.duplicateFolders, 1);
  assert.equal(report.duplicateFolders[0].identicalContent, true);
  assert.equal(report.summary.duplicateUrls, 1);
  assert.equal(report.summary.emptyFolders, 1);
  assert.equal(report.summary.urlAsTitlePins, 1);
  assert.equal(report.summary.mismatchedUrlTitlePins, 1);
});

test('discoverProfiles respects ARCLINE_BROWSER and ARCLINE_PROFILE env defaults', t => {
  const base = temporary(t);
  const braveDefault = path.join(base, 'brave', 'Default');
  const chromeDefault = path.join(base, 'chrome', 'Default');
  fs.mkdirSync(braveDefault, { recursive: true });
  fs.mkdirSync(chromeDefault, { recursive: true });
  fs.writeFileSync(path.join(braveDefault, 'Bookmarks'), JSON.stringify(fixture()));
  fs.writeFileSync(path.join(chromeDefault, 'Bookmarks'), JSON.stringify(fixture()));
  const roots = [
    { browser: 'brave', userDataDir: path.join(base, 'brave') },
    { browser: 'chrome', userDataDir: path.join(base, 'chrome') },
  ];
  // Passing env via options
  const prevBrowser = process.env.ARCLINE_BROWSER;
  const prevProfile = process.env.ARCLINE_PROFILE;
  process.env.ARCLINE_BROWSER = 'brave';
  process.env.ARCLINE_PROFILE = 'Default';
  try {
    const selected = selectProfile({}, discoverProfiles({ roots, browser: process.env.ARCLINE_BROWSER, profile: process.env.ARCLINE_PROFILE }));
    assert.equal(selected.browser, 'brave');
    assert.equal(selected.profile, 'Default');
  } finally {
    if (prevBrowser === undefined) delete process.env.ARCLINE_BROWSER;
    else process.env.ARCLINE_BROWSER = prevBrowser;
    if (prevProfile === undefined) delete process.env.ARCLINE_PROFILE;
    else process.env.ARCLINE_PROFILE = prevProfile;
  }
});
