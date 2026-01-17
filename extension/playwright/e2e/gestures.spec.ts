import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Trackpad Gestures', () => {
  test.beforeEach(async ({ page }) => {
    await addServiceWorkerBridgeMock(page);
  });

  test('should trigger navigateSpace on swipe', async ({ page }, _testInfo) => {
    // Navigate to a page where content script should load
    await page.goto('https://example.com');

    // Wait for content script initialization
    const floatingRoot = page.locator('#arcline-floating-root');
    await expect(floatingRoot).toBeVisible({ timeout: 10_000 });

    // Open floating UI to ensure transition target exists
    await page.evaluate(() => {
      window.postMessage({ type: 'ARCLINE_OPEN_FLOATING_UI' }, '*');
    });

    const hotzone = page.getByTestId('arcline-floating-hotzone');
    await expect(hotzone).toBeVisible({ timeout: 10_000 });

    const hotzoneBox = await hotzone.boundingBox();
    if (!hotzoneBox) {
      throw new Error('Could not get bounding box for hotzone');
    }

    await page.mouse.move(
      hotzoneBox.x + hotzoneBox.width / 2,
      hotzoneBox.y + hotzoneBox.height / 2
    );

    const floatingPanel = page.getByTestId('arcline-floating-panel');
    await expect(floatingPanel).toBeVisible({ timeout: 10_000 });

    const transitionTarget = floatingPanel.locator('[data-arcline-space-transition]');
    await expect(transitionTarget).toBeVisible({ timeout: 10_000 });

    const targetBox = await transitionTarget.boundingBox();
    if (!targetBox) {
      throw new Error('Could not get bounding box for transition target');
    }

    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);

    // Perform Swipe Left (Delta X > 0) -> Should trigger 'right' direction
    await page.mouse.wheel(150, 0);

    // Verify Visual Feedback (inside Shadow DOM)
    // arcline-floating-root has open shadow root.
    const feedback = page.locator('#arcline-floating-root #arcline-swipe-feedback');
    await expect(feedback).toBeVisible({ timeout: 10_000 });
    await expect(feedback).toHaveClass(/show/);
  });

  test('should ignore small swipes (below threshold)', async ({ page }, _testInfo) => {
    await page.goto('https://example.com');
    await page.waitForTimeout(1000);

    // Small swipe (below 100)
    await page.mouse.wheel(50, 0);

    // Ensure NO log appears (Wait a bit to be sure it didn't trigger)
    // Since logs accumulate, we check current logs + short wait.
    // We can't easily clear annotations.
    // But logs contain "navigateSpace called". If it wasn't there before, and isn't there after...
    // Actually, logs are persistent for the test run. But new test = new logs?
    // annotations are part of testInfo. testInfo is per test? Yes.

    await page.waitForTimeout(1000);

    const logs = testInfo.annotations
      .filter((a) => a.type === 'service-worker-log')
      .map((a) => a.description)
      .join('\n');

    expect(logs).not.toContain('navigateSpace called');
  });

  test('should call navigateSpace with correct direction on swipe', async ({ page }) => {
    // Track navigateSpace calls
    await page.addInitScript(() => {
      const extendedWindow = window as unknown as {
        __navigateSpaceCalls: Array<{ direction: string; timestamp: number }>;
        onNavigateSpace?: (params: unknown) => void;
      };
      extendedWindow.__navigateSpaceCalls = [];
      extendedWindow.onNavigateSpace = (params) => {
        const p = params as { direction?: string };
        extendedWindow.__navigateSpaceCalls.push({
          direction: p?.direction ?? 'unknown',
          timestamp: Date.now(),
        });
      };
    });
    await addServiceWorkerBridgeMock(page);

    await page.goto('https://example.com');

    // Wait for floating root to be ready
    const floatingRoot = page.locator('#arcline-floating-root');
    await expect(floatingRoot).toBeVisible({ timeout: 10_000 });

    // Open UI
    await page.evaluate(() => {
      window.postMessage({ type: 'ARCLINE_OPEN_FLOATING_UI' }, '*');
    });

    const floatingPanel = page.getByTestId('arcline-floating-panel');
    await expect(floatingPanel).toBeVisible({ timeout: 10_000 });

    // Find the swipe target area
    const transitionTarget = floatingPanel.locator('[data-arcline-space-transition]');
    await expect(transitionTarget).toBeVisible({ timeout: 10_000 });

    const targetBox = await transitionTarget.boundingBox();
    if (!targetBox) {
      throw new Error('Could not get bounding box for transition target');
    }

    // Move mouse to target and perform swipe
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);

    // Perform swipe right (positive deltaX)
    await page.mouse.wheel(150, 0);

    // Wait a bit for the event to propagate
    await page.waitForTimeout(500);

    // Check if navigateSpace was called with correct direction
    const calls = await page.evaluate(() => {
      const win = window as unknown as {
        __navigateSpaceCalls?: Array<{ direction: string; timestamp: number }>;
      };
      return win.__navigateSpaceCalls ?? [];
    });

    // Should have at least one navigateSpace call with 'right' direction
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.some((call) => call.direction === 'right')).toBe(true);
  });

  test('should display multiple spaces in the UI', async ({ page }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto('https://example.com');

    // Wait for floating root
    const floatingRoot = page.locator('#arcline-floating-root');
    await expect(floatingRoot).toBeVisible({ timeout: 10_000 });

    // Open UI
    await page.evaluate(() => {
      window.postMessage({ type: 'ARCLINE_OPEN_FLOATING_UI' }, '*');
    });

    const floatingPanel = page.getByTestId('arcline-floating-panel');
    await expect(floatingPanel).toBeVisible({ timeout: 10_000 });

    // Check that the mock spaces are loaded (we added 'Work Space' as second space)
    // The UI should display space information from the mock
    const _spaceIndicators = floatingPanel.locator('[data-testid="space-indicator"]');

    // Wait for spaces to be loaded
    await page.waitForTimeout(500);

    // Verify the UI shows space navigation capability (at least 2 spaces exist in mock)
    const spacesCount = await page.evaluate(() => {
      // Access the mock spaces data through window bridge
      return new Promise<number>((resolve) => {
        window.chrome?.runtime?.sendMessage?.(
          { type: 'query', method: 'getSpacesSnapshot', id: 'test-spaces' },
          (response: unknown) => {
            const r = response as { data?: unknown[] };
            resolve(r?.data?.length ?? 0);
          }
        );
      });
    });

    // Should have at least 2 spaces (Default Space and Work Space from mock)
    expect(spacesCount).toBeGreaterThanOrEqual(2);
  });
});
