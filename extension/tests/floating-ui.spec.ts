import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { buildSync } from 'esbuild';

const currentDir = dirname(fileURLToPath(import.meta.url));

const bundle =
  buildSync({
    entryPoints: [resolve(currentDir, './fixtures/floating-test-entry.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    write: false,
    loader: {
      '.css': 'text',
    },
    define: {
      'process.env.NODE_ENV': '"test"',
      'import.meta.env.DEV': 'false',
      'import.meta.env.PROD': 'true',
      'import.meta.env.MODE': '"test"',
    },
  }).outputFiles[0]?.text ?? '';

// Helper to set up Chrome API mocks
async function setupChromeMocks(page: Page) {
  await page.addInitScript(() => {
    const listeners: Array<(message: unknown, sender: unknown, sendResponse: () => void) => void> =
      [];
    const runtime = {
      onMessage: {
        addListener(
          handler: (message: unknown, sender: unknown, sendResponse: () => void) => void
        ) {
          listeners.push(handler);
        },
        removeListener(
          handler: (message: unknown, sender: unknown, sendResponse: () => void) => void
        ) {
          const index = listeners.indexOf(handler);
          if (index >= 0) {
            listeners.splice(index, 1);
          }
        },
      },
      sendMessage: (
        payload: { command?: string },
        callback?: (response?: Record<string, unknown>) => void
      ) => {
        const respond = (response?: Record<string, unknown>) => {
          if (typeof callback === 'function') {
            callback(response);
          }
        };

        if (payload.command === 'requestUiMode') {
          setTimeout(() => respond({ mode: 'floating' }), 0);
          return;
        }

        if (payload.command === 'requestSpacesSnapshot') {
          setTimeout(
            () =>
              respond({
                command: 'spacesSnapshot',
                spaces: [
                  {
                    id: 1,
                    name: 'Workspace',
                    color: '#6366f1',
                    pinnedTabs: [
                      { id: 11, title: 'Pinned tab', url: 'https://example.com', pinned: true },
                    ],
                    temporaryTabs: [{ id: 21, title: 'Docs', url: 'https://developer.chrome.com' }],
                  },
                ],
              }),
            0
          );
          return;
        }

        setTimeout(() => respond({ ok: true }), 0);
      },
    } as const;

    Object.defineProperty(runtime, 'lastError', {
      configurable: true,
      enumerable: true,
      get() {
        return undefined;
      },
    });

    const storage = {
      local: {
        async get() {
          return {};
        },
        async set() {
          return {};
        },
        async remove() {
          return {};
        },
      },
    };

    (window as unknown as { chrome: unknown }).chrome = { runtime, storage };
  });
}

// Helper to read panel open state
function createPanelOpenReader(page: Page) {
  return () =>
    page.evaluate(() => {
      const host = document.querySelector('[data-testid="arcline-floating-host"]');
      const panel = host?.shadowRoot?.querySelector(
        '[data-testid="arcline-floating-panel"]'
      ) as HTMLElement | null;
      if (!panel) {
        return false;
      }

      const style = window.getComputedStyle(panel);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }

      return Number.parseFloat(style.opacity) > 0.01;
    });
}

// Helper to bootstrap floating UI for tests
async function bootstrapFloatingUi(page: Page) {
  await page.setContent('<main data-testid="surface" style="height:100vh;">Atlas Sandbox</main>');
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() =>
    (
      window as unknown as { bootstrapFloatingUiForTest: () => Promise<void> }
    ).bootstrapFloatingUiForTest()
  );
}

