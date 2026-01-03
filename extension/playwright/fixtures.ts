import { type BrowserContext, test as base, type Page, type Worker } from '@playwright/test';
import {
  attachServiceWorkerLogging,
  ensureUiMode as ensureUiModeInStorage,
  getExtensionId,
  launchExtensionContext,
  type UiMode,
  waitForExtensionServiceWorker,
} from './fixtures/extension';

export const test = base.extend<{
  context: BrowserContext;
  page: Page;
  extensionId: string;
  serviceWorker: Worker;
  ensureUiMode: (mode?: UiMode) => Promise<void>;
  mockRequestUiMode: (mode: UiMode, reason: string) => Promise<void>;
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture API requires destructuring
  context: async ({}, use) => {
    const context = await launchExtensionContext();
    await use(context);
    await context.close();
  },
  page: async ({ context }, use, testInfo) => {
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    const onConsole = (message: import('@playwright/test').ConsoleMessage) => {
      if (message.type() !== 'error') {
        return;
      }
      const text = message.text();
      if (text.includes('Failed to load resource')) {
        return;
      }
      process.stderr.write(`[PAGE][${testInfo.testId}] CONSOLE_ERROR ${text}\n`);
      testInfo.annotations.push({
        type: 'page-console-error',
        description: text,
      });
    };

    const onPageError = (error: Error) => {
      process.stderr.write(
        `[PAGE][${testInfo.testId}] PAGE_ERROR ${error.stack ?? error.message}\n`
      );
      testInfo.annotations.push({
        type: 'page-error',
        description: error.stack ?? error.message,
      });
    };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    await use(page);
    if (!page.isClosed()) {
      await page.close();
    }

    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  },
  extensionId: async ({ context }, use) => {
    const id = await getExtensionId(context);
    await use(id);
  },
  serviceWorker: async ({ context }, use, testInfo) => {
    const worker = await waitForExtensionServiceWorker(context);
    const detach = attachServiceWorkerLogging(worker, testInfo.testId, (entry) => {
      testInfo.annotations.push({ type: 'service-worker-log', description: entry });
    });

    await use(worker);

    detach();
  },
  ensureUiMode: async ({ serviceWorker }, use) => {
    const setMode = async (mode: UiMode = 'floating') => {
      await ensureUiModeInStorage(serviceWorker, mode);
    };

    await use(setMode);
  },
  mockRequestUiMode: async ({ page }, use, testInfo) => {
    const applyMock = async (mode: UiMode, reason: string) => {
      const runWithAnnotation = async () => {
        testInfo.annotations.push({ type: 'api-mock', description: reason });
        await page.addInitScript(
          ({ desiredMode }) => {
            const global = window as typeof window & {
              __arclineRestoreRequestUiMode?: () => void;
            };
            let chromeObj = global.chrome as typeof chrome | undefined;
            if (!chromeObj) {
              chromeObj = {} as typeof chrome;
              global.chrome = chromeObj;
            }
            let runtime = chromeObj.runtime as typeof chrome.runtime | undefined;
            if (!runtime) {
              runtime = {} as typeof chrome.runtime;
              chromeObj.runtime = runtime;
            }
            const originalSendMessage = runtime.sendMessage?.bind(runtime);

            runtime.sendMessage = ((payload: unknown, ...rest: unknown[]) => {
              if (
                payload &&
                typeof payload === 'object' &&
                (payload as { command?: string }).command === 'requestUiMode'
              ) {
                const callback = rest.find((arg) => typeof arg === 'function') as
                  | ((response?: Record<string, unknown>) => void)
                  | undefined;
                callback?.({ command: 'currentUiMode', mode: desiredMode });
                return;
              }

              return originalSendMessage?.(payload as never, ...rest);
            }) as typeof chrome.runtime.sendMessage;

            global.__arclineRestoreRequestUiMode = () => {
              if (originalSendMessage) {
                runtime.sendMessage = originalSendMessage;
              } else {
                delete runtime.sendMessage;
              }
              delete global.__arclineRestoreRequestUiMode;
            };
          },
          { desiredMode: mode }
        );
      };

      await runWithAnnotation();
    };

    await use(applyMock);

    await page.evaluate(() => {
      const global = window as typeof window & {
        __arclineRestoreRequestUiMode?: () => void;
      };
      global.__arclineRestoreRequestUiMode?.();
    });
  },
});
