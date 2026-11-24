import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test, VISUAL_DIR } from './fixtures';

async function readOverlayState(page: Page) {
  return page.evaluate(() => {
    const host = document.getElementById('arcline-overlay-host');
    const root = host?.shadowRoot;
    const panel = root?.querySelector<HTMLDivElement>('[data-arcline-panel]');
    const iframe = root?.querySelector<HTMLIFrameElement>('iframe');
    const resize = root?.querySelector<HTMLDivElement>('[data-arcline-resize]');
    const panelStyle = panel ? getComputedStyle(panel) : null;
    const hostStyle = host ? getComputedStyle(host) : null;
    const panelRect = panel?.getBoundingClientRect();
    const resizeRect = resize?.getBoundingClientRect();
    return {
      hostPresent: Boolean(host),
      hostDisplay: hostStyle?.display ?? null,
      open: Boolean(panel?.classList.contains('open')),
      visibility: panelStyle?.visibility ?? null,
      opacity: panelStyle ? Number.parseFloat(panelStyle.opacity) : null,
      iframeHasSrc: Boolean(iframe?.hasAttribute('src')),
      iframeSrc: iframe?.getAttribute('src') ?? null,
      panelWidth: panelRect ? Math.round(panelRect.width) : 0,
      resizeX: resizeRect ? Math.round(resizeRect.left + resizeRect.width / 2) : 0,
      resizeY: resizeRect ? Math.round(resizeRect.top + resizeRect.height / 2) : 0,
    };
  });
}