// Helper to get hotzone element in shadow DOM
async function getHotzoneBox(page: Page) {
  return page.evaluate(() => {
    const host = document.querySelector('[data-testid="arcline-floating-host"]');
    const hotzone = host?.shadowRoot?.querySelector('[data-testid="arcline-floating-hotzone"]');
    if (!hotzone) return null;
    const rect = hotzone.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

test.describe('Floating UI Panel Control', () => {
  test('panel reveals and hides via API', async ({ page }) => {
    await setupChromeMocks(page);
    await bootstrapFloatingUi(page);

    const readPanelOpen = createPanelOpenReader(page);

    await expect.poll(readPanelOpen, { message: 'panel should start hidden' }).toBe(false);

    await page.evaluate(() => {
      (
        window as unknown as { __arclineFloatingInstance?: { openFromHover: () => void } }
      ).__arclineFloatingInstance?.openFromHover();
    });

    await expect
      .poll(readPanelOpen, { timeout: 2000, message: 'panel should open after hover' })
      .toBe(true);

    await page.evaluate(() => {
      (
        window as unknown as { __arclineFloatingInstance?: { destroy: () => void } }
      ).__arclineFloatingInstance?.destroy();
    });

    await expect
      .poll(readPanelOpen, { timeout: 1500, message: 'panel should close after teardown' })
      .toBe(false);
  });
});

test.describe('Hotzone Mouse Hover Activation', () => {
  test('panel opens when mouse hovers over hotzone', async ({ page }) => {
    await setupChromeMocks(page);
    await bootstrapFloatingUi(page);

    const readPanelOpen = createPanelOpenReader(page);
    await expect.poll(readPanelOpen, { message: 'panel should start hidden' }).toBe(false);

    // Get hotzone position
    const hotzoneBox = await getHotzoneBox(page);
    expect(hotzoneBox).not.toBeNull();

    // Move mouse to hotzone center
    const centerX = hotzoneBox!.x + hotzoneBox!.width / 2;
    const centerY = hotzoneBox!.y + hotzoneBox!.height / 2;
    await page.mouse.move(centerX, centerY);

    // Trigger pointerenter by dispatching event
    await page.evaluate(() => {
      const host = document.querySelector('[data-testid="arcline-floating-host"]');
      const hotzone = host?.shadowRoot?.querySelector('[data-testid="arcline-floating-hotzone"]');
      if (hotzone) {
        hotzone.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
      }
    });

    await expect
      .poll(readPanelOpen, { timeout: 2000, message: 'panel should open after hotzone hover' })
      .toBe(true);
  });

  test('panel does not open when mouse stays outside hotzone', async ({ page }) => {
    await setupChromeMocks(page);
    await bootstrapFloatingUi(page);

    const readPanelOpen = createPanelOpenReader(page);
    await expect.poll(readPanelOpen, { message: 'panel should start hidden' }).toBe(false);

    // Move mouse around but stay outside hotzone (x > 8px)
    await page.mouse.move(100, 300);
    await page.mouse.move(200, 400);
    await page.mouse.move(150, 200);

    // Wait a bit
    await page.waitForTimeout(500);

    await expect.poll(readPanelOpen, { message: 'panel should remain hidden' }).toBe(false);
  });
});

test.describe('Hotzone Click Activation', () => {
  test('clicking hotzone toggles pin state', async ({ page }) => {
    await setupChromeMocks(page);
    await bootstrapFloatingUi(page);

    const readPanelOpen = createPanelOpenReader(page);
    await expect.poll(readPanelOpen, { message: 'panel should start hidden' }).toBe(false);

    // Click on hotzone to pin
    await page.evaluate(() => {
      const host = document.querySelector('[data-testid="arcline-floating-host"]');
      const hotzone = host?.shadowRoot?.querySelector(
        '[data-testid="arcline-floating-hotzone"]'
      ) as HTMLElement;
      if (hotzone) {
        hotzone.click();
      }
    });

    await expect
      .poll(readPanelOpen, { timeout: 2000, message: 'panel should open after click' })
      .toBe(true);

    // Check pinned state via aria-pressed
    const isPinned = await page.evaluate(() => {
      const host = document.querySelector('[data-testid="arcline-floating-host"]');
      const hotzone = host?.shadowRoot?.querySelector('[data-testid="arcline-floating-hotzone"]');
      return hotzone?.getAttribute('aria-pressed') === 'true';
    });
    expect(isPinned).toBe(true);
  });
});
