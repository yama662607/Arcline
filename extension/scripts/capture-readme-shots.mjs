import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(EXT_ROOT, '..');
const DIST_DIR = resolve(EXT_ROOT, 'dist');
const BASE_OUT_DIR = resolve(REPO_ROOT, 'docs/screenshots');
const CWS_EN_DIR = resolve(REPO_ROOT, 'release/cws-screenshots/en');
const CWS_JA_DIR = resolve(REPO_ROOT, 'release/cws-screenshots/ja');
const MAC_BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

const DEMO_ARC_SIDEBAR = {
  sidebar: {
    containers: [
      { global: {} },
      {
        spaces: [
          'space-main',
          {
            id: 'space-main',
            title: 'Engineering',
            containerIDs: ['pinned', 'pinned-main', 'unpinned', 'unpinned-main'],
            customInfo: {
              iconType: { icon: 'code' },
              windowTheme: {
                primaryColorPalette: {
                  midTone: { red: 0.14, green: 0.14, blue: 0.16 },
                },
              },
            },
          },
          'space-studio',
          {
            id: 'space-studio',
            title: 'Design Studio',
            containerIDs: ['pinned', 'pinned-studio', 'unpinned', 'unpinned-studio'],
            customInfo: {
              iconType: { icon: 'sparkles' },
              windowTheme: {
                primaryColorPalette: {
                  midTone: { red: 0.48, green: 0.68, blue: 0.54 },
                },
              },
            },
          },
          'space-reading',
          {
            id: 'space-reading',
            title: 'Reading & Notes',
            containerIDs: ['pinned', 'pinned-reading', 'unpinned', 'unpinned-reading'],
            customInfo: {
              iconType: { icon: 'book' },
              windowTheme: {
                primaryColorPalette: {
                  midTone: { red: 0.34, green: 0.48, blue: 0.72 },
                },
              },
            },
          },
        ],
        topAppsContainerIDs: ['top-apps'],
        items: [
          'top-apps',
          {
            id: 'top-apps',
            childrenIds: ['fav-1', 'fav-2', 'fav-3', 'fav-4', 'fav-5', 'fav-6', 'fav-7', 'fav-8'],
          },
          'fav-1',
          {
            id: 'fav-1',
            parentID: 'top-apps',
            data: { tab: { savedTitle: 'GitHub', savedURL: 'https://github.com/' } },
          },
          'fav-2',
          {
            id: 'fav-2',
            parentID: 'top-apps',
            data: { tab: { savedTitle: 'Linear', savedURL: 'https://linear.app/' } },
          },
          'fav-3',
          {
            id: 'fav-3',
            parentID: 'top-apps',
            data: { tab: { savedTitle: 'Figma', savedURL: 'https://www.figma.com/' } },
          },
          'fav-4',
          {
            id: 'fav-4',
            parentID: 'top-apps',
            data: { tab: { savedTitle: 'Notion', savedURL: 'https://www.notion.so/' } },
          },
          'fav-5',
          {
            id: 'fav-5',
            parentID: 'top-apps',
            data: { tab: { savedTitle: 'MDN Web Docs', savedURL: 'https://developer.mozilla.org/' } },
          },
          'fav-6',
          {
            id: 'fav-6',
            parentID: 'top-apps',
            data: { tab: { savedTitle: 'TypeScript', savedURL: 'https://www.typescriptlang.org/' } },
          },
          'fav-7',
          {
            id: 'fav-7',
            parentID: 'top-apps',
            data: { tab: { savedTitle: 'Vite', savedURL: 'https://vite.dev/' } },
          },
          'fav-8',
          {
            id: 'fav-8',
            parentID: 'top-apps',
            data: { tab: { savedTitle: 'Playwright', savedURL: 'https://playwright.dev/' } },
          },
          'pinned-main',
          { id: 'pinned-main', childrenIds: ['folder-core', 'folder-refs', 'pin-ci'] },
          'folder-core',
          {
            id: 'folder-core',
            parentID: 'pinned-main',
            title: 'Core Architecture',
            childrenIds: ['pin-spec', 'pin-perf', 'pin-a11y'],
            data: { list: {} },
          },
          'pin-spec',
          {
            id: 'pin-spec',
            parentID: 'folder-core',
            data: {
              tab: {
                savedTitle: 'MV3 Side Panel API',
                savedURL: 'https://developer.chrome.com/docs/extensions/reference/api/sidePanel',
              },
            },
          },
          'pin-perf',
          {
            id: 'pin-perf',
            parentID: 'folder-core',
            data: {
              tab: {
                savedTitle: 'CSS Anchor Positioning',
                savedURL: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_anchor_positioning',
              },
            },
          },
          'pin-a11y',
          {
            id: 'pin-a11y',
            parentID: 'folder-core',
            data: {
              tab: { savedTitle: 'WAI-ARIA Patterns', savedURL: 'https://www.w3.org/WAI/ARIA/apg/' },
            },
          },
          'folder-refs',
          {
            id: 'folder-refs',
            parentID: 'pinned-main',
            title: 'Release Checklist',
            childrenIds: ['pin-biome'],
            data: { list: {} },
          },
          'pin-biome',
          {
            id: 'pin-biome',
            parentID: 'folder-refs',
            data: { tab: { savedTitle: 'Biome Formatter', savedURL: 'https://biomejs.dev/' } },
          },
          'pin-ci',
          {
            id: 'pin-ci',
            parentID: 'pinned-main',
            data: { tab: { savedTitle: 'GitHub Actions', savedURL: 'https://github.com/features/actions' } },
          },
          'pinned-studio',
          { id: 'pinned-studio', childrenIds: ['pin-oklch', 'pin-radix', 'pin-raycast'] },
          'pin-oklch',
          {
            id: 'pin-oklch',
            parentID: 'pinned-studio',
            data: { tab: { savedTitle: 'OKLCH Color Picker', savedURL: 'https://oklch.com/' } },
          },
          'pin-radix',
          {
            id: 'pin-radix',
            parentID: 'pinned-studio',
            data: { tab: { savedTitle: 'Design Tokens', savedURL: 'https://designtokens.org/' } },
          },
          'pin-raycast',
          {
            id: 'pin-raycast',
            parentID: 'pinned-studio',
            data: { tab: { savedTitle: 'Raycast API Docs', savedURL: 'https://developers.raycast.com/' } },
          },
          'pinned-reading',
          { id: 'pinned-reading', childrenIds: ['pin-arxiv'] },
          'pin-arxiv',
          {
            id: 'pin-arxiv',
            parentID: 'pinned-reading',
            data: { tab: { savedTitle: 'arXiv Preprints', savedURL: 'https://arxiv.org/' } },
          },
        ],
      },
    ],
  },
};

