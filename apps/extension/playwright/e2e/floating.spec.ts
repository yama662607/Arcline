import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Floating UI integration', () => {
  test.beforeEach(async ({ page }) => {
    await addServiceWorkerBridgeMock(page);
  });

  test('floating UI root is injected on external page', async ({ page }) => {
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });

    const host = page.locator('#arcline-floating-root');
    await host.waitFor({ state: 'attached', timeout: 15_000 });
    await expect(host).toBeAttached();
  });

  test('hotzone becomes visible after open message', async ({ page }) => {
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });

    const host = page.locator('#arcline-floating-root');
    await host.waitFor({ state: 'attached', timeout: 15_000 });

    await page.evaluate(() => {
      window.postMessage({ type: 'ARCLINE_OPEN_FLOATING_UI' }, '*');
    });

    const hotzone = page.getByTestId('arcline-floating-hotzone');
    await expect(hotzone).toBeVisible({ timeout: 15_000 });
  });
});
