import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Favorites Management', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    // Navigate to popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Skip onboarding
    await page.evaluate(async () => {
      await chrome.storage.local.set({ 'arcline.hasSeenOnboarding': true });
    });

    // Setup Mock Service Worker
    await addServiceWorkerBridgeMock(page);

    await page.reload();
  });

  test.fixme('should add a tab to favorites via drag and drop', async ({ page }) => {
    // Verify initial state: 1 favorite (from mock)
    const favoritesBar = page.getByRole('region', { name: 'Favorites drop zone' });
    await expect(favoritesBar).toBeVisible();

    // Mock default favorite is "Favorite Site"
    await expect(page.getByRole('button', { name: 'Favorite Site' })).toBeVisible();

    // Enable console logs
    page.on('console', (msg) => console.log(`PAGE LOG: ${msg.text()}`));

    // Find a tab to drag (Example Tab) in Temporary list
    // Use more specific selector to avoid ambiguity
    const sourceTab = page.getByRole('button', { name: 'Example Tab' }).first();
    await expect(sourceTab).toBeVisible();

    // Perform Drag and Drop (Coordinate-based)
    const sourceBox = await sourceTab.boundingBox();
    const targetBox = await favoritesBar.boundingBox();

    if (sourceBox && targetBox) {
      // Start at source center
      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(200);

      // Move slightly to trigger activation
      await page.mouse.move(
        sourceBox.x + sourceBox.width / 2,
        sourceBox.y + sourceBox.height / 2 + 15
      );
      await page.waitForTimeout(100);

      // Move to target center with steps
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
        steps: 10,
      });
      await page.waitForTimeout(200);

      await page.mouse.up();
    }

    // Verify "Example Tab" is added to Favorites BAR specifically
    await expect(favoritesBar.getByRole('button', { name: 'Example Tab' })).toBeVisible();

    // Check favorites count logic implicitly by finding item
  });

  test('should remove a favorite', async ({ page }) => {
    // Verify initial state
    await expect(page.getByRole('button', { name: 'Favorite Site' })).toBeVisible();

    // Hover over the favorite
    const favoriteItem = page.getByRole('button', { name: 'Favorite Site' });
    await favoriteItem.hover();

    // Click remove button
    const removeButton = page.getByTitle('Remove from favorites');
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // Verify it disappears
    await expect(favoriteItem).not.toBeVisible();
  });
});
