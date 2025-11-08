import { expect, test } from '../fixtures';

test.describe('Floating UI integration', () => {
  test('hotzone hover opens floating panel', async ({ page }) => {
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });

    const host = page.locator('#arcline-floating-root');
    await host.waitFor({ state: 'attached', timeout: 15_000 });

    await page.evaluate(() => {
      window.postMessage({ type: 'ARCLINE_OPEN_FLOATING_UI' }, '*');
    });

    const hotzone = page.getByTestId('arcline-floating-hotzone');
    await expect(hotzone).toBeVisible({ timeout: 15_000 });

    await hotzone.hover();

    const panel = page.getByTestId('arcline-floating-panel');
    await expect(panel).toBeVisible({ timeout: 15_000 });
  });

  test('requestUiMode can be mocked when runtime messaging is unavailable', async ({
    page,
    mockRequestUiMode,
  }) => {
    await mockRequestUiMode('popup', 'Force popup mode to validate requestUiMode mock');
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });

    const reportedMode = await page.evaluate(async () => {
      return new Promise<string>((resolve) => {
        chrome.runtime.sendMessage(
          { command: 'requestUiMode' },
          (response: { mode?: string } | undefined) => resolve(response?.mode ?? 'unknown')
        );
      });
    });

    await expect(reportedMode).toBe('popup');
  });
});