function labelsFor(lang) {
  if (lang === 'ja') {
    return {
      openSettings: '設定・アーカイブ・Arcインポート',
      importTab: 'Arc移行 / 出力',
      importRun: 'インポート実行',
      moveToSpace: '他の Space へ移動',
      editTheme: 'テーマカラーを編集',
      close: '閉じる',
    };
  }
  return {
    openSettings: 'Settings, archive & Arc import',
    importTab: 'Arc Import / Export',
    importRun: 'Run import',
    moveToSpace: 'Move to another Space',
    editTheme: 'Edit theme color',
    close: 'Close',
  };
}

function startDemoServer() {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const title =
      path === '/docs'
        ? 'Building Fast Manifest V3 Sidebars'
        : path === '/notes'
          ? 'OKLCH Color Spaces & Tactile UI'
          : 'Arcline — Editorial Workspace Demo';
    res.end(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
              background:
                radial-gradient(circle at 82% 16%, rgba(99, 102, 241, 0.24), transparent 44%),
                radial-gradient(circle at 24% 84%, rgba(16, 185, 129, 0.16), transparent 46%),
                #0e1015;
              color: #e6e8ef;
              padding: 56px 92px 56px 350px;
            }
            .badge {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 6px 12px;
              border-radius: 999px;
              font-size: 12px;
              font-weight: 600;
              color: #a5b4fc;
              background: rgba(99, 102, 241, 0.14);
              border: 1px solid rgba(165, 180, 252, 0.22);
              margin-bottom: 18px;
            }
            h1 {
              margin: 0 0 14px;
              font-size: 40px;
              line-height: 1.15;
              letter-spacing: -0.03em;
              max-width: 720px;
            }
            p.lead {
              margin: 0 0 32px;
              font-size: 16px;
              line-height: 1.7;
              color: #9ca3b4;
              max-width: 660px;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 18px;
              max-width: 780px;
            }
            .card {
              padding: 22px;
              border-radius: 16px;
              background: rgba(255, 255, 255, 0.04);
              border: 1px solid rgba(255, 255, 255, 0.09);
            }
            .card h2 {
              margin: 0 0 8px;
              font-size: 15px;
              font-weight: 600;
              color: #f3f4f6;
            }
            .card p {
              margin: 0;
              font-size: 13.5px;
              line-height: 1.6;
              color: #94a3b8;
            }
          </style>
        </head>
        <body>
          <div class="badge">Arcline 1.0.0 · Manifest V3</div>
          <h1>Arc's Sidebar Craft, Built for Brave &amp; Chrome.</h1>
          <p class="lead">
            Zero-React 4 kB left-edge hover overlay, native Side Panel fallback, fused Command Bar New Tab,
            bookmark-backed Spaces, multi-node OKLCH gradients with analog film grain, and Raycast global hotkeys.
          </p>
          <div class="grid">
            <div class="card">
              <h2>Unified Command Bar</h2>
              <p>Fuse Open Tabs, Favorites, Pinned folders, History, and Site Search (gh / yt / wiki / gpt) in one New Tab.</p>
            </div>
            <div class="card">
              <h2>Two-Finger Space Swipe</h2>
              <p>Switch Spaces naturally on trackpads without conflicting with browser Back/Forward gestures.</p>
            </div>
            <div class="card">
              <h2>Zero Telemetry &amp; Local-First</h2>
              <p>Everything lives in your browser's native bookmarks, tab groups, and local storage.</p>
            </div>
            <div class="card">
              <h2>Bilingual + CLI &amp; Raycast</h2>
              <p>Full EN/JA localization, AI-ready arcline CLI, and global hotkey support via Raycast.</p>
            </div>
          </div>
        </body>
      </html>`);
  });
  return new Promise((resolveReady) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolveReady({
        url: `http://127.0.0.1:${addr.port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function captureLocale(lang, outDir, cwsDir) {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(cwsDir, { recursive: true });

  const labels = labelsFor(lang);
  const profileDir = mkdtempSync(join(tmpdir(), `arcline-shots-${lang}-`));
  const server = await startDemoServer();
  const useBrave = existsSync(MAC_BRAVE);

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: useBrave ? MAC_BRAVE : undefined,
    channel: useBrave ? undefined : 'chromium',
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    args: [
      '--headless=new',
      `--disable-extensions-except=${DIST_DIR}`,
      `--load-extension=${DIST_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      ...(useBrave
        ? ['--disable-brave-update', '--disable-features=BraveRewards,BraveWallet,BraveNews,BraveVPN']
        : []),
    ],
  });

  try {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
    const extensionId = new URL(worker.url()).host;

    await worker.evaluate(async (targetLang) => {
      await chrome.storage.local.set({
        'arcline:onboardingSeen': true,
        'arcline:settings': {
          theme: 'dark',
          language: targetLang,
          searchEngine: 'google',
          showTopBar: false,
          showOpenInCollapsedFolders: true,
          autoArchiveHours: 24,
          edgeHoverEnabled: true,
          edgeTriggerWidthPx: 6,
          edgeOpenDelayMs: 40,
          edgeCloseDelayMs: 400,
          overlayWidthPx: 292,
          swipeToSwitchSpace: true,
          openEmptySpacePage: false,
        },
      });
      const existing = await chrome.tabs.query({});
      const onb = existing.filter((t) => t.id !== undefined && t.url?.includes('/onboarding.html')).map((t) => t.id);
      if (onb.length > 0) await chrome.tabs.remove(onb).catch(() => undefined);
    }, lang);

    // Seed synthetic Arc sidebar via sidepanel import
    const winId = await worker.evaluate(async () => (await chrome.windows.getLastFocused()).id ?? 1);
    const panel = await context.newPage();
    await panel.setViewportSize({ width: 320, height: 800 });
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${winId}`);
    await panel.locator('[data-arcline-ready="true"]').waitFor({ state: 'visible' });
    await panel.getByRole('button', { name: labels.openSettings }).click();
    await panel.getByRole('button', { name: labels.importTab }).click();
    await panel.locator('input[type="file"]').setInputFiles({
      name: 'StorableSidebar.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(DEMO_ARC_SIDEBAR), 'utf-8'),
    });
    await panel.getByRole('button', { name: labels.importRun }).click();
    await panel.getByRole('button', { name: 'Space: Engineering' }).click();
    await panel.getByText('Core Architecture').click();
    await panel.close();

    // Open two demo tabs so Today section looks lively
    const t2 = await context.newPage();
    await t2.goto(`${server.url}/notes`);
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${server.url}/docs`);

    // Hover left edge to open floating overlay
    await page.waitForTimeout(300);
    await page.mouse.move(2, 340);
    const frame = page.frameLocator('#arcline-overlay-host iframe');
    await frame.locator('[data-arcline-ready="true"]').waitFor({ state: 'visible' });
    await page.waitForTimeout(420);

    // 1. Floating frosted-glass sidebar over dark demo page
    await page.screenshot({ path: join(outDir, 'arcline-overlay.png') });

    // 2. Overflowing Arc context menu + Space submenu
    const tabBtn = frame.getByRole('button', { name: /Building Fast Manifest V3 Sidebars/i }).first();
    await tabBtn.click({ button: 'right', position: { x: 170, y: 14 } });
    await frame.getByRole('menuitem', { name: labels.moveToSpace }).hover();
    await page.waitForTimeout(240);
    await page.screenshot({ path: join(outDir, 'arcline-context-menu.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(180);

    // 3. Space Theme Studio docked beside the live Active Matter gradient sidebar
    await frame.getByRole('button', { name: 'Space: Design Studio' }).click();
    await page.waitForTimeout(260);
    await frame.getByRole('button', { name: labels.editTheme }).click();
    await frame.getByRole('button', { name: 'Active Matter' }).click();
    await page.waitForTimeout(260);
    await page.screenshot({ path: join(outDir, 'arcline-theme-studio.png') });
    await frame.getByRole('button', { name: labels.close }).click();
    await page.waitForTimeout(220);

    // 4. Window-centered 2-pane Settings dialog
    await frame.getByRole('button', { name: 'Space: Engineering' }).click();
    await page.waitForTimeout(220);
    await frame.getByRole('button', { name: labels.openSettings }).click();
    await page.waitForTimeout(260);
    await page.screenshot({ path: join(outDir, 'arcline-settings.png') });

    // 5. Arc-style Unified Command Bar & New Tab page (clean floating card on Space gradient backdrop)
    const cmdPage = await context.newPage();
    await cmdPage.setViewportSize({ width: 1280, height: 800 });
    await cmdPage.goto(`chrome-extension://${extensionId}/empty-space.html?commandBar=1`);
    await cmdPage.locator('[data-arcline-command-bar="true"]').waitFor({ state: 'visible' });
    await cmdPage.locator('[data-command-item-kind]').first().waitFor({ state: 'visible' });
    await cmdPage.waitForTimeout(260);
    await cmdPage.screenshot({ path: join(outDir, 'arcline-command-bar.png') });
    await cmdPage.close();

    // 6. Interactive 4-step Onboarding Start Guide
    const onbPage = await context.newPage();
    await onbPage.setViewportSize({ width: 1280, height: 800 });
    await onbPage.goto(`chrome-extension://${extensionId}/onboarding.html`);
    await onbPage.locator('[data-testid="onboarding-root"]').waitFor({ state: 'visible' });
    await onbPage.waitForTimeout(350);
    await onbPage.screenshot({ path: join(outDir, 'arcline-onboarding.png') });
    await onbPage.close();

    // Generate exact 1280x800 Chrome Web Store PNGs for upload
    for (const file of [
      'arcline-overlay.png',
      'arcline-command-bar.png',
      'arcline-settings.png',
      'arcline-context-menu.png',
      'arcline-theme-studio.png',
      'arcline-onboarding.png',
    ]) {
      execFileSync('sips', ['-z', '800', '1280', join(outDir, file), '--out', join(cwsDir, file)]);
    }

    console.log(`Captured 6 Retina + 6 CWS (1280x800) screenshots [${lang}] -> ${outDir}`);
  } finally {
    await context.close().catch(() => undefined);
    await server.close();
    rmSync(profileDir, { recursive: true, force: true });
  }
}

async function main() {
  if (!existsSync(join(DIST_DIR, 'manifest.json'))) {
    throw new Error('Build dist first with just build');
  }
  await captureLocale('en', BASE_OUT_DIR, CWS_EN_DIR);
  await captureLocale('ja', join(BASE_OUT_DIR, 'ja'), CWS_JA_DIR);
}

await main();
