import { expect } from '@playwright/test';
import { test } from '../fixtures';

test.describe('Trackpad Gestures', () => {
  // biome-ignore lint/correctness/noUnusedFunctionParameters: serviceWorker required by test fixture
  test('should trigger navigateSpace on swipe', async ({ page, serviceWorker }, _testInfo) => {
    // Navigate to a page where content script should load
    await page.goto('https://example.com');

    // Wait for content script initialization
    await page.waitForTimeout(1000);

    // Perform Swipe Left (Delta X > 0) -> Should trigger 'right' direction
    await page.mouse.wheel(150, 0);

    // Verify Visual Feedback (inside Shadow DOM)
    // arcline-floating-root has open shadow root.
    const feedback = page.locator('#arcline-floating-root #arcline-swipe-feedback');
    await expect(feedback).toBeVisible({ timeout: 10_000 });
    await expect(feedback).toHaveClass(/show/);
  });

  test('should ignore small swipes (below threshold)', async ({ page }, testInfo) => {
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
});
