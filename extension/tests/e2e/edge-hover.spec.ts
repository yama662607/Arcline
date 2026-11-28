import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

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
      panelLeft: panelRect ? Math.round(panelRect.left) : -999,
      panelWidth: panelRect ? Math.round(panelRect.width) : 0,
      resizeX: resizeRect ? Math.round(resizeRect.left + resizeRect.width / 2) : 0,
      resizeY: resizeRect ? Math.round(resizeRect.top + resizeRect.height / 2) : 0,
    };
  });
}

async function waitForPanelSettled(page: Page) {
  await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);
  await expect.poll(async () => (await readOverlayState(page)).panelLeft).toBe(6);
}

test.describe('Left-edge auto-hide hover overlay', () => {
  test('startup paint, lazy iframe, graze/drag suppression, OOPIF hover, resize persistence & auto-hide', async ({
    arcline,
  }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 100,
      edgeCloseDelayMs: 180,
      overlayWidthPx: 280,
    });

    const page = await arcline.context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(`${arcline.serverUrl}/normal`);
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);

    // 1. Zero startup paint across 10 animation frames & lazy iframe (no src before hover)
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
    expect((await readOverlayState(page)).iframeHasSrc).toBe(false);

    // 2. Accidental graze (< openDelayMs) must NOT open or load iframe
    await page.mouse.move(400, 300);
    await page.mouse.move(2, 300);
    await page.waitForTimeout(35);
    await page.mouse.move(400, 300);
    await page.waitForTimeout(160);
    expect((await readOverlayState(page)).open).toBe(false);
    expect((await readOverlayState(page)).iframeHasSrc).toBe(false);

    // 3. Drag selection across left edge stays suppressed until leaving and re-entering edge
    await page.mouse.move(320, 260);
    await page.mouse.down();
    await page.mouse.move(2, 260, { steps: 5 });
    await page.waitForTimeout(160);
    expect((await readOverlayState(page)).open).toBe(false);
    await page.mouse.up();
    await page.mouse.move(1, 264);
    await page.waitForTimeout(160);
    expect((await readOverlayState(page)).open).toBe(false);

    // 4. Leave edge, then deliberate edge hover opens overlay & lazy-loads OOPIF sidebar
    await page.mouse.move(140, 264);
    const edgeTrigger = page.locator('#arcline-overlay-host [data-arcline-edge]');
    await expect(edgeTrigger).toHaveAttribute('role', 'region');
    await edgeTrigger.hover();
    await waitForPanelSettled(page);

    const opened = await readOverlayState(page);
    expect(opened.iframeSrc).toContain('sidepanel.html?mode=overlay');
    expect(opened.panelWidth).toBe(280);
    const frame = page.frameLocator('#arcline-overlay-host iframe[title="Arcline Sidebar"]');
    await expect(frame.locator('[data-arcline-ready="true"]')).toBeVisible();

    // 5. Cursor inside cross-origin extension iframe stays open past closeDelayMs
    await page.mouse.move(140, 300);
    await page.waitForTimeout(260);
    expect((await readOverlayState(page)).open).toBe(true);

    // 6. Drag resize handle +70px -> persists across page reload
    const before = await readOverlayState(page);
    await page.mouse.move(before.resizeX, before.resizeY);
    await page.mouse.down();
    await page.mouse.move(before.resizeX + 70, before.resizeY, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await readOverlayState(page)).panelWidth).toBeGreaterThanOrEqual(
      340,
    );
    expect(Number((await arcline.getSettings()).overlayWidthPx)).toBeGreaterThanOrEqual(340);

    // 7. Move cursor back out to webpage -> auto-hides, then reload verifies persisted width
    await page.mouse.move(700, 300);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(false);

    await page.reload();
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);
    await page.mouse.move(2, 300);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);
    expect((await readOverlayState(page)).panelWidth).toBeGreaterThanOrEqual(340);
    expect(pageErrors).toEqual([]);
  });

  test('overlay interactions: context menu overflow, Settings modal & horizontal Space swipe', async ({
    arcline,
  }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 50,
      edgeCloseDelayMs: 400,
      overlayWidthPx: 270,
      swipeToSwitchSpace: true,
      openEmptySpacePage: false,
    });

    // Seed a 2nd Space ("TargetSpace") and a Folder in the active Space directly via bookmarks API
    await arcline.worker.evaluate(async () => {
      const rootRes = await chrome.storage.local.get('arcline:root');
      const rootId = (rootRes['arcline:root'] as { rootId?: string } | undefined)?.rootId;
      if (!rootId) return;
      const children = await chrome.bookmarks.getChildren(rootId);
      const mainSpace = children.find((c) => c.title !== 'Favorites');
      if (mainSpace) {
        await chrome.bookmarks.create({ parentId: mainSpace.id, title: 'Overlay Docs' });
      }
      await chrome.bookmarks.create({ parentId: rootId, title: 'TargetSpace' });
    });

    // Build two-entry browser history so native Back could trigger if swipe isolation failed
    const page = await arcline.context.newPage();
    await page.setViewportSize({ width: 1280, height: 760 });
    await page.goto(`${arcline.serverUrl}/page/previous`);
    await page.goto(`${arcline.serverUrl}/page/current`);
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);

    await page.mouse.move(2, 320);
    await waitForPanelSettled(page);
    const frame = page.frameLocator('#arcline-overlay-host iframe[title="Arcline Sidebar"]');
    await expect(frame.locator('[data-arcline-ready="true"]')).toBeVisible();
    await expect(frame.getByRole('button', { name: 'Space: TargetSpace' })).toBeVisible();

    // 1. Folder & Tab right-click context menu extends past 270px sidebar edge without flicker
    const folderBtn = frame.getByRole('button', { name: /Overlay Docs/ });
    await expect(folderBtn).toBeVisible();
    await folderBtn.click({ button: 'right' });
    const menu = frame.getByRole('menu', { name: 'コンテキストメニュー' });
    await expect(menu).toBeVisible();
    await expect(frame.getByRole('menuitem', { name: 'フォルダ名を変更' })).toBeVisible();
    await folderBtn.press('Escape');
    await expect(menu).toBeHidden();

    const tabBtn = frame.getByRole('button', { name: /Page CURRENT/i }).first();
    await tabBtn.click({ button: 'right', position: { x: 155, y: 14 } });
    await expect(menu).toBeVisible();
    await expect(frame.locator('[data-arcline-ready="true"]')).toHaveAttribute(
      'data-stage-expanded',
      'true',
    );
    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    if (menuBox) {
      expect(menuBox.x + menuBox.width).toBeGreaterThan(276);
    }
    const moveMenuItem = frame.getByRole('menuitem', { name: '他の Space へ移動' });
    await moveMenuItem.hover();
    await expect(frame.getByRole('menuitem', { name: 'TargetSpace' })).toBeVisible();
    await frame.getByRole('menuitem', { name: 'URLをコピー' }).click();
    await expect(frame.getByRole('status')).toContainText('コピー');

    // 2. Horizontal two-finger Space swipe: overscroll isolation, inertia swallow, instant reverse
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

    await page.mouse.move(140, 320);
    await page.mouse.wheel(95, 0);
    await page.mouse.wheel(60, 0); // Trailing inertia in same direction must be swallowed
    await expect(frame.locator('[data-arcline-ready="true"]')).toHaveAttribute(
      'data-active-space',
      'TargetSpace',
    );
    expect(page.url()).toBe(`${arcline.serverUrl}/page/current`);

    // Immediate reverse swipe without moving cursor switches back without triggering browser Back
    await page.mouse.wheel(-95, 0);
    await expect(frame.locator('[data-arcline-ready="true"]')).not.toHaveAttribute(
      'data-active-space',
      'TargetSpace',
    );
    expect(page.url()).toBe(`${arcline.serverUrl}/page/current`);

    // 3. Settings modal expands centered (>= 540px), locks open on hover-out, outside click dismisses
    await waitForPanelSettled(page);
    await page.waitForTimeout(220);
    await frame.getByRole('button', { name: '設定・アーカイブ・Arcインポート' }).click();
    const dialog = frame.locator('dialog[data-arcline-settings-dialog="true"]');
    await expect(dialog).toBeVisible();
    await expect
      .poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0))
      .toBeGreaterThanOrEqual(540);
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    if (dialogBox) {
      expect(Math.abs(dialogBox.x + dialogBox.width / 2 - 640)).toBeLessThan(40);
    }

    await page.mouse.move(1220, 300);
    await page.waitForTimeout(460);
    expect((await readOverlayState(page)).open).toBe(true);
    await page.mouse.click(1220, 300);
    await expect(dialog).toBeHidden();
    await page.mouse.click(1220, 300);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(false);

    // Native Back on host page still works normally
    await page.goBack();
    await expect(page).toHaveURL(`${arcline.serverUrl}/page/previous`);
  });

  test('hostile CSS immunity, zoom invariance, SPA self-repair, scroll continuity & background RAM unload', async ({
    arcline,
  }) => {
    await arcline.setSettings({
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 6,
      edgeOpenDelayMs: 40,
      edgeCloseDelayMs: 120,
      overlayWidthPx: 290,
    });

    // 1. Hostile CSS immunity (YouTube 10px root, Reddit :not(:defined)) & SPA DOM self-repair
    const page = await arcline.context.newPage();
    await page.setViewportSize({ width: 1280, height: 760 });
    for (const path of ['/youtube', '/reddit']) {
      await page.goto(`${arcline.serverUrl}${path}`);
      await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);
      await page.mouse.move(2, 240);
      await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);
      const state = await readOverlayState(page);
      expect(state.hostDisplay).toBe('block');
      expect(state.panelWidth).toBe(290);
      await page.mouse.move(700, 240);
      await expect.poll(async () => (await readOverlayState(page)).open).toBe(false);
    }

    await page.goto(`${arcline.serverUrl}/spa`);
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);
    await page.click('#nuke-host');
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);

    // 2. Zoom invariance (150%, 75%, 100%): physical width 290px & typography 13.5px remain constant
    await page.goto(`${arcline.serverUrl}/page/alpha`);
    await expect.poll(async () => (await readOverlayState(page)).hostPresent).toBe(true);
    // Overlay stays closed when previously closed
    await page.waitForTimeout(160);
    expect((await readOverlayState(page)).open).toBe(false);

    // Seed scrollable pins for scroll-position preservation check
    await arcline.worker.evaluate(async () => {
      const rootRes = await chrome.storage.local.get('arcline:root');
      const rootId = (rootRes['arcline:root'] as { rootId?: string } | undefined)?.rootId;
      if (!rootId) return;
      const children = await chrome.bookmarks.getChildren(rootId);
      const mainSpace = children.find((c) => c.title !== 'Favorites');
      if (!mainSpace) return;
      for (let i = 1; i <= 26; i += 1) {
        await chrome.bookmarks.create({
          parentId: mainSpace.id,
          title: `Scrollable Pin ${i}`,
          url: `https://example.com/scroll-pin-${i}`,
        });
      }
    });

    await page.mouse.move(2, 260);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);
    const frameA = page.frameLocator('#arcline-overlay-host iframe[title="Arcline Sidebar"]');
    await expect(frameA.locator('[data-arcline-ready="true"]')).toBeVisible();

    for (const zoomFactor of [1.5, 0.75, 1.0]) {
      await arcline.worker.evaluate(async (z) => {
        const tabs = await chrome.tabs.query({});
        for (const t of tabs) {
          if (t.id !== undefined && t.url?.includes('/page/alpha')) {
            await chrome.tabs.setZoom(t.id, z);
            const actualZoom = await chrome.tabs.getZoom(t.id);
            await chrome.tabs.sendMessage(t.id, { arclineZoom: actualZoom }).catch(() => undefined);
          }
        }
      }, zoomFactor);

      await expect
        .poll(async () => {
          const metrics = await page.evaluate(() => {
            const panel = document
              .getElementById('arcline-overlay-host')
              ?.shadowRoot?.querySelector<HTMLDivElement>('[data-arcline-panel]');
            const z = panel ? Number.parseFloat(panel.style.zoom || '1') : 1;
            const rectW = panel ? panel.getBoundingClientRect().width : 0;
            return {
              appliedZoom: Number(z.toFixed(3)),
              physicalWidth: Math.round(rectW * (z > 0 ? 1 / z : 1)),
            };
          });
          const sf = page.frames().find((f) => f.url().includes('sidepanel.html?mode=overlay'));
          const fontSize = sf
            ? await sf.evaluate(() => getComputedStyle(document.body).fontSize)
            : null;
          return { ...metrics, fontSize };
        })
        .toEqual({
          appliedZoom: Number((1 / zoomFactor).toFixed(3)),
          physicalWidth: 290,
          fontSize: '13.5px',
        });
    }

    // 3. Scroll position preservation across navigation & tab switch + background tab RAM unload
    await expect(frameA.getByText('Scrollable Pin 26')).toBeAttached();
    const savedScrollTop = await frameA.locator('main.arcline-scroll').evaluate((el) => {
      el.scrollTop = 220;
      el.dispatchEvent(new Event('scroll'));
      return el.scrollTop;
    });
    expect(savedScrollTop).toBeGreaterThanOrEqual(100);
    await page.waitForTimeout(120);

    await page.goto(`${arcline.serverUrl}/page/beta`);
    await expect.poll(async () => (await readOverlayState(page)).open).toBe(true);
    await expect
      .poll(() =>
        page
          .frameLocator('#arcline-overlay-host iframe[title="Arcline Sidebar"]')
          .locator('main.arcline-scroll')
          .evaluate((el) => el.scrollTop),
      )
      .toBeGreaterThanOrEqual(savedScrollTop - 20);

    // Switch to tabB -> tabB auto-opens with preserved scrollTop AND background tabA unloads iframe
    const tabB = await arcline.context.newPage();
    await tabB.goto(`${arcline.serverUrl}/page/gamma`);
    await arcline.worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const gamma = tabs.find((t) => t.url?.includes('/page/gamma'));
      if (gamma?.id !== undefined) {
        await chrome.tabs.update(gamma.id, { active: true });
      }
    });
    await tabB.bringToFront();

    await expect.poll(async () => (await readOverlayState(tabB)).open).toBe(true);
    await expect
      .poll(() =>
        tabB
          .frameLocator('#arcline-overlay-host iframe[title="Arcline Sidebar"]')
          .locator('main.arcline-scroll')
          .evaluate((el) => el.scrollTop),
      )
      .toBeGreaterThanOrEqual(savedScrollTop - 20);
    await expect
      .poll(async () => (await readOverlayState(page)).iframeHasSrc, { timeout: 5_000 })
      .toBe(false);

    // Explicit close stays closed across next navigation
    await tabB.waitForTimeout(420);
    await tabB.mouse.move(700, 300);
    await expect.poll(async () => (await readOverlayState(tabB)).open).toBe(false);
    await tabB.goto(`${arcline.serverUrl}/page/delta`);
    await expect.poll(async () => (await readOverlayState(tabB)).hostPresent).toBe(true);
    await tabB.waitForTimeout(200);
    expect((await readOverlayState(tabB)).open).toBe(false);

    // 4. Opt-in Arc-style Ctrl+Tab MRU switcher: hold Ctrl+Tab to preview, release Ctrl to switch
    await arcline.setSettings({ ctrlTabSwitcher: true });
    await tabB.waitForTimeout(80);
    await tabB.keyboard.down('Control');
    await tabB.keyboard.press('Tab');
    const switcher = tabB.locator('#arcline-overlay-host [data-arcline-tab-switcher]');
    await expect(switcher).toHaveClass(/open/, { timeout: 5_000 });
    await expect(switcher.locator('[role="option"]')).toHaveCount(3);
    await expect(switcher.locator('[role="option"][aria-selected="true"]')).toHaveCount(1);
    await tabB.keyboard.up('Control');
    await expect(switcher).not.toHaveClass(/open/);
    await expect
      .poll(async () =>
        arcline.worker.evaluate(async () => {
          const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          return t?.url ?? '';
        }),
      )
      .toContain('/page/beta');
  });
});
