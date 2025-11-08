/// <reference types="chrome" />

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BrowserContext, type ConsoleMessage, chromium, type Worker } from '@playwright/test';

const currentDir = dirname(fileURLToPath(import.meta.url));
export const extensionDistPath = join(currentDir, '..', '..', 'dist');
export const EXTENSION_PROTOCOL = 'chrome-extension://';
export const UI_MODE_KEY = 'arclineoMode';
export const SERVICE_WORKER_TIMEOUT = 15_000;

export type UiMode = 'floating' | 'side-panel' | 'popup';

function assertBuildExists() {
  if (!existsSync(join(extensionDistPath, 'manifest.json'))) {
    throw new Error(
      'Chrome 拡張の dist/ が見つかりません。`pnpm build` を実行してから Playwright テストを起動してください。'
    );
  }
}

export async function launchExtensionContext(): Promise<BrowserContext> {
  assertBuildExists();
  const headlessEnv = process.env.PLAYWRIGHT_HEADLESS;
  const headless = headlessEnv ? headlessEnv !== '0' : true;
  return chromium.launchPersistentContext('', {
    headless,
    args: [
      `--disable-extensions-except=${extensionDistPath}`,
      `--load-extension=${extensionDistPath}`,
    ],
  });
}

export async function waitForExtensionServiceWorker(context: BrowserContext): Promise<Worker> {
  const existing = context
    .serviceWorkers()
    .find((worker) => worker.url().startsWith(EXTENSION_PROTOCOL));
  if (existing) {
    return existing;
  }

  const worker = await context
    .waitForEvent('serviceworker', { timeout: SERVICE_WORKER_TIMEOUT })
    .catch(() => undefined);
  if (worker?.url().startsWith(EXTENSION_PROTOCOL)) {
    return worker;
  }

  throw new Error(
    'Chrome 拡張の service worker を取得できませんでした。dist/ を再ビルドしてください。'
  );
}

export async function resolveExtensionId(context: BrowserContext): Promise<string> {
  const existingWorker = context
    .serviceWorkers()
    .find((worker) => worker.url().startsWith(EXTENSION_PROTOCOL));
  if (existingWorker) {
    return new URL(existingWorker.url()).host;
  }

  const page = context.pages()[0] ?? (await context.newPage());
  try {
    const session = await context.newCDPSession(page);
    const { targetInfos } = await session.send('Target.getTargets');
    const swTarget = targetInfos.find(
      (target) => target.type === 'service_worker' && target.url.startsWith(EXTENSION_PROTOCOL)
    );
    if (swTarget) {
      return new URL(swTarget.url).host;
    }
  } catch (error) {
    console.warn('[Playwright] Failed to derive extension ID from CDP targets', error);
  }

  const worker = await context
    .waitForEvent('serviceworker', { timeout: SERVICE_WORKER_TIMEOUT })
    .catch(() => undefined);
  if (worker?.url().startsWith(EXTENSION_PROTOCOL)) {
    return new URL(worker.url()).host;
  }

  throw new Error('Chrome 拡張の service worker が起動せず、拡張 ID を取得できませんでした。');
}

export function attachServiceWorkerLogging(
  worker: Worker,
  testInfoId: string,
  pushAnnotation: (entry: string) => void
) {
  const logToStream = (entry: string, level: 'info' | 'warn' | 'error') => {
    const stream = level === 'error' ? process.stderr : process.stdout;
    stream.write(`${entry}\n`);
  };

  const consoleListener = (message: ConsoleMessage) => {
    const entry = `[SW][${testInfoId}] ${message.type().toUpperCase()} ${message.text()}`;
    const type = message.type();
    if (type === 'error') {
      logToStream(entry, 'error');
    } else if (type === 'warning' || type === 'warn') {
      logToStream(entry, 'warn');
    } else {
      logToStream(entry, 'info');
    }
    pushAnnotation(entry);
  };

  const crashListener = () => {
    const entry = `[SW][${testInfoId}] CRASHED`;
    logToStream(entry, 'error');
    pushAnnotation(entry);
  };

  worker.on('console', consoleListener);
  worker.on('crash', crashListener);

  return () => {
    worker.off('console', consoleListener);
    worker.off('crash', crashListener);
  };
}

async function waitForStorageReady(worker: Worker) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const ready = await worker
      .evaluate(() => Boolean(globalThis.chrome?.storage?.local))
      .catch(() => false);
    if (ready) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error('chrome.storage.local の初期化を待機しましたが利用可能になりませんでした。');
}

export async function ensureUiMode(worker: Worker, mode: UiMode = 'floating') {
  await waitForStorageReady(worker);
  await worker.evaluate(
    async ({ key, value }) => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({ [key]: value });
    },
    { key: UI_MODE_KEY, value: mode }
  );
}
