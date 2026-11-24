import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { CliError, sanitizeUrl } from './common.mjs';

export function openTarget(query, browser = 'brave') {
  const value = query?.trim();
  if (!value) return browser === 'brave' ? 'brave://newtab/' : 'chrome://newtab/';
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^[\w.-]+:\d+(?:[/\s]|$)/u.test(value)) return sanitizeUrl(value);
  if (/^(?:localhost|(?:[\p{L}\d-]+\.)+[\p{L}\d-]+)(?::\d+)?(?:[/#?][^\s]*)?$/u.test(value)) {
    return sanitizeUrl(`https://${value}`);
  }
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

export function launchSpec(browser, target, { platform = process.platform, env = process.env, profile, exists = fs.existsSync } = {}) {
  if (!['brave', 'chrome'].includes(browser)) throw new CliError('INVALID_BROWSER', 'open supports --browser brave|chrome.');
  const args = [...(profile ? [`--profile-directory=${profile}`] : []), target];
  if (platform === 'darwin') {
    const app = browser === 'brave' ? 'Brave Browser' : 'Google Chrome';
    // URL events reach an already-running browser. Profile arguments instead need
    // a fresh launcher process, which Chromium forwards to its existing instance.
    return { command: 'open', args: profile
      ? ['-n', '-a', app, '--args', ...args]
      : ['-a', app, target] };
  }
  if (platform === 'win32') {
    const suffix = browser === 'brave' ? ['BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'] : ['Google', 'Chrome', 'Application', 'chrome.exe'];
    const candidates = [env.LOCALAPPDATA, env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.ProgramFiles, env['ProgramFiles(x86)']]
      .filter(Boolean).map(base => path.win32.join(base, ...suffix));
    const command = candidates.find(exists);
    if (!command) throw new CliError('BROWSER_NOT_FOUND', `Cannot locate ${browser}. Install it in a standard application directory.`);
    return { command, args };
  }
  const names = browser === 'brave' ? ['brave-browser', 'brave-browser-stable', 'brave'] : ['google-chrome', 'google-chrome-stable'];
  const command = names.flatMap(name => (env.PATH ?? '').split(path.delimiter).filter(Boolean).map(dir => path.join(dir, name))).find(exists);
  if (!command) throw new CliError('BROWSER_NOT_FOUND', `Cannot locate ${browser} on PATH.`);
  return { command, args };
}

export async function openBrowser(query, options = {}) {
  const browser = options.browser ?? 'brave';
  const url = openTarget(query, browser);
  const spec = launchSpec(browser, url, options);
  if ((options.platform ?? process.platform) === 'darwin') {
    const result = spawnSync(spec.command, spec.args, { encoding: 'utf8', timeout: 15000 });
    if (result.error || result.status !== 0) throw new CliError('LAUNCH_FAILED', result.error?.message || result.stderr || 'Browser launch failed.');
  } else {
    await new Promise((resolve, reject) => {
      const child = spawn(spec.command, spec.args, { detached: true, stdio: 'ignore', shell: false });
      child.once('error', reject);
      child.once('spawn', () => { child.unref(); resolve(); });
    });
  }
  return { browser, url, launched: true };
}
