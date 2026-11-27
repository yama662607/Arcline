import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CliError, readJson } from './common.mjs';

export const BRIDGE_HOST_NAME = 'com.arcline.bridge';
export const CWS_EXTENSION_ID = 'jplgpgpmmnenggkbjjiokhpnpajlcgdp';

export function bridgeSocketPath() {
  return process.env.ARCLINE_BRIDGE_SOCKET || path.join(os.homedir(), '.arcline', 'bridge.sock');
}

export function bridgeHostBinaryPath() {
  return fileURLToPath(new URL('../bin/arcline-bridge.mjs', import.meta.url));
}

export function nativeHostManifestPath(browser = 'brave') {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    const map = {
      brave: path.join(home, 'Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts', `${BRIDGE_HOST_NAME}.json`),
      chrome: path.join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts', `${BRIDGE_HOST_NAME}.json`),
      chromium: path.join(home, 'Library/Application Support/Chromium/NativeMessagingHosts', `${BRIDGE_HOST_NAME}.json`),
    };
    if (!map[browser]) throw new CliError('INVALID_BROWSER', `Native bridge is not supported for browser: ${browser}`);
    return map[browser];
  }
  if (process.platform === 'linux') {
    const map = {
      brave: path.join(home, '.config/BraveSoftware/Brave-Browser/NativeMessagingHosts', `${BRIDGE_HOST_NAME}.json`),
      chrome: path.join(home, '.config/google-chrome/NativeMessagingHosts', `${BRIDGE_HOST_NAME}.json`),
      chromium: path.join(home, '.config/chromium/NativeMessagingHosts', `${BRIDGE_HOST_NAME}.json`),
    };
    if (!map[browser]) throw new CliError('INVALID_BROWSER', `Native bridge is not supported for browser: ${browser}`);
    return map[browser];
  }
  throw new CliError('UNSUPPORTED_PLATFORM', `Native bridge install currently supports macOS and Linux (got ${process.platform}).`);
}

function browserDataDir(browser) {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return {
      brave: path.join(home, 'Library/Application Support/BraveSoftware/Brave-Browser'),
      chrome: path.join(home, 'Library/Application Support/Google/Chrome'),
      chromium: path.join(home, 'Library/Application Support/Chromium'),
    }[browser];
  }
  if (process.platform === 'linux') {
    return {
      brave: path.join(home, '.config/BraveSoftware/Brave-Browser'),
      chrome: path.join(home, '.config/google-chrome'),
      chromium: path.join(home, '.config/chromium'),
    }[browser];
  }
  return null;
}

export function detectArclineExtensionIds(browser = 'brave') {
  const ids = new Set([CWS_EXTENSION_ID]);
  const dir = browserDataDir(browser);
  if (!dir || !fs.existsSync(dir)) return [...ids];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return [...ids]; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    for (const prefName of ['Preferences', 'Secure Preferences']) {
      const prefPath = path.join(dir, entry.name, prefName);
      if (!fs.existsSync(prefPath)) continue;
      try {
        const pref = readJson(prefPath);
        const settings = pref?.extensions?.settings;
        if (!settings || typeof settings !== 'object') continue;
        for (const [extId, meta] of Object.entries(settings)) {
          if (!/^[a-p]{32}$/.test(extId)) continue;
          const p = String(meta?.path ?? '');
          const name = String(meta?.manifest?.name ?? '');
          if (name === 'Arcline' || /Arcline\/extension\/dist/i.test(p)) {
            ids.add(extId);
          }
        }
      } catch {
        // Ignore unreadable prefs
      }
    }
  }
  return [...ids];
}

export function installBridge({ browser = 'brave', extensionId } = {}) {
  const hostPath = bridgeHostBinaryPath();
  if (!fs.existsSync(hostPath)) {
    throw new CliError('MISSING_BRIDGE_BIN', `Bridge host script not found at ${hostPath}`);
  }
  try { fs.chmodSync(hostPath, 0o755); } catch { /* ignore */ }
  const manifestPath = nativeHostManifestPath(browser);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const ids = new Set(detectArclineExtensionIds(browser));
  if (extensionId) {
    if (!/^[a-p]{32}$/.test(extensionId.trim())) {
      throw new CliError('INVALID_EXTENSION_ID', `Invalid Chrome extension ID: ${extensionId}`);
    }
    ids.add(extensionId.trim());
  }
  const manifest = {
    name: BRIDGE_HOST_NAME,
    description: 'Arcline local Native Messaging bridge for live bookmark & shortcut sync',
    path: hostPath,
    type: 'stdio',
    allowed_origins: [...ids].map((id) => `chrome-extension://${id}/`),
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
  return {
    browser,
    manifestPath,
    hostPath,
    allowedOrigins: manifest.allowed_origins,
    nextStep: 'Reload Arcline in brave://extensions (or restart the browser) to connect the live bridge.',
  };
}

export function uninstallBridge({ browser = 'brave' } = {}) {
  const manifestPath = nativeHostManifestPath(browser);
  const existed = fs.existsSync(manifestPath);
  if (existed) fs.unlinkSync(manifestPath);
  return { browser, manifestPath, removed: existed };
}

export function callBridge(method, params = {}, { timeoutMs = 8000 } = {}) {
  const sock = bridgeSocketPath();
  return new Promise((resolve, reject) => {
    const id = randomUUID();
    const client = net.createConnection(sock);
    let settled = false;
    let buf = '';
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      client.destroy();
      reject(new CliError('BRIDGE_TIMEOUT', `Arcline bridge timed out on ${method}.`));
    }, timeoutMs);

    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(value);
    };

    client.setEncoding('utf8');
    client.on('connect', () => {
      client.write(`${JSON.stringify({ id, method, params })}\n`);
    });
    client.on('data', (chunk) => {
      buf += chunk;
      const nl = buf.indexOf('\n');
      if (nl < 0) return;
      const line = buf.slice(0, nl).trim();
      try {
        const resp = JSON.parse(line);
        if (resp.ok) finish(null, resp.data);
        else finish(new CliError(resp.error?.code || 'BRIDGE_ERROR', resp.error?.message || `Bridge error on ${method}`));
      } catch (e) {
        finish(new CliError('BRIDGE_PROTOCOL', `Invalid bridge response: ${e.message}`));
      }
    });
    client.on('error', () => {
      finish(
        new CliError(
          'BRIDGE_UNAVAILABLE',
          'Arcline live bridge is not connected. Run `arcline bridge install --browser brave` and reload Arcline in brave://extensions.',
        ),
      );
    });
    client.on('end', () => {
      if (!settled) {
        finish(new CliError('BRIDGE_CLOSED', 'Arcline bridge closed before responding.'));
      }
    });
  });
}

export async function bridgeStatus() {
  try {
    const info = await callBridge('ping', {}, { timeoutMs: 2000 });
    return { connected: true, socketPath: bridgeSocketPath(), ...info };
  } catch (err) {
    return {
      connected: false,
      socketPath: bridgeSocketPath(),
      reason: err.message,
    };
  }
}
