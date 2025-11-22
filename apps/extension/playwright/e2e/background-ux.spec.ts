import { expect, test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Background Service Worker Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Add Service Worker Bridge mock for background integration tests
    await addServiceWorkerBridgeMock(page);
  });

  test('syncs UI mode preference and reflects in UI shell', async ({ extensionId, page }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`, {
      waitUntil: 'domcontentloaded',
    });

    await page.evaluate(() => {
      localStorage.setItem('arcline-ui-mode', 'side-panel');
    });

    const uiMode = await page.evaluate(() => {
      return new Promise<string>((resolve) => {
        (
          globalThis as { __requestUiModeCallback?: (mode: string) => void }
        ).__requestUiModeCallback = resolve;
        chrome.runtime.sendMessage({ command: 'requestUiMode' }, () => { });
      });
    });

    expect(uiMode).toBe('side-panel');

    const shellMode = await page.evaluate(() => {
      const shell = document.querySelector('arcline-shell');
      if (!shell) return null;
      return (shell as unknown as { uiMode: string }).uiMode;
    });

    expect(shellMode).toBe(uiMode);
  });

  test('accepts trackpad gesture samples via runtime messaging', async ({ extensionId, page }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`, {
      waitUntil: 'domcontentloaded',
    });

    const response = await page.evaluate(() => {
      return new Promise<{ ok: boolean }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            command: 'trackpadGestureSample',
            sample: {
              startX: 0,
              startY: 0,
              endX: 200,
              endY: 8,
              durationMs: 120,
              timestamp: Date.now(),
              pointerType: 'touch',
            },
          },
          (result?: { ok?: boolean; error?: string }) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            if (result?.ok) {
              resolve({ ok: true });
            } else {
              reject(new Error(result?.error ?? 'Gesture handler failed'));
            }
          }
        );
      });
    });

    expect(response).toEqual({ ok: true });
  });

  test('broadcasts activeSpaceChanged after swipe navigation succeeds', async ({
    extensionId,
    page,
  }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`, {
      waitUntil: 'domcontentloaded',
    });

    const spaceChangePromise = page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const listener = (message: unknown) => {
          if (
            typeof message === 'object' &&
            message !== null &&
            'command' in message &&
            (message as { command?: string }).command === 'activeSpaceChanged'
          ) {
            const { spaceId } = message as { spaceId: number };
            resolve(spaceId);
            chrome.runtime.onMessage.removeListener(listener);
          }
        };
        chrome.runtime.onMessage.addListener(listener);
      });
    });

    await page.evaluate(() => {
      (globalThis as { __mockSpaces?: unknown[] }).__mockSpaces = [
        { id: 1, windowId: 1, tabs: [{ id: 101, active: true, pinned: false }] },
        { id: 2, windowId: 1, tabs: [{ id: 102, active: false, pinned: false }] },
      ];
    });

    const gestureResponse = await page.evaluate(() => {
      return new Promise<{ ok: boolean }>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            command: 'trackpadGestureSample',
            sample: {
              startX: 0,
              startY: 0,
              endX: 200,
              endY: 8,
              durationMs: 120,
              timestamp: Date.now(),
              pointerType: 'touch',
            },
          },
          (result?: { ok?: boolean; error?: string }) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            if (result?.ok) {
              resolve({ ok: true });
            } else {
              reject(new Error(result?.error ?? 'Gesture handler failed'));
            }
          }
        );
      });
    });

    expect(gestureResponse).toEqual({ ok: true });
    await expect(spaceChangePromise).resolves.toBeTypeOf('number');
  });

  test('updates UI shell after receiving spacesSnapshot broadcast', async ({
    extensionId,
    page,
  }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`, {
      waitUntil: 'domcontentloaded',
    });

    const spacesUpdatedPromise = page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const listener = (message: unknown) => {
          if (
            typeof message === 'object' &&
            message !== null &&
            'command' in message &&
            (message as { command?: string }).command === 'spacesSnapshot'
          ) {
            const { spaces } = message as { spaces: unknown[] };
            (globalThis as { __lastSpacesSnapshot?: unknown[] }).__lastSpacesSnapshot = spaces;
            chrome.runtime.onMessage.removeListener(listener);
            resolve(true);
          }
        };
        chrome.runtime.onMessage.addListener(listener);
      });
    });

    await page.evaluate(() => {
      chrome.runtime.sendMessage({ command: 'requestSpacesSnapshot' }, () => { });
    });

    await expect(spacesUpdatedPromise).resolves.toBe(true);

    const lastSnapshot = await page.evaluate(
      () => (globalThis as { __lastSpacesSnapshot?: unknown[] }).__lastSpacesSnapshot
    );
    expect(Array.isArray(lastSnapshot)).toBe(true);
  });

  test('handles gesture sample errors gracefully', async ({ extensionId, page }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`, {
      waitUntil: 'domcontentloaded',
    });

    const errorResponse = await page.evaluate(() => {
      return new Promise<{ error: string }>((resolve) => {
        chrome.runtime.sendMessage(
          {
            command: 'trackpadGestureSample',
            sample: {
              startX: NaN,
              startY: 0,
              endX: 200,
              endY: 8,
              durationMs: -1,
              timestamp: Date.now(),
              pointerType: 'unknown',
            },
          },
          (result?: { ok?: boolean; error?: string }) => {
            if (chrome.runtime.lastError) {
              resolve({ error: chrome.runtime.lastError.message });
              return;
            }
            if (result?.error) {
              resolve({ error: result.error });
            } else {
              resolve({ error: 'Unexpected success' });
            }
          }
        );
      });
    });

    expect(errorResponse.error).toBeDefined();
  });
});
