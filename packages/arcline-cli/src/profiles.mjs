import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { CliError, readJson } from './common.mjs';

export const browsers = ['brave', 'chrome', 'chromium', 'arc'];

function directories(root) {
  try { return fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name); }
  catch { return []; }
}

export function browserRoots({ platform = process.platform, home = os.homedir(), env = process.env } = {}) {
  const p = platform === 'win32' ? path.win32 : path.posix;
  let roots;
  if (platform === 'darwin') {
    const base = p.join(home, 'Library', 'Application Support');
    roots = {
      brave: [p.join(base, 'BraveSoftware', 'Brave-Browser')],
      chrome: [p.join(base, 'Google', 'Chrome')], chromium: [p.join(base, 'Chromium')],
      arc: [p.join(base, 'Arc', 'User Data')],
    };
  } else if (platform === 'win32') {
    const base = env.LOCALAPPDATA || p.join(home, 'AppData', 'Local');
    const packages = p.join(base, 'Packages');
    roots = {
      brave: [p.join(base, 'BraveSoftware', 'Brave-Browser', 'User Data')],
      chrome: [p.join(base, 'Google', 'Chrome', 'User Data')],
      chromium: [p.join(base, 'Chromium', 'User Data')],
      arc: [p.join(base, 'Arc', 'User Data'),
        ...directories(packages).filter(n => /^TheBrowserCompany\.Arc_/i.test(n))
          .map(n => p.join(packages, n, 'LocalCache', 'Local', 'Arc', 'User Data'))],
    };
  } else {
    const base = env.XDG_CONFIG_HOME || p.join(home, '.config');
    roots = {
      brave: [p.join(base, 'BraveSoftware', 'Brave-Browser')],
      chrome: [p.join(base, 'google-chrome')],
      chromium: [p.join(base, 'chromium'), p.join(home, 'snap', 'chromium', 'common', 'chromium'),
        p.join(home, '.var', 'app', 'org.chromium.Chromium', 'config', 'chromium')],
      arc: [p.join(base, 'Arc', 'User Data')],
    };
  }
  return browsers.flatMap(browser => roots[browser].map(userDataDir => ({ browser, userDataDir })));
}

export function discoverProfiles(options = {}) {
  const result = [];
  for (const { browser, userDataDir } of options.roots ?? browserRoots(options)) {
    if (options.browser && options.browser !== browser) continue;
    let cache = {};
    try { cache = readJson(path.join(userDataDir, 'Local State')).profile?.info_cache ?? {}; } catch { /* optional */ }
    const names = new Set(['Default', ...Object.keys(cache), ...directories(userDataDir)]);
    for (const profile of names) {
      if (profile === '.' || profile === '..' || /[/\\]/u.test(profile)) continue;
      const profileDir = path.join(userDataDir, profile);
      const bookmarks = path.join(profileDir, 'Bookmarks');
      const history = path.join(profileDir, 'History');
      if (!fs.existsSync(bookmarks) && !fs.existsSync(history)) continue;
      if (options.profile && options.profile !== profile) continue;
      result.push({ browser, profile, name: cache[profile]?.name ?? profile, userDataDir,
        profileDir, bookmarks, history, hasBookmarks: fs.existsSync(bookmarks), hasHistory: fs.existsSync(history) });
    }
  }
  return result.sort((a, b) => browsers.indexOf(a.browser) - browsers.indexOf(b.browser)
    || Number(b.profile === 'Default') - Number(a.profile === 'Default') || a.profile.localeCompare(b.profile));
}

export function hasArcline(profile) {
  try { return readJson(profile.bookmarks).roots?.other?.children?.some(n => n.type === 'folder' && n.name === 'Arcline') ?? false; }
  catch { return false; }
}

export function selectProfile(options, profiles = discoverProfiles(options)) {
  if (options.bookmarks) {
    const bookmarks = path.resolve(options.bookmarks);
    const known = profiles.find(p => path.resolve(p.bookmarks) === bookmarks);
    if (known) return known;
    const profileDir = path.dirname(bookmarks);
    return { browser: options.browser ?? null, profile: path.basename(profileDir), profileDir,
      userDataDir: path.dirname(profileDir), bookmarks, history: path.join(profileDir, 'History'),
      hasBookmarks: fs.existsSync(bookmarks), hasHistory: fs.existsSync(path.join(profileDir, 'History')) };
  }
  const withRoot = profiles.filter(hasArcline);
  const candidates = withRoot.length ? withRoot : profiles;
  if (!candidates.length) throw new CliError('NO_PROFILE', 'No browser profile found. Use --browser, --profile, or --bookmarks <path>.');
  if (candidates.length > 1) throw new CliError('AMBIGUOUS_PROFILE', 'Multiple profiles match. Select one with --browser and --profile, or --bookmarks <path>.');
  return candidates[0];
}

export function arcSidebarPaths(options = {}) {
  const platform = options.platform ?? process.platform;
  const home = options.home ?? os.homedir();
  const p = platform === 'win32' ? path.win32 : path;
  const roots = browserRoots(options).filter(r => r.browser === 'arc');
  return [...new Set([
    ...(platform === 'darwin' ? [p.join(home, 'Library', 'Application Support', 'Arc', 'StorableSidebar.json')] : []),
    ...roots.flatMap(r => [p.join(r.userDataDir, 'StorableSidebar.json'), p.join(p.dirname(r.userDataDir), 'StorableSidebar.json')]),
  ])];
}

export function browserRunning(browser, { platform = process.platform, run = spawnSync } = {}) {
  const result = platform === 'win32'
    ? run('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8', timeout: 5000 })
    : run('ps', ['-axo', 'comm='], { encoding: 'utf8', timeout: 5000 });
  if (result.error || result.status !== 0) return null;
  const patterns = {
    brave: /(?:^|[/\\"\s])(?:brave(?:-browser)?(?:\.exe)?|Brave Browser(?: Helper[^/]*)?)(?:$|["\s])/im,
    chrome: /(?:^|[/\\"\s])(?:chrome(?:\.exe)?|google-chrome(?:-stable)?|Google Chrome(?: Helper[^/]*)?)(?:$|["\s])/im,
    chromium: /(?:^|[/\\"\s])(?:chromium(?:-browser)?(?:\.exe)?|Chromium(?: Helper[^/]*)?)(?:$|["\s])/im,
    arc: /(?:^|[/\\"\s])(?:Arc(?:\.exe)?|Arc Helper[^/]*)(?:$|["\s])/im,
  };
  return (browser ? [browser] : browsers).some(name => patterns[name].test(result.stdout));
}
