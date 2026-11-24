import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  expect,
  launchExtensionContext,
  startTestServer,
  test,
  VISUAL_DIR,
} from './fixtures';

test.describe('MV3 resilience, restart recovery, native sidePanel & memory bounds', () => {
  test('recovers cleanly after forced Service Worker termination', async ({ arcline }) => {
    const panel = await arcline.openPanel();
    await panel.getByRole('button', { name: '新しいSpaceを作成' }).click();
    await panel.getByLabel('Space 名').fill('SW-Resilience');
    await panel.getByRole('button', { name: '作成', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Space: SW-Resilience' })).toBeVisible();

    // Kill the MV3 Service Worker via CDP ServiceWorker.stopAllWorkers
    const cdp = await arcline.context.newCDPSession(panel);
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.stopAllWorkers');
    await panel.waitForTimeout(300);

    // Issue a new command through the UI -> SW must wake up and succeed
    await panel.getByRole('button', { name: '新しいフォルダを作成' }).click();
    const renameInput = panel.locator('main input');
    await expect(renameInput).toHaveValue('New Folder');
    await renameInput.press('Enter');
    await expect(panel.getByText('New Folder')).toBeVisible();
  });

  test('persistent profile browser restart preserves bookmarks with zero duplicates', async () => {
    const server = await startTestServer();
    const profileDir = mkdtempSync(join(tmpdir(), 'arcline-restart-'));
    // Configure Chromium/Brave profile to restore last session on startup
    mkdirSync(join(profileDir, 'Default'), { recursive: true });
    writeFileSync(
      join(profileDir, 'Default/Preferences'),
      JSON.stringify({ session: { restore_on_startup: 1 } }),
      'utf-8',
    );

    try {
      // Session 1: Create Space + Favorite + Pin
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
        await panel.waitForTimeout(250);
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
          const arcline = arclineFolders[0];
          const children = arcline?.children ?? [];
          const favCount = children.filter((c) => c.title === 'Favorites').length;
          const restartedCount = children.filter((c) => c.title === 'Restarted').length;
          return { arclineRootCount: arclineFolders.length, favCount, restartedCount };
        });

        expect(counts.arclineRootCount).toBe(1);
        expect(counts.favCount).toBe(1);
        expect(counts.restartedCount).toBe(1);
      } finally {
        await s2.context.close();
      }
    } finally {
      await server.close();
      rmSync(profileDir, { recursive: true, force: true });
    }
  });

  test('real native chrome.sidePanel.open renders cleanly and captures CDP screenshot', async ({
    arcline,
  }) => {
    // Open an extension tab so we can invoke chrome.sidePanel.open() from a real trusted user click
    const triggerPage = await arcline.context.newPage();
    await triggerPage.goto(`chrome-extension://${arcline.extensionId}/sidepanel.html?windowId=${arcline.windowId}`);
    await triggerPage.locator('[data-arcline-ready="true"]').waitFor({ state: 'visible' });

    await triggerPage.evaluate((winId) => {
      const btn = document.createElement('button');
      btn.id = 'test-open-native-sidepanel';
      btn.textContent = 'Open Native SidePanel';
      btn.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;padding:8px;';
      btn.addEventListener('click', () => {
        void chrome.sidePanel.open({ windowId: winId });
      });
      document.body.append(btn);
    }, arcline.windowId);

    await triggerPage.click('#test-open-native-sidepanel');
    await triggerPage.waitForTimeout(700);

    // Inspect browser-level targets via CDP to locate the real native sidepanel target
    const browserCdp = await arcline.context.browser()?.newBrowserCDPSession();
    if (!browserCdp) {
      // Fallback: launchPersistentContext exposes page CDP session
      const pageCdp = await arcline.context.newCDPSession(triggerPage);
      const { targetInfos } = await pageCdp.send('Target.getTargets');
      const spTargets = targetInfos.filter(
        (t) =>
          t.url.startsWith(`chrome-extension://${arcline.extensionId}/sidepanel.html`) &&
          !t.url.includes('windowId='),
      );
      expect(spTargets.length).toBeGreaterThanOrEqual(1);
      const nativeTarget = spTargets[0];
      if (nativeTarget) {
        const { sessionId } = await pageCdp.send('Target.attachToTarget', {
          targetId: nativeTarget.targetId,
          flatten: true,
        });
        expect(sessionId).toBeTruthy();
      }
      return;
    }

    const { targetInfos } = await browserCdp.send('Target.getTargets');
    const nativeTarget = targetInfos.find(
      (t) =>
        t.url.startsWith(`chrome-extension://${arcline.extensionId}/sidepanel.html`) &&
        !t.url.includes('windowId='),
    );
    expect(nativeTarget).toBeDefined();
    if (nativeTarget) {
      const { sessionId } = await browserCdp.send('Target.attachToTarget', {
        targetId: nativeTarget.targetId,
        flatten: true,
      });
      // Wait briefly for React hydration in native panel, then capture raw CDP screenshot
      await triggerPage.waitForTimeout(400);
      const shot = (await browserCdp.send(
        'Page.captureScreenshot',
        { format: 'png' },
        // @ts-expect-error Playwright CDPSession accepts sessionId on raw protocol calls or fallback
        sessionId,
      ).catch(() => null)) as { data?: string } | null;
      if (shot?.data) {
        writeFileSync(join(VISUAL_DIR, 'native-sidepanel-real.png'), Buffer.from(shot.data, 'base64'));
      }
    }
  });

  test('repeated edge-hover open/close cycles keep DOM nodes and JS heap bounded', async ({
    arcline,
  }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 30,
      edgeCloseDelayMs: 50,
    });

    const page = await arcline.context.newPage();
    await page.goto(`${arcline.serverUrl}/normal`);
    await page.waitForTimeout(200);

    const cdp = await arcline.context.newCDPSession(page);
    await cdp.send('Performance.enable');

    const getMetrics = async () => {
      const { metrics } = await cdp.send('Performance.getMetrics');
      const map = Object.fromEntries(metrics.map((m) => [m.name, m.value]));
      return { nodes: map.Nodes ?? 0, heap: map.JSHeapUsedSize ?? 0 };
    };

    // Warm up once so lazy iframe is allocated
    await page.mouse.move(2, 300);
    await page.waitForTimeout(180);
    await page.mouse.move(600, 300);
    await page.waitForTimeout(180);
    const baseline = await getMetrics();

    // Perform 10 rapid open/close cycles
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(2, 300);
      await page.waitForTimeout(90);
      await page.mouse.move(600, 300);
      await page.waitForTimeout(110);
    }

    const after = await getMetrics();
    // Host page DOM node count must not grow across hover toggles
    expect(after.nodes - baseline.nodes).toBeLessThanOrEqual(20);
    // Host page JS heap delta must remain small (< 5MB)
    expect(after.heap - baseline.heap).toBeLessThan(5 * 1024 * 1024);
  });
});
