import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const currentDir = dirname(fileURLToPath(import.meta.url));
const headlessEnv = process.env.PLAYWRIGHT_HEADLESS;
const headless = headlessEnv ? headlessEnv !== '0' : true;

export default defineConfig({
  testDir: join(currentDir, 'e2e'),
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: join(currentDir, '../playwright-report'),
        open: 'never',
      },
    ],
  ],
  use: {
    headless,
    viewport: { width: 1280, height: 800 },
    trace: process.env.CI ? 'retain-on-failure' : 'on',
    testIdAttribute: 'data-testid',
    video: 'off',
  },
});
