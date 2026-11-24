import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type BrowserContext,
  test as base,
  chromium,
  expect,
  type Page,
  type Worker,
} from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const EXTENSION_ROOT = resolve(__dirname, '../..');
export const DIST_DIR = resolve(EXTENSION_ROOT, 'dist');
export const VISUAL_DIR = resolve(EXTENSION_ROOT, 'test-results/visual');

const MAC_BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

export interface LaunchChoice {
  browserLabel: string;
  executablePath?: string;
  channel?: string;
}

export function resolveBrowserChoice(): LaunchChoice {
  const pref = process.env.ARCLINE_BROWSER?.toLowerCase();
  if (pref === 'chromium') {
    return { browserLabel: 'playwright-chromium', channel: 'chromium' };
  }
  if (process.env.ARCLINE_BROWSER_PATH && existsSync(process.env.ARCLINE_BROWSER_PATH)) {
    return { browserLabel: 'custom', executablePath: process.env.ARCLINE_BROWSER_PATH };
  }
  if (existsSync(MAC_BRAVE_PATH)) {
    return { browserLabel: 'brave-local', executablePath: MAC_BRAVE_PATH };
  }
  return { browserLabel: 'playwright-chromium', channel: 'chromium' };
}

export async function launchExtensionContext(
  userDataDir: string,
  extraArgs: string[] = [],
): Promise<{ context: BrowserContext; worker: Worker; extensionId: string; browserLabel: string }> {
  if (!existsSync(join(DIST_DIR, 'manifest.json'))) {
    throw new Error(`Extension dist not built at ${DIST_DIR}. Run 'just build' first.`);
  }
  mkdirSync(VISUAL_DIR, { recursive: true });

  const choice = resolveBrowserChoice();
  const headed = process.env.ARCLINE_HEADED === '1';

  const args = [
    ...(headed ? [] : ['--headless=new']),
    `--disable-extensions-except=${DIST_DIR}`,
    `--load-extension=${DIST_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    ...(choice.browserLabel === 'brave-local'
      ? ['--disable-brave-update', '--disable-features=BraveRewards,BraveWallet,BraveNews,BraveVPN']
      : []),
    ...extraArgs,
  ];

  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: choice.executablePath,
    channel: choice.channel,
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1280, height: 800 },
    args,
  });

  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
  }
  const extensionId = new URL(worker.url()).host;

  // E2E selectors target the Japanese UI copy; pin the language so results do not depend on
  // the host browser locale ('auto' would resolve to English on en-US machines).
  // Also suppress or close first-install onboarding tab so it never steals focus mid-test.
  await worker.evaluate(async () => {
    const cur = (await chrome.storage.local.get('arcline:settings'))['arcline:settings'] ?? {};
    await chrome.storage.local.set({
      'arcline:settings': { ...cur, language: 'ja' },
      'arcline:onboardingSeen': true,
    });
    const tabs = await chrome.tabs.query({});
    const onbIds = tabs
      .filter((t) => t.id !== undefined && t.url?.includes('/onboarding.html'))
      .map((t) => t.id as number);
    if (onbIds.length > 0) {
      await chrome.tabs.remove(onbIds).catch(() => undefined);
    }
  });

  return { context, worker, extensionId, browserLabel: choice.browserLabel };
}

export interface TestServerHandle {
  url: string;
  close: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServerHandle> {
  const server: Server = createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (pathname === '/youtube') {
      res.end(`<!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>Hostile YouTube 10px Root</title>
            <style>
              html { font-size: 10px !important; background: #0f0f0f; color: #f1f1f1; }
              body { margin: 0; padding: 32px 64px; font-family: system-ui, sans-serif; font-size: 1.6rem; }
            </style>
          </head>
          <body><h1>Hostile 10px Root Page</h1><p>Simulates YouTube root rem scaling.</p></body>
        </html>`);
      return;
    }

    if (pathname === '/reddit') {
      res.end(`<!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <title>Hostile Reddit Custom Elements</title>
            <style>
              :not(:defined) { display: none !important; }
              body { margin: 0; padding: 32px 64px; font-family: system-ui, sans-serif; background: #1a1a1b; color: #d7dadc; }
            </style>
          </head>
          <body><h1>Hostile :not(:defined) Page</h1><p>Simulates Reddit custom element hiding.</p></body>
        </html>`);
      return;
    }

    if (pathname === '/spa') {
      res.end(`<!doctype html>
        <html lang="en">
          <head><meta charset="utf-8" /><title>Aggressive SPA</title></head>
          <body style="margin:0;padding:32px 64px;font-family:system-ui,sans-serif">
            <h1>Aggressive SPA</h1>
            <button id="nuke-host" type="button">Remove Overlay Host</button>
            <script>
              document.getElementById('nuke-host').addEventListener('click', () => {
                document.getElementById('arcline-overlay-host')?.remove();
              });
            </script>
          </body>
        </html>`);
      return;
    }

    const pageTitle = pathname.startsWith('/page/')
      ? `Arcline Page ${pathname.slice('/page/'.length).toUpperCase()}`
      : 'Arcline Verification Article';

    res.end(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${pageTitle}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
              color: #0f172a;
              padding: 48px 80px;
            }
            .card {
              max-width: 720px;
              margin: 0 auto;
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              padding: 32px;
              box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
            }
            h1 { margin: 0 0 12px; font-size: 28px; letter-spacing: -0.02em; }
            p { color: #475569; line-height: 1.7; }
          </style>
        </head>
        <body>
          <article class="card">
            <h1>${pageTitle}</h1>
            <p>
              This page verifies Arcline's ultra-lightweight left-edge hover auto-hide sidebar overlay,
              real mouse trajectories, lazy iframe loading, drag suppression, and visual alignment.
            </p>
            <p id="selectable-text">
              Drag selection across this text towards the left edge must never accidentally trigger the sidebar.
            </p>
          </article>
        </body>
      </html>`);
  });

  await new Promise<void>((resolveReady) => server.listen(0, '127.0.0.1', () => resolveReady()));
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Failed to bind local test server');
  }
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((res) => server.close(() => res())),
  };
}

