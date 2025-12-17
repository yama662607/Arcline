import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Onboarding', () => {
  test('should show onboarding on first run and persist completion', async ({
    page,
    extensionId,
  }) => {
    // Clear storage to force onboarding
    // Navigate to a page with extension context or execute on extension page
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.evaluate(async () => {
      await chrome.storage.local.remove('arcline.hasSeenOnboarding');
    });
    await page.reload();

    await addServiceWorkerBridgeMock(page, { skipOnboarding: false });
    // "addInitScript" persists for the page context so we call it after nav if needed, but usually before.
    // Here we check onboarding flow.

    // Check first slide
    await expect(page.getByText('Welcome to Arcline')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Second: Spaces & Tabs
    await expect(page.getByText('Spaces & Tabs')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Third: Auto Archive
    await expect(page.getByText('Auto Archive')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Fourth: Ready
    await expect(page.getByText('Ready to Go?')).toBeVisible();
    await page.getByRole('button', { name: 'Get Started' }).click();

    // Should verify we are home
    await expect(page.getByRole('heading', { name: 'Spaces', level: 1 })).toBeVisible();

    // Reload to verify persistence
    await page.reload();
    await expect(page.getByText('Welcome to Arcline')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Spaces', level: 1 })).toBeVisible();
  });
});
