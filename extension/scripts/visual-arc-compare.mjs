import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTENSION_ROOT = resolve(__dirname, '..');
const DIST_DIR = resolve(EXTENSION_ROOT, 'dist');
const OUT_DIR = resolve(EXTENSION_ROOT, 'test-results/arc-compare');
const MAC_BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const ARC_JSON_PATH =
  process.env.ARC_SIDEBAR_JSON || join(homedir(), 'Library/Application Support/Arc/StorableSidebar.json');

async function startSampleSite() {
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html>
      <html lang="ja">
        <head>
          <meta charset="utf-8" />
          <title>YouTube — Live Verification Canvas</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              background: radial-gradient(circle at 70% 25%, #1f2433 0%, #0f1117 65%);
              color: #e5e7eb;
              padding: 48px 96px;
            }
            .hero {
              max-width: 780px;
              margin: 0 auto;
              border-radius: 18px;
              border: 1px solid rgba(255,255,255,0.08);
              background: rgba(255,255,255,0.04);
              padding: 36px;
            }
            h1 { margin: 0 0 12px; font-size: 28px; }
            p { color: #9ca3af; line-height: 1.75; }
          </style>
        </head>
        <body>
          <div class="hero">
            <h1>Arcline Real-Data Visual Verification</h1>
            <p>
              Real Brave Browser 158 rendering the user's actual Arc Spaces, Favorites, nested folders,
              and multi-node Space Theme gradients over a dark webpage.
            </p>
          </div>
        </body>
      </html>`);
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
    throw new Error(`Missing ${DIST_DIR}/manifest.json. Run 'just build' first.`);
  }
  if (!existsSync(ARC_JSON_PATH)) {
    throw new Error(`Arc StorableSidebar.json not found at ${ARC_JSON_PATH}`);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const userDataDir = mkdtempSync(join(tmpdir(), 'arcline-visual-arc-'));
  const server = await startSampleSite();
  const headed = process.env.ARCLINE_HEADED === '1';

  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath: existsSync(MAC_BRAVE_PATH) ? MAC_BRAVE_PATH : undefined,
    channel: existsSync(MAC_BRAVE_PATH) ? undefined : 'chromium',
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: 2,
    args: [
      ...(headed ? [] : ['--headless=new']),
      `--disable-extensions-except=${DIST_DIR}`,
      `--load-extension=${DIST_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-brave-update',
      '--disable-features=BraveRewards,BraveWallet,BraveNews,BraveVPN',
    ],
  });

  try {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
    const extensionId = new URL(worker.url()).host;
    const windowId = await worker.evaluate(async () => (await chrome.windows.getLastFocused()).id ?? 1);

    // Open a realistic dark web page tab so the overlay & URL pill have an active web tab
    const webPage = await context.newPage();
    await webPage.goto(server.url);
    await webPage.waitForTimeout(300);

    // Open the sidebar panel at exact Arc sidebar proportions (288x860 @ 2x Retina)
    const panel = await context.newPage();
    await panel.setViewportSize({ width: 288, height: 860 });
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);
    await panel.locator('[data-arcline-ready="true"]').waitFor({ state: 'visible' });

    // Import the user's real Arc StorableSidebar.json
    await panel.getByRole('button', { name: '設定・アーカイブ・Arcインポート' }).click();
    await panel.getByRole('button', { name: 'Arc移行 / 出力' }).click();
    await panel.locator('input[type="file"]').setInputFiles(ARC_JSON_PATH);
    await panel.getByRole('button', { name: 'インポート実行' }).waitFor({ state: 'visible' });
    await panel.getByRole('button', { name: 'インポート実行' }).click();
    await panel.getByRole('heading', { name: 'Arcline 設定' }).waitFor({ state: 'hidden', timeout: 25_000 });
    await panel.waitForTimeout(500);

    // 1. Main Space (Dark matte charcoal, 4x3 Favorites grid, real folders)
    const mainBtn = panel.getByRole('button', { name: 'Space: Main' });
    if (await mainBtn.count()) await mainBtn.first().click();
    await panel.waitForTimeout(450);
    await panel.screenshot({ path: join(OUT_DIR, '01-main-dark.png') });

    // 2. Active Matter Space (Imported 3-color olive/sky/lavender gradient + grain!)
    const activeMatterBtn = panel.getByRole('button', { name: 'Space: Active Matter' });
    if (await activeMatterBtn.count()) {
      await activeMatterBtn.first().click();
      await panel.waitForTimeout(500);
      await panel.screenshot({ path: join(OUT_DIR, '02-active-matter.png') });

      // 3. Expand sample folders if present
      for (const folderName of ['Research', 'Docs']) {
        const folder = panel.getByRole('button', { name: folderName });
        if (await folder.count()) {
          await folder.first().click();
          await panel.waitForTimeout(120);
        }
      }
      await panel.waitForTimeout(250);
      await panel.screenshot({ path: join(OUT_DIR, '03-active-matter-expanded.png') });

      // 4. Open Space Theme Studio on Active Matter (matching user's real Arc screenshot #5)
      await panel.getByRole('button', { name: 'テーマカラーを編集' }).click();
      await panel.waitForTimeout(250);
      await panel.screenshot({ path: join(OUT_DIR, '04-theme-studio.png') });
      await panel.keyboard.press('Escape');
      await panel.waitForTimeout(150);
    }

    // 5. Floating Left-Edge Hover Overlay over real dark webpage (Main dark charcoal)
    await webPage.bringToFront();
    await webPage.mouse.move(2, 320);
    await webPage.waitForTimeout(650);
    await webPage.screenshot({ path: join(OUT_DIR, '06-floating-main-dark.png') });

    // 6. Switch to Active Matter inside the floating iframe to inspect live translucent gradient over webpage
    const frame = webPage.frameLocator('#arcline-overlay-host iframe');
    const floatAM = frame.getByRole('button', { name: 'Space: Active Matter' });
    if (await floatAM.count()) {
      await floatAM.first().click();
      await webPage.waitForTimeout(550);
    }
    await webPage.screenshot({ path: join(OUT_DIR, '05-floating-active-matter.png') });

    console.log(`Captured real-data Arc comparison screenshots in ${OUT_DIR}`);
  } finally {
    await context.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('[visual-arc-compare] Failed:', err);
  process.exit(1);
});
