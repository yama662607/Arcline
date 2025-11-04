import { test, expect } from '@playwright/test';
import { buildSync } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

const bundle = buildSync({
  entryPoints: [resolve(currentDir, './fixtures/floating-test-entry.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  write: false,
  loader: {
    '.css': 'text'
  },
  define: {
    'process.env.NODE_ENV': '"test"'
  }
}).outputFiles[0]?.text ?? '';

test('floating UI hotzone reveals and hides panel', async ({ page }) => {
  await page.addInitScript(() => {
    const listeners: Array<(message: unknown, sender: unknown, sendResponse: () => void) => void> = [];
    const runtime = {
      onMessage: {
        addListener(handler: (message: unknown, sender: unknown, sendResponse: () => void) => void) {
          listeners.push(handler);
        },
        removeListener(handler: (message: unknown, sender: unknown, sendResponse: () => void) => void) {
          const index = listeners.indexOf(handler);
          if (index >= 0) {
            listeners.splice(index, 1);
          }
        }
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
                      { id: 11, title: 'Pinned tab', url: 'https://example.com', pinned: true }
                    ],
                    temporaryTabs: [
                      { id: 21, title: 'Docs', url: 'https://developer.chrome.com' }
                    ]
                  }
                ]
              }),
            0
          );
          return;
        }

        setTimeout(() => respond({ ok: true }), 0);
      }
    } as const;

    Object.defineProperty(runtime, 'lastError', {
      configurable: true,
      enumerable: true,
      get() {
        return undefined;
      }
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
        }
      }
    };

    (window as unknown as { chrome: unknown }).chrome = { runtime, storage };

    (window as any).__dispatchRuntimeMessage = (message: unknown) => {
      listeners.forEach((listener) => {
        try {
          listener(message, {}, () => {});
        } catch (error) {
          console.error(error);
        }
      });
    };
  });

  await page.setContent('<main data-testid="surface" style="height:100vh;">Atlas Sandbox</main>');
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => window.bootstrapFloatingUiForTest());

  const readPanelOpen = () =>
    page.evaluate(() => {
      const host = document.querySelector('[data-testid="arcline-floating-host"]');
      const panel = host?.shadowRoot?.querySelector('[data-testid="arcline-floating-panel"]') as HTMLElement | null;
      if (!panel) {
        return false;
      }

      const style = window.getComputedStyle(panel);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }

      return Number.parseFloat(style.opacity) > 0.01;
    });

  await expect.poll(readPanelOpen, { message: 'panel should start hidden' }).toBe(false);

  await page.evaluate(() => {
    window.__arclineFloatingInstance?.openFromHover();
  });

  await expect.poll(readPanelOpen, { timeout: 2000, message: 'panel should open after hover' }).toBe(true);

  await page.evaluate(() => {
    window.__arclineFloatingInstance?.destroy();
  });

  await expect.poll(readPanelOpen, { timeout: 1500, message: 'panel should close after teardown' }).toBe(false);
});
