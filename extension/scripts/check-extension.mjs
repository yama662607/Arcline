import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTENSION_ROOT = resolve(__dirname, '..');
const DIST_DIR = resolve(EXTENSION_ROOT, 'dist');
const REPORT_DIR = resolve(EXTENSION_ROOT, 'test-results/extension-check');
const MAC_BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

function resolveBrowser() {
  if (process.env.ARCLINE_BROWSER?.toLowerCase() === 'chromium') {
    return { label: 'playwright-chromium', channel: 'chromium' };
  }
  if (existsSync(MAC_BRAVE_PATH)) {
    return { label: 'brave-local', executablePath: MAC_BRAVE_PATH };
  }
  return { label: 'playwright-chromium', channel: 'chromium' };
}

async function startMiniServer() {
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html><head><title>Arcline Check Page</title></head><body><h1>Check</h1></body></html>');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

async function main() {
  if (!existsSync(join(DIST_DIR, 'manifest.json'))) {
    console.error(`[check-extension] Missing ${DIST_DIR}/manifest.json. Run 'just build' first.`);
    process.exit(1);
  }

  mkdirSync(REPORT_DIR, { recursive: true });
  const userDataDir = mkdtempSync(join(tmpdir(), 'arcline-diag-'));
  const server = await startMiniServer();
  const browser = resolveBrowser();

  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  let manifestErrors = [];
  let runtimeErrors = [];
  let reloadCount = 0;

  const args = [
    '--headless=new',
    `--disable-extensions-except=${DIST_DIR}`,
    `--load-extension=${DIST_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    ...(browser.label === 'brave-local'
      ? ['--disable-brave-update', '--disable-features=BraveRewards,BraveWallet,BraveNews,BraveVPN']
      : []),
  ];

  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: browser.executablePath,
    channel: browser.channel,
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1280, height: 800 },
    args,
  });

  const attachLoggers = (page, label) => {
    page.on('pageerror', (err) => pageErrors.push({ page: label, message: err.message }));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push({ page: label, text: msg.text() });
      else if (msg.type() === 'warning') consoleWarnings.push({ page: label, text: msg.text() });
    });
  };

  try {
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
    }
    const extensionId = new URL(worker.url()).host;

    // 1. Open chrome://extensions/ and enable Developer Mode + errorCollection
    const extPage = await context.newPage();
    await extPage.goto('chrome://extensions/');
    await extPage.evaluate(async (id) => {
      if (!chrome.developerPrivate) return;
      await chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true });
      await chrome.developerPrivate.updateExtensionConfiguration({
        extensionId: id,
        errorCollection: true,
      });
    }, extensionId);

    // 2. Exercise Side Panel page
    const winId = await worker.evaluate(async () => (await chrome.windows.getLastFocused()).id ?? 1);
    const panel = await context.newPage();
    attachLoggers(panel, 'sidepanel');
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${winId}`);
    await panel.locator('[data-arcline-ready="true"]').waitFor({ state: 'visible', timeout: 10_000 });

    // 3. Exercise left-edge hover overlay on real HTTP page
    const webPage = await context.newPage();
    attachLoggers(webPage, 'webpage');
    await webPage.goto(server.url);
    await webPage.waitForTimeout(250);
    await webPage.mouse.move(2, 300);
    await webPage.waitForTimeout(350);
    await webPage.mouse.move(600, 300);
    await webPage.waitForTimeout(400);

    // 4. Perform 2 live reload cycles via chrome.developerPrivate.reload
    for (let i = 0; i < 2; i++) {
      const reloaded = await extPage.evaluate(async (id) => {
        if (!chrome.developerPrivate?.reload) return false;
        await chrome.developerPrivate.reload(id, { failQuietly: true });
        return true;
      }, extensionId);
      if (reloaded) {
        reloadCount += 1;
        await extPage.waitForTimeout(500);
      }
    }

    // 5. Collect chrome.developerPrivate manifestErrors & runtimeErrors
    const extInfo = await extPage.evaluate(async (id) => {
      if (!chrome.developerPrivate?.getExtensionInfo) return null;
      const info = await chrome.developerPrivate.getExtensionInfo(id);
      return {
        name: info.name,
        version: info.version,
        manifestErrors: info.manifestErrors ?? [],
        runtimeErrors: info.runtimeErrors ?? [],
      };
    }, extensionId);

    if (extInfo) {
      manifestErrors = extInfo.manifestErrors;
      runtimeErrors = extInfo.runtimeErrors;
    }

    const report = {
      browser: browser.label,
      extensionId,
      reloadCount,
      manifestErrors,
      runtimeErrors,
      consoleErrors,
      consoleWarnings,
      pageErrors,
      ok:
        manifestErrors.length === 0 &&
        runtimeErrors.length === 0 &&
        consoleErrors.length === 0 &&
        pageErrors.length === 0,
    };

    writeFileSync(join(REPORT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf-8');
    console.log(JSON.stringify(report, null, 2));

    if (!report.ok) {
      process.exitCode = 1;
    }
  } finally {
    await context.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('[check-extension] Fatal error:', err);
  process.exit(1);
});
