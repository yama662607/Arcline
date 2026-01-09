import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { addServiceWorkerBridgeMock, bypassOnboarding } from '../fixtures/service-worker-mock';

test.describe('Context Menu', () => {
  test('should remove a space via context menu', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await bypassOnboarding(page);

    // Navigate to spaces tab
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Create a new space to remove
    await page.getByRole('button', { name: /\+ New/i }).click();
    await page.getByPlaceholder('Space name').fill('Space to Remove');
    await page.getByRole('button', { name: /Create/i }).click();

    // Verify it exists
    const spaceItem = page.locator('div[role="button"]', { hasText: 'Space to Remove' });
    await expect(spaceItem).toBeVisible();

    // Right click on the space
    await spaceItem.click({ button: 'right' });

    // Expect context menu to appear (menu item is now "Delete Space")
    const removeOption = page.getByRole('menuitem', { name: /Delete Space/i });
    await expect(removeOption).toBeVisible();

    // Click remove
    await removeOption.click();

    // Verify it is gone
    await expect(page.getByText('Space to Remove')).not.toBeVisible();
  });

  test('should show context menu on right-click of space', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await bypassOnboarding(page);

    await page.getByRole('button', { name: /Spaces/i }).click();

    // Default Space should be visible from mock
    const defaultSpace = page.locator('div[role="button"]', { hasText: 'Default Space' });
    await expect(defaultSpace).toBeVisible();

    // Right click to open context menu
    await defaultSpace.click({ button: 'right' });

    // Verify context menu appears with expected options
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Delete Space/i })).toBeVisible();
  });
});

test.describe('Tab Context Menu in Index', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`);

    await page.evaluate(async () => {
      await chrome.storage.local.set({ 'arcline.hasSeenOnboarding': true });
    });

    await addServiceWorkerBridgeMock(page);
    await page.reload();

    await expect(page.getByRole('textbox').first()).toBeVisible();
  });

  test('should show pin/unpin options in tab context menu', async ({ page }) => {
    // Find a tab to right-click
    const exampleTab = page.getByRole('button', { name: 'Example Tab' });
    await expect(exampleTab).toBeVisible();

    // Right click to open context menu
    await exampleTab.click({ button: 'right' });

    // Verify Pin Tab option is visible
    const pinOption = page.getByRole('menuitem', { name: /Pin Tab/i });
    await expect(pinOption).toBeVisible();
  });

  test('should show unpin option for pinned tabs', async ({ page }) => {
    // Find a pinned tab
    const pinnedTab = page.getByRole('button', { name: 'Pinned Tab' });
    await expect(pinnedTab).toBeVisible();

    // Right click to open context menu
    await pinnedTab.click({ button: 'right' });

    // Verify Unpin Tab option is visible
    const unpinOption = page.getByRole('menuitem', { name: /Unpin Tab/i });
    await expect(unpinOption).toBeVisible();
  });

  test('should close context menu on escape', async ({ page }) => {
    const exampleTab = page.getByRole('button', { name: 'Example Tab' });
    await expect(exampleTab).toBeVisible();

    // Open context menu
    await exampleTab.click({ button: 'right' });

    // Verify menu is open
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify menu is closed
    await expect(menu).not.toBeVisible();
  });
});
