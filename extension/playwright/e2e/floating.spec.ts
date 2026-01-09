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

  test('floating panel shows space information', async ({ page }) => {
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });

    const host = page.locator('#arcline-floating-root');
    await host.waitFor({ state: 'attached', timeout: 15_000 });

    // Open the floating UI
    await page.evaluate(() => {
      window.postMessage({ type: 'ARCLINE_OPEN_FLOATING_UI' }, '*');
    });

    const hotzone = page.getByTestId('arcline-floating-hotzone');
    await expect(hotzone).toBeVisible({ timeout: 15_000 });

    // Hover to trigger panel opening
    const hotzoneBox = await hotzone.boundingBox();
    if (hotzoneBox) {
      await page.mouse.move(
        hotzoneBox.x + hotzoneBox.width / 2,
        hotzoneBox.y + hotzoneBox.height / 2
      );
    }

    // Panel should become visible
    const floatingPanel = page.getByTestId('arcline-floating-panel');
    await expect(floatingPanel).toBeVisible({ timeout: 10_000 });
  });

  test('floating UI has swipe transition target', async ({ page }) => {
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });

    const host = page.locator('#arcline-floating-root');
    await host.waitFor({ state: 'attached', timeout: 15_000 });

    await page.evaluate(() => {
      window.postMessage({ type: 'ARCLINE_OPEN_FLOATING_UI' }, '*');
    });

    const hotzone = page.getByTestId('arcline-floating-hotzone');
    await expect(hotzone).toBeVisible({ timeout: 15_000 });

    // Hover to trigger panel
    const hotzoneBox = await hotzone.boundingBox();
    if (hotzoneBox) {
      await page.mouse.move(
        hotzoneBox.x + hotzoneBox.width / 2,
        hotzoneBox.y + hotzoneBox.height / 2
      );
    }

    const floatingPanel = page.getByTestId('arcline-floating-panel');
    await expect(floatingPanel).toBeVisible({ timeout: 10_000 });

    // Check for swipe transition target element
    const transitionTarget = floatingPanel.locator('[data-arcline-space-transition]');
    await expect(transitionTarget).toBeVisible({ timeout: 5_000 });
  });

  test('floating UI shows swipe feedback on wheel event', async ({ page }) => {
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });

    const host = page.locator('#arcline-floating-root');
    await host.waitFor({ state: 'attached', timeout: 15_000 });

    await page.evaluate(() => {
      window.postMessage({ type: 'ARCLINE_OPEN_FLOATING_UI' }, '*');
    });

    const hotzone = page.getByTestId('arcline-floating-hotzone');
    await expect(hotzone).toBeVisible({ timeout: 15_000 });

    // Hover to trigger panel
    const hotzoneBox = await hotzone.boundingBox();
    if (hotzoneBox) {
      await page.mouse.move(
        hotzoneBox.x + hotzoneBox.width / 2,
        hotzoneBox.y + hotzoneBox.height / 2
      );
    }

    const floatingPanel = page.getByTestId('arcline-floating-panel');
    await expect(floatingPanel).toBeVisible({ timeout: 10_000 });

    const transitionTarget = floatingPanel.locator('[data-arcline-space-transition]');
    await expect(transitionTarget).toBeVisible({ timeout: 5_000 });

    const targetBox = await transitionTarget.boundingBox();
    if (targetBox) {
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    }

    // Perform swipe gesture (wheel event)
    await page.mouse.wheel(150, 0);

    // Check for swipe feedback element
    const feedback = page.locator('#arcline-floating-root #arcline-swipe-feedback');
    await expect(feedback).toBeVisible({ timeout: 10_000 });
  });
});