test.describe('Left-edge auto-hide hover overlay', () => {
  test('zero startup paint, lazy iframe, graze rejection, dwell open, OOPIF hover & auto-hide', async ({
    arcline,
  }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 140,
      edgeCloseDelayMs: 220,
      overlayWidthPx: 300,
    });

    const page = await arcline.context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`${arcline.serverUrl}/normal`);
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);

    // 1. Sample 10 animation frames right after load: panel must never flash visible
    const startupFrames = await page.evaluate(
      () =>
        new Promise<Array<{ visibility: string; opacity: number }>>((resolve) => {
          const samples: Array<{ visibility: string; opacity: number }> = [];
          const tick = () => {
            const panel = document
              .getElementById('arcline-overlay-host')
              ?.shadowRoot?.querySelector<HTMLDivElement>('[data-arcline-panel]');
            if (panel) {
              const s = getComputedStyle(panel);
              samples.push({ visibility: s.visibility, opacity: Number.parseFloat(s.opacity) });
            }
            if (samples.length >= 10) resolve(samples);
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
    expect(startupFrames.every((f) => f.visibility === 'hidden' && f.opacity === 0)).toBe(true);

    // 2. Lazy iframe: src must NOT exist before the user intentionally hovers
    const initial = await readOverlayState(page);
    expect(initial.open).toBe(false);
    expect(initial.iframeHasSrc).toBe(false);

    // 3. Accidental graze (< openDelayMs) must NOT open
    await page.mouse.move(400, 300);
    await page.mouse.move(2, 300);
    await page.waitForTimeout(45);
    await page.mouse.move(400, 300);
    await page.waitForTimeout(220);
    expect((await readOverlayState(page)).open).toBe(false);
    expect((await readOverlayState(page)).iframeHasSrc).toBe(false);

    // 4. Deliberate dwell at left edge opens overlay & lazy-loads sidepanel iframe
    await page.mouse.move(2, 300);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);

    const opened = await readOverlayState(page);
    expect(opened.iframeHasSrc).toBe(true);
    expect(opened.iframeSrc).toContain('sidepanel.html?mode=overlay');

    // Wait for React sidebar inside the cross-origin extension iframe to render
    const frame = page.frameLocator('#arcline-overlay-host iframe');
    await expect(frame.locator('[data-arcline-ready="true"]')).toBeVisible();

    // 5. Move cursor INTO the cross-origin extension iframe and wait past closeDelayMs: must STAY OPEN!
    await page.mouse.move(140, 300);
    await page.waitForTimeout(360);
    expect((await readOverlayState(page)).open).toBe(true);

    // Capture full-page visual screenshot with floating overlay open over article
    await page.waitForTimeout(220);
    await page.screenshot({ path: join(VISUAL_DIR, 'edge-hover-overlay-open.png') });

    // 6. Move cursor back out to the webpage and wait past closeDelayMs: must auto-hide
    await page.mouse.move(640, 300);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(false);

    expect(pageErrors).toEqual([]);
  });

  test('drag suppression across left edge and post-release re-arm', async ({ arcline }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 80,
      edgeCloseDelayMs: 180,
    });

    const page = await arcline.context.newPage();
    await page.goto(`${arcline.serverUrl}/normal`);
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);

    // Drag from webpage text to left edge while holding mouse button
    await page.mouse.move(320, 260);
    await page.mouse.down();
    await page.mouse.move(2, 260, { steps: 6 });
    await page.waitForTimeout(220);
    expect((await readOverlayState(page)).open).toBe(false);

    // Release on the edge + small jitter: must stay suppressed until leaving the edge
    await page.mouse.up();
    await page.mouse.move(1, 264);
    await page.waitForTimeout(200);
    expect((await readOverlayState(page)).open).toBe(false);

    // Leave edge then re-enter cleanly -> now opens
    await page.mouse.move(140, 264);
    await page.mouse.move(2, 264);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);
  });

  test('window-centered Settings modal expands overlay stage, locks open, and outside click dismisses', async ({
    arcline,
  }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 60,
      edgeCloseDelayMs: 150,
      overlayWidthPx: 290,
    });

    const page = await arcline.context.newPage();
    await page.setViewportSize({ width: 1280, height: 760 });
    await page.goto(`${arcline.serverUrl}/normal`);
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);

    await page.mouse.move(2, 300);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);
    // Wait for slide-in transition to reach settled resting position (left === 6px)
    await expect
      .poll(() =>
        page.evaluate(() => {
          const panel = document
            .getElementById('arcline-overlay-host')
            ?.shadowRoot?.querySelector<HTMLDivElement>('[data-arcline-panel]');
          return panel ? Math.round(panel.getBoundingClientRect().left) : -999;
        }),
      )
      .toBe(6);

    const frame = page.frameLocator('#arcline-overlay-host iframe');
    const settingsBtn = frame.getByRole('button', { name: '設定・アーカイブ・Arcインポート' });
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();
    const dialog = frame.locator('dialog[data-arcline-settings-dialog="true"]');
    await expect(dialog).toBeVisible();

    // Verify Settings modal expands into the full browser window and renders centered (>= 540px wide)
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return box ? Math.round(box.width) : 0;
      })
      .toBeGreaterThanOrEqual(540);
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const centerX = box.x + box.width / 2;
      expect(Math.abs(centerX - 640)).toBeLessThan(40);
    }

    // Move mouse to the dimmed backdrop outside the centered modal without clicking: must STAY OPEN!
    await page.mouse.move(1220, 300);
    await page.waitForTimeout(320);
    expect((await readOverlayState(page)).open).toBe(true);
    await expect(dialog).toBeVisible();

    // Clicking outside the centered modal on the dimmed webpage backdrop dismisses cleanly
    await page.mouse.click(1220, 300);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(false);
  });

  test('resize handle updates width and persists across reload', async ({ arcline }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 50,
      edgeCloseDelayMs: 250,
      overlayWidthPx: 280,
    });

    const page = await arcline.context.newPage();
    await page.goto(`${arcline.serverUrl}/normal`);
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);

    await page.mouse.move(2, 300);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);
    await page.waitForTimeout(220); // Wait for slide-in transition to settle

    const before = await readOverlayState(page);
    expect(before.panelWidth).toBe(280);

    // Drag right-edge resize handle +70px
    await page.mouse.move(before.resizeX, before.resizeY);
    await page.mouse.down();
    await page.mouse.move(before.resizeX + 70, before.resizeY, { steps: 5 });
    await page.mouse.up();

    await expect.poll(async () => (await readOverlayState(page)).panelWidth).toBeGreaterThanOrEqual(
      340,
    );

    const persisted = await arcline.getSettings();
    expect(Number(persisted.overlayWidthPx)).toBeGreaterThanOrEqual(340);

    // Reload page and confirm persisted width is applied
    await page.reload();
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);
    await page.mouse.move(2, 300);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);
    expect((await readOverlayState(page)).panelWidth).toBeGreaterThanOrEqual(340);
  });

  test('hostile page CSS immunity (YouTube 10px, Reddit :not(:defined)) and SPA DOM self-repair', async ({
    arcline,
  }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 50,
      overlayWidthPx: 300,
    });

    for (const path of ['/youtube', '/reddit']) {
      const page = await arcline.context.newPage();
      await page.goto(`${arcline.serverUrl}${path}`);
      await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);
      await page.mouse.move(2, 240);
      await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);
      const state = await readOverlayState(page);
      expect(state.hostDisplay).toBe('block');
      expect(state.panelWidth).toBe(300);
      await page.mouse.move(700, 240);
      await expect.poll(async () => (await readOverlayState(page)).open).toBe(false);
      await page.close();
    }

    // SPA DOM removal self-repair
    const spa = await arcline.context.newPage();
    await spa.goto(`${arcline.serverUrl}/spa`);
    await expect.poll(async () => (await readOverlayState(spa)).hostPresent).toBe(true);
    await spa.click('#nuke-host');
    await expect.poll(async () => (await readOverlayState(spa)).hostPresent).toBe(true);
    await spa.mouse.move(2, 240);
    await expect.poll(async () => (await readOverlayState(spa)).open).toBe(true);
  });

  test('background tab automatically unloads overlay iframe to save RAM', async ({ arcline }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 50,
    });

    const tabA = await arcline.context.newPage();
    await tabA.goto(`${arcline.serverUrl}/page/alpha`);
    await expect.poll(async () => (await readOverlayState(tabA)).hostPresent).toBe(true);

    await tabA.mouse.move(2, 260);
    await expect.poll(async () => (await readOverlayState(tabA)).iframeHasSrc).toBe(true);

    // Switch active tab in Chrome/Brave so tabA genuinely becomes hidden -> iframe src unloads after 400ms
    const tabB = await arcline.context.newPage();
    await tabB.goto(`${arcline.serverUrl}/page/beta`);
    await arcline.worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const beta = tabs.find((t) => t.url?.includes('/page/beta'));
      if (beta?.id !== undefined) {
        await chrome.tabs.update(beta.id, { active: true });
      }
    });
    await tabB.bringToFront();

    await expect.poll(async () => (await readOverlayState(tabA)).iframeHasSrc, {
      timeout: 5_000,
    }).toBe(false);
  });

  test('two-finger horizontal swipe switches Spaces, allows instant reverse swipe without moving cursor, and avoids Back/Forward conflict', async ({
    arcline,
  }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 50,
      edgeCloseDelayMs: 400,
      overlayWidthPx: 290,
      swipeToSwitchSpace: true,
      openEmptySpacePage: false,
    });

    // Seed two Spaces via the sidepanel
    const setupPanel = await arcline.openPanel();
    await setupPanel.getByRole('button', { name: '新しいSpaceを作成' }).click();
    await setupPanel.getByLabel('Space 名').fill('SwipeSecond');
    await setupPanel.getByRole('button', { name: '作成', exact: true }).click();
    await expect(setupPanel.getByRole('button', { name: 'Space: SwipeSecond' })).toBeVisible();
    // Switch back to the first Space
    await setupPanel.getByRole('button', { name: /^Space:/ }).first().click();
    await setupPanel.close();

    // Build genuine two-entry browser history on the webpage so native Back could trigger if unguarded
    const page = await arcline.context.newPage();
    await page.setViewportSize({ width: 1280, height: 760 });
    await page.goto(`${arcline.serverUrl}/page/previous`);
    await page.goto(`${arcline.serverUrl}/page/current`);
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);

    // Open overlay via left-edge dwell and wait for slide-in transition to settle at left === 6px
    await page.mouse.move(2, 320);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const panel = document
            .getElementById('arcline-overlay-host')
            ?.shadowRoot?.querySelector<HTMLDivElement>('[data-arcline-panel]');
          return panel ? Math.round(panel.getBoundingClientRect().left) : -999;
        }),
      )
      .toBe(6);
    const frame = page.frameLocator('#arcline-overlay-host iframe');
    await expect(frame.locator('[data-arcline-ready="true"]')).toBeVisible();

    // Verify overscroll-behavior-x isolation: sidebar blocks history swipe, host webpage stays untouched
    const hostOverscroll = await page.evaluate(
      () => getComputedStyle(document.documentElement).overscrollBehaviorX,
    );
    expect(hostOverscroll).toBe('auto');

    const sidebarFrame = page.frames().find((f) => f.url().includes('sidepanel.html?mode=overlay'));
    expect(sidebarFrame).toBeDefined();
    if (sidebarFrame) {
      const sidebarOverscroll = await sidebarFrame.evaluate(() => [
        getComputedStyle(document.documentElement).overscrollBehaviorX,
        getComputedStyle(document.body).overscrollBehaviorX,
      ]);
      expect(sidebarOverscroll).toEqual(['none', 'none']);
    }

    // Move cursor over sidebar ONCE and perform horizontal two-finger trackpad swipe (positive deltaX -> next Space)
    await page.mouse.move(150, 320);
    await page.mouse.wheel(95, 0);
    // Trailing trackpad inertia in the SAME direction must be swallowed (no double switch)
    await page.mouse.wheel(60, 0);

    await expect(frame.locator('[data-arcline-ready="true"]')).toHaveAttribute(
      'data-active-space',
      'SwipeSecond',
    );
    // Empty Space feedback card is visible when openEmptySpacePage is false
    await expect(frame.locator('[data-empty-space-card="true"]')).toBeVisible();
    // Host webpage MUST remain on /page/current (no accidental browser Back/Forward)
    expect(page.url()).toBe(`${arcline.serverUrl}/page/current`);

    // IMMEDIATELY reverse-swipe (-deltaX) WITHOUT waiting 200ms and WITHOUT moving the cursor 1px!
    await page.mouse.wheel(-95, 0);
    await expect(frame.locator('[data-arcline-ready="true"]')).not.toHaveAttribute(
      'data-active-space',
      'SwipeSecond',
    );
    expect(page.url()).toBe(`${arcline.serverUrl}/page/current`);

    // Native browser Back navigation on the host webpage still works normally
    await page.goBack();
    await expect(page).toHaveURL(`${arcline.serverUrl}/page/previous`);

    // Now open a real active tab inside SwipeSecond, switch back to Main, and swipe into SwipeSecond:
    // the destination tab's floating overlay MUST auto-open and remain open so back-and-forth swiping works seamlessly!
    const secondPage = await arcline.context.newPage();
    await secondPage.setViewportSize({ width: 1280, height: 760 });
    await secondPage.goto(`${arcline.serverUrl}/page/second-space-tab`);
    await expect.poll(async () => (await readOverlayState(secondPage)).hostPresent).toBe(true);

    // Move secondPage into SwipeSecond via the sidepanel
    const movePanel = await arcline.openPanel();
    const swipeSecondId = await movePanel.evaluate(async () => {
      const tree = await chrome.bookmarks.getTree();
      const root = tree[0]?.children?.[1]?.children?.find((n) => n.title === 'Arcline');
      return root?.children?.find((c) => c.title === 'SwipeSecond')?.id ?? '';
    });
    expect(swipeSecondId).toBeTruthy();
    const secondTabId = await arcline.worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.find((t) => t.url?.includes('/page/second-space-tab'))?.id;
    });
    expect(secondTabId).toBeDefined();
    if (secondTabId !== undefined) {
      await movePanel.evaluate(
        async ({ winId, tabId, spaceId }) => {
          await chrome.runtime.sendMessage({
            arclineCommand: { type: 'moveTab', windowId: winId, tabId, spaceId },
          });
          await chrome.runtime.sendMessage({
            arclineCommand: { type: 'switchSpace', windowId: winId, spaceId },
          });
        },
        { winId: arcline.windowId, tabId: secondTabId, spaceId: swipeSecondId },
      );
    }
    // Switch back to the first Space on `page`
    await movePanel.getByRole('button', { name: /^Space:/ }).first().click();
    await movePanel.close();

    await page.bringToFront();
    await page.mouse.move(2, 320);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);
    await page.mouse.move(150, 320);
    await page.mouse.wheel(95, 0);

    // Destination tab `secondPage` must now have its floating overlay automatically open!
    await expect.poll(async () => (await readOverlayState(secondPage)).open).toBe(true);
    // And stay open past 450ms (surviving any late pointerleave from the departing tab)
    await secondPage.waitForTimeout(450);
    expect((await readOverlayState(secondPage)).open).toBe(true);
  });

  test('overlay UI remains zoom-invariant when webpage is zoomed to 150% or 75% (Cmd+ / Cmd-)', async ({
    arcline,
  }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 40,
      overlayWidthPx: 290,
    });

    const page = await arcline.context.newPage();
    await page.setViewportSize({ width: 1280, height: 760 });
    await page.goto(`${arcline.serverUrl}/normal`);
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);

    await page.mouse.move(2, 300);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);
    const frame = page.frameLocator('#arcline-overlay-host iframe');
    await expect(frame.locator('[data-arcline-ready="true"]')).toBeVisible();

    for (const zoomFactor of [1.5, 0.75, 1.0]) {
      const msgResults = await arcline.worker.evaluate(async (z) => {
        const tabs = await chrome.tabs.query({});
        const out: Array<{ id?: number; url?: string; actualZoom?: number; resp?: unknown; err?: string }> = [];
        for (const t of tabs) {
          if (t.id !== undefined && t.url?.includes('/normal')) {
            await chrome.tabs.setZoom(t.id, z);
            const actualZoom = await chrome.tabs.getZoom(t.id);
            try {
              const resp = await chrome.tabs.sendMessage(t.id, { arclineZoom: actualZoom });
              out.push({ id: t.id, url: t.url, actualZoom, resp });
            } catch (e) {
              out.push({ id: t.id, url: t.url, actualZoom, err: String(e) });
            }
          }
        }
        return out;
      }, zoomFactor);
      expect(msgResults.length).toBeGreaterThan(0);

      // Both the overlay iframe bounding box in unzoomed screen space (290px) and the typography inside
      // the extension iframe (13.5px) must remain 100% invariant across 150%, 75%, and 100% page zoom
      await expect
        .poll(async () => {
          const hostMetrics = await page.evaluate(() => {
            const root = document.getElementById('arcline-overlay-host')?.shadowRoot;
            const panel = root?.querySelector<HTMLDivElement>('[data-arcline-panel]');
            const z = panel ? Number.parseFloat(panel.style.zoom || '1') : 1;
            const rectW = panel ? panel.getBoundingClientRect().width : 0;
            // getBoundingClientRect().width in CSS pixels * pageZoom = physical unzoomed screen width
            const pageZ = z > 0 ? 1 / z : 1;
            return {
              appliedZoom: Number(z.toFixed(3)),
              physicalWidth: Math.round(rectW * pageZ),
            };
          });
          const sf = page.frames().find((f) => f.url().includes('sidepanel.html?mode=overlay'));
          const fontSize = sf
            ? await sf.evaluate(() => getComputedStyle(document.body).fontSize)
            : null;
          return {
            appliedZoom: hostMetrics.appliedZoom,
            physicalWidth: hostMetrics.physicalWidth,
            fontSize,
          };
        })
        .toEqual({
          appliedZoom: Number((1 / zoomFactor).toFixed(3)),
          physicalWidth: 290,
          fontSize: '13.5px',
        });
    }
  });

  test('overlay context menu extends past sidebar edge, opens submenu, and shows action toast', async ({
    arcline,
  }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 50,
      edgeCloseDelayMs: 400,
      overlayWidthPx: 270,
    });

    // Create a second Space so "他の Space へ移動" submenu appears
    const setupPanel = await arcline.openPanel();
    await setupPanel.getByRole('button', { name: '新しいSpaceを作成' }).click();
    await setupPanel.getByLabel('Space 名').fill('TargetSpace');
    await setupPanel.getByRole('button', { name: '作成', exact: true }).click();
    await expect(setupPanel.getByRole('button', { name: 'Space: TargetSpace' })).toBeVisible();
    await setupPanel.getByRole('button', { name: /^Space:/ }).first().click();
    await setupPanel.close();

    const page = await arcline.context.newPage();
    await page.setViewportSize({ width: 1280, height: 760 });
    await page.goto(`${arcline.serverUrl}/page/alpha`);
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);

    await page.mouse.move(2, 320);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const panel = document
            .getElementById('arcline-overlay-host')
            ?.shadowRoot?.querySelector<HTMLDivElement>('[data-arcline-panel]');
          return panel ? Math.round(panel.getBoundingClientRect().left) : -999;
        }),
      )
      .toBe(6);

    const frame = page.frameLocator('#arcline-overlay-host iframe');
    const tabBtn = frame.getByRole('button', { name: /Page ALPHA/i }).first();
    await expect(tabBtn).toBeVisible();

    // Right-click near right side of the tab -> menu expands into full-viewport stage past 270px!
    await tabBtn.click({ button: 'right', position: { x: 155, y: 14 } });
    const menu = frame.getByRole('menu', { name: 'コンテキストメニュー' });
    await expect(menu).toBeVisible();
    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    if (menuBox) {
      expect(menuBox.x + menuBox.width).toBeGreaterThan(276);
    }

    // Hover submenu "他の Space へ移動" and confirm TargetSpace appears
    await frame.getByRole('menuitem', { name: '他の Space へ移動' }).hover();
    await expect(frame.getByRole('menuitem', { name: 'TargetSpace' })).toBeVisible();

    // Click "URLをコピー" -> toast confirms action
    await frame.getByRole('menuitem', { name: 'URLをコピー' }).click();
    await expect(frame.getByRole('status')).toContainText('コピー');
  });

  test('overlay auto-opens across page navigations and tab clicks only when previously open', async ({
    arcline,
  }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 50,
      edgeCloseDelayMs: 120,
      overlayWidthPx: 280,
    });

    // 1. When overlay is closed, opening a webpage stays closed
    const tabA = await arcline.context.newPage();
    await tabA.goto(`${arcline.serverUrl}/page/alpha`);
    await expect.poll(async () => (await readOverlayState(tabA)).hostPresent).toBe(true);
    await tabA.waitForTimeout(200);
    expect((await readOverlayState(tabA)).open).toBe(false);

    // 2. Open overlay on tabA, then navigate to another page -> overlay auto-opens on destination
    await tabA.mouse.move(2, 260);
    await expect.poll(async () => (await readOverlayState(tabA)).open).toBe(true);

    await tabA.goto(`${arcline.serverUrl}/page/beta`);
    await expect.poll(async () => (await readOverlayState(tabA)).hostPresent).toBe(true);
    await expect.poll(async () => (await readOverlayState(tabA)).open).toBe(true);

    // 3. Open a second tab while overlay is open -> destination tab also auto-opens overlay
    const tabB = await arcline.context.newPage();
    await tabB.goto(`${arcline.serverUrl}/page/gamma`);
    await expect.poll(async () => (await readOverlayState(tabB)).hostPresent).toBe(true);
    await expect.poll(async () => (await readOverlayState(tabB)).open).toBe(true);

    // 4. Explicitly close overlay by moving mouse out past grace period, then navigate -> stays CLOSED!
    await tabB.waitForTimeout(420);
    await tabB.mouse.move(700, 300);
    await expect.poll(async () => (await readOverlayState(tabB)).open).toBe(false);

    await tabB.goto(`${arcline.serverUrl}/page/delta`);
    await expect.poll(async () => (await readOverlayState(tabB)).hostPresent).toBe(true);
    await tabB.waitForTimeout(250);
    expect((await readOverlayState(tabB)).open).toBe(false);
  });

  test('edge locator hover, overlay + New Tab modal stability, and folder right-click without flicker', async ({
    arcline,
  }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 60,
      edgeCloseDelayMs: 300,
      overlayWidthPx: 290,
    });

    // Seed a Folder in the active Space via the sidepanel
    const setupPanel = await arcline.openPanel();
    await setupPanel.getByRole('button', { name: '新しいフォルダを作成' }).click();
    const renameInput = setupPanel.locator('input[type="text"]').first();
    await expect(renameInput).toBeVisible();
    await renameInput.fill('Overlay Docs');
    await renameInput.press('Enter');
    await expect(setupPanel.getByText('Overlay Docs')).toBeVisible();
    await setupPanel.close();

    // Open a webpage and verify Playwright .hover() on [data-arcline-edge] opens the overlay
    const page = await arcline.context.newPage();
    await page.setViewportSize({ width: 1280, height: 760 });
    await page.goto(`${arcline.serverUrl}/normal`);
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);

    const edgeTrigger = page.locator('#arcline-overlay-host [data-arcline-edge]');
    await expect(edgeTrigger).toHaveAttribute('role', 'region');
    await expect(edgeTrigger).toHaveAttribute('aria-label', 'Arcline Sidebar Edge Trigger');
    await edgeTrigger.hover();
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);

    // Wait for slide-in transition to reach settled resting position (left === 6px)
    await expect
      .poll(() =>
        page.evaluate(() => {
          const panel = document
            .getElementById('arcline-overlay-host')
            ?.shadowRoot?.querySelector<HTMLDivElement>('[data-arcline-panel]');
          return panel ? Math.round(panel.getBoundingClientRect().left) : -999;
        }),
      )
      .toBe(6);

    const frame = page.frameLocator('#arcline-overlay-host iframe[title="Arcline Sidebar"]');
    await expect(frame.locator('[data-arcline-ready="true"]')).toBeVisible();

    // Right-click Folder in the overlay sidebar -> folder context menu opens without closing/flashing overlay
    const folderBtn = frame.getByRole('button', { name: /Overlay Docs/ });
    await expect(folderBtn).toBeVisible();
    await folderBtn.click({ button: 'right' });
    const folderMenu = frame.getByRole('menu', { name: 'コンテキストメニュー' });
    await expect(folderMenu).toBeVisible();
    await expect(frame.getByRole('menuitem', { name: 'フォルダ名を変更' })).toBeVisible();
    expect((await readOverlayState(page)).open).toBe(true);
    await page.waitForTimeout(350);
    expect((await readOverlayState(page)).open).toBe(true);
    await folderBtn.press('Escape');
    await expect(folderMenu).toBeHidden();

    // Click "+ New Tab" inside the overlay sidebar -> opens centered Command Bar modal over the webpage
    await frame.getByRole('button', { name: 'New Tab' }).click();
    const cmdFrameLocator = page.locator('#arcline-overlay-host iframe[title="Arcline Command Bar"]');
    await expect(cmdFrameLocator).toHaveCount(1);
    const cmdFrame = page.frameLocator('#arcline-overlay-host iframe[title="Arcline Command Bar"]');
    const cmdInput = cmdFrame.getByRole('textbox', { name: 'Arcline コマンドバー' });
    await expect(cmdInput).toBeVisible();

    // Typing narrows results while keeping the <input> vertical top position rock-solid (<= 2px)
    const initialCount = await cmdFrame.locator('button[data-command-item-kind]').count();
    expect(initialCount).toBeGreaterThan(1);
    const initialTop = await cmdInput.evaluate((el) => el.getBoundingClientRect().top);
    await cmdInput.fill('zzz-no-match-query');
    await expect
      .poll(() => cmdFrame.locator('button[data-command-item-kind]').count())
      .toBeLessThan(initialCount);
    const narrowedTop = await cmdInput.evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(narrowedTop - initialTop)).toBeLessThanOrEqual(2);

    // Clear query with Escape, then move focus to a result button and press Escape -> closes modal cleanly
    await cmdInput.press('Escape');
    await expect(cmdInput).toHaveValue('');
    const firstRow = cmdFrame.locator('button[data-command-item-kind]').first();
    await firstRow.focus();
    await firstRow.press('Escape');
    await expect(cmdFrameLocator).toHaveCount(0);
  });
});
