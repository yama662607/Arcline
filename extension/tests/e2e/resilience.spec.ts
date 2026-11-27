import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, launchExtensionContext, startTestServer, test } from './fixtures';

test.describe('MV3 resilience, restart recovery & native Side Panel auto-fallback', () => {
  test('recovers cleanly after forced Service Worker termination and expired OOPIF frame token', async ({
    arcline,
  }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 30,
      edgeCloseDelayMs: 120,
    });

    // 1. Kill MV3 Service Worker via CDP and verify UI command wakes it cleanly
    const panel = await arcline.openPanel();
    await panel.getByRole('button', { name: '新しいSpaceを作成' }).click();
    await panel.getByLabel('Space 名').fill('SW-Resilience');
    await panel.getByRole('button', { name: '作成', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Space: SW-Resilience' })).toBeVisible();

    const cdp = await arcline.context.newCDPSession(panel);
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.stopAllWorkers');
    await panel.waitForTimeout(250);

    await panel.getByRole('button', { name: '新しいフォルダを作成' }).click();
    const renameInput = panel.locator('main input');
    await expect(renameInput).toHaveValue('New Folder');
    await renameInput.press('Enter');
    await expect(panel.getByText('New Folder')).toBeVisible();
    await panel.close();

    // 2. Expired/invalid frame token on overlay iframe self-recovers instead of rendering blank
    const page = await arcline.context.newPage();
    await page.goto(`${arcline.serverUrl}/normal`);
    await expect
      .poll(() => page.evaluate(() => Boolean(document.getElementById('arcline-overlay-host'))))
      .toBe(true);

    await page.mouse.move(2, 300);
    const sidebarFrame = page.frameLocator('#arcline-overlay-host iframe[title="Arcline Sidebar"]');
    await expect(sidebarFrame.locator('.arcline-shell')).toBeVisible();

    await page.evaluate(() => {
      const iframe = document
        .getElementById('arcline-overlay-host')
        ?.shadowRoot?.querySelector<HTMLIFrameElement>('iframe[title="Arcline Sidebar"]');
      if (iframe) {
        iframe.src = `${iframe.src.split('#')[0]}#arclineToken=00000000000000000000000000000000`;
      }
    });

    await expect(sidebarFrame.locator('.arcline-shell')).toBeVisible({ timeout: 5000 });
  });

  test('persistent profile browser restart preserves bookmarks with zero duplicates', async () => {
    const server = await startTestServer();
    const profileDir = mkdtempSync(join(tmpdir(), 'arcline-restart-'));
    mkdirSync(join(profileDir, 'Default'), { recursive: true });
    writeFileSync(
      join(profileDir, 'Default/Preferences'),
      JSON.stringify({ session: { restore_on_startup: 1 } }),
      'utf-8',
    );

    try {
      // Session 1: Create Space
      const s1 = await launchExtensionContext(profileDir);
      try {
        const winId = await s1.worker.evaluate(async () => (await chrome.windows.getLastFocused()).id ?? 1);
        const tab = await s1.context.newPage();
        await tab.goto(`${server.url}/page/persist`);
        const panel = await s1.context.newPage();
        await panel.goto(`chrome-extension://${s1.extensionId}/sidepanel.html?windowId=${winId}`);
        await panel.locator('[data-arcline-ready="true"]').waitFor({ state: 'visible' });

        await panel.getByRole('button', { name: '新しいSpaceを作成' }).click();
        await panel.getByLabel('Space 名').fill('Restarted');
        await panel.getByRole('button', { name: '作成', exact: true }).click();
        await expect(panel.getByRole('button', { name: 'Space: Restarted' })).toBeVisible();
        await panel.waitForTimeout(200);
      } finally {
        await s1.context.close();
      }

      // Session 2: Relaunch same profile with --restore-last-session
      const s2 = await launchExtensionContext(profileDir, ['--restore-last-session']);
      try {
        const counts = await s2.worker.evaluate(async () => {
          const tree = await chrome.bookmarks.getTree();
          const root = tree[0]?.children?.[1];
          const arclineFolders = (root?.children ?? []).filter((n) => n.title === 'Arcline');
          const children = arclineFolders[0]?.children ?? [];
          return {
            arclineRootCount: arclineFolders.length,
            favCount: children.filter((c) => c.title === 'Favorites').length,
            restartedCount: children.filter((c) => c.title === 'Restarted').length,
          };
        });

        expect(counts).toEqual({ arclineRootCount: 1, favCount: 1, restartedCount: 1 });
      } finally {
        await s2.context.close();
      }
    } finally {
      await server.close();
      rmSync(profileDir, { recursive: true, force: true });
    }
  });

  test('auto-fallback native Side Panel on restricted page closes and returns to floating overlay', async ({
    arcline,
  }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 30,
      edgeCloseDelayMs: 120,
    });

    const tabA = await arcline.context.newPage();
    await tabA.goto(`${arcline.serverUrl}/page/return-target`);
    const tabB = await arcline.context.newPage();
    await tabB.goto('chrome://version');
    await tabA.bringToFront();
    await expect
      .poll(() => tabA.evaluate(() => Boolean(document.getElementById('arcline-overlay-host'))))
      .toBe(true);

    // Open floating overlay on tabA and click the restricted chrome://version tab inside it
    await tabA.mouse.move(2, 300);
    const frameA = tabA.frameLocator('#arcline-overlay-host iframe[title="Arcline Sidebar"]');
    await expect(frameA.locator('[data-arcline-ready="true"]')).toBeVisible();
    await tabA.waitForTimeout(240);
    const versionRow = frameA.locator('button[title*="version" i]').first();
    await expect(versionRow).toBeVisible({ timeout: 5000 });
    await versionRow.click();

    // Native Side Panel opens in auto-fallback mode on the restricted page
    await expect
      .poll(async () => {
        const res = await arcline.worker.evaluate(() =>
          chrome.storage.session.get('arcline:sidePanelMode'),
        );
        return res['arcline:sidePanelMode'];
      })
      .toBe('auto-fallback');

    // Return to tabA (normal HTTP page) -> auto-fallback Side Panel closes and restores floating overlay
    await tabA.bringToFront();
    await expect
      .poll(async () => {
        const res = await arcline.worker.evaluate(() =>
          chrome.storage.session.get('arcline:sidePanelMode'),
        );
        return res['arcline:sidePanelMode'];
      })
      .toBe('closed');

    await expect
      .poll(() =>
        tabA.evaluate(() =>
          Boolean(
            document
              .getElementById('arcline-overlay-host')
              ?.shadowRoot?.querySelector('[data-arcline-panel]')
              ?.classList.contains('open'),
          ),
        ),
      )
      .toBe(true);
  });
});