export interface ArclineFixture {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  windowId: number;
  browserLabel: string;
  serverUrl: string;
  userDataDir: string;
  openPanel: (viewport?: { width: number; height: number }) => Promise<Page>;
  setSettings: (patch: Record<string, unknown>) => Promise<void>;
  getSettings: () => Promise<Record<string, unknown>>;
}

export const test = base.extend<{ arcline: ArclineFixture }>({
  arcline: async ({}, use) => {
    const server = await startTestServer();
    const userDataDir = mkdtempSync(join(tmpdir(), 'arcline-e2e-'));
    const { context, worker, extensionId, browserLabel } = await launchExtensionContext(userDataDir);

    // Ensure Arcline root + default Space exist before opening test pages
    const windowId = await worker.evaluate(async () => {
      const win = await chrome.windows.getLastFocused();
      return win.id ?? 1;
    });

    const fixture: ArclineFixture = {
      context,
      worker,
      extensionId,
      windowId,
      browserLabel,
      serverUrl: server.url,
      userDataDir,
      openPanel: async (viewport = { width: 300, height: 760 }) => {
        const panel = await context.newPage();
        await panel.setViewportSize(viewport);
        await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);
        await panel.locator('[data-arcline-ready="true"]').waitFor({ state: 'visible' });
        return panel;
      },
      setSettings: async (patch) => {
        await worker.evaluate(async (p) => {
          const cur = (await chrome.storage.local.get('arcline:settings'))['arcline:settings'] ?? {};
          await chrome.storage.local.set({ 'arcline:settings': { ...cur, ...p } });
        }, patch);
      },
      getSettings: async () => {
        return worker.evaluate(async () => {
          const res = await chrome.storage.local.get('arcline:settings');
          return (res['arcline:settings'] as Record<string, unknown>) ?? {};
        });
      },
    };

    try {
      await use(fixture);
    } finally {
      await context.close().catch(() => undefined);
      await server.close().catch(() => undefined);
      rmSync(userDataDir, { recursive: true, force: true });
    }
  },
});

export { expect };
