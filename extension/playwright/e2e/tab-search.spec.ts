import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Tab Search (Command Palette)', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    // Navigate to index.html (App.tsx) which has CommandPalette
    // popup.html uses PopupApp which doesn't have CommandPalette
    await page.goto(`chrome-extension://${extensionId}/index.html`);

    // Skip onboarding
    await page.evaluate(async () => {
      await chrome.storage.local.set({ 'arcline.hasSeenOnboarding': true });
    });

    // Setup Mock Service Worker (needed for search bridge calls)
    await addServiceWorkerBridgeMock(page);

    await page.reload();

    // Wait for main UI to load - check for Search Bar input
    await expect(page.getByRole('textbox').first()).toBeVisible();
  });

  test('should open command palette with keyboard shortcut (Cmd+K)', async ({ page }) => {
    // Ensure focus on page body
    await page.locator('body').click();

    // Initially not visible
    const palette = page.getByRole('dialog', { name: 'Command Menu' });
    await expect(palette).not.toBeVisible();

    // Press Cmd+K (Meta on Mac)
    await page.keyboard.press('Meta+k');

    // Should be visible
    await expect(palette).toBeVisible();

    // Should focus input
    const input = page.getByPlaceholder('Search tabs, bookmarks, history...');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test('should search and display results', async ({ page }) => {
    // Open command palette via keyboard shortcut (Cmd+K)
    await page.locator('body').click();
    await page.keyboard.press('Meta+k');

    // Verify palette opened
    const input = page.getByPlaceholder('Search tabs, bookmarks, history...');
    await expect(input).toBeVisible();

    // Type search query
    await input.fill('Example');

    // Wait for search results - "Example Tab" is in mock data
    await expect(page.getByText('Example Tab').first()).toBeVisible();

    // Ensure "No results found" is NOT visible
    await expect(page.getByText('No results found.')).not.toBeVisible();
  });

  test('should close on Escape', async ({ page }) => {
    // Focus the page and open palette
    await page.locator('body').click();
    await page.keyboard.press('Meta+k');

    const dialog = page.getByRole('dialog', { name: 'Command Menu' });
    await expect(dialog).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
