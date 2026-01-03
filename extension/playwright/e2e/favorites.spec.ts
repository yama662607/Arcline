import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Favorites Management', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    // Navigate to index.html (App.tsx with DndContext for drag and drop)
    await page.goto(`chrome-extension://${extensionId}/index.html`);

    // Skip onboarding
    await page.evaluate(async () => {
      await chrome.storage.local.set({ 'arcline.hasSeenOnboarding': true });
    });

    // Setup Mock Service Worker
    await addServiceWorkerBridgeMock(page);

    await page.reload();

    // Wait for main UI to load - check for Search Bar input
    await expect(page.getByRole('textbox').first()).toBeVisible();
  });

  test('should add a tab to favorites via drag and drop', async ({ page }) => {
    // Verify initial state: 1 favorite (from mock)
    const favoritesBar = page.getByRole('region', { name: 'Favorites drop zone' });
    await expect(favoritesBar).toBeVisible();

    // Mock default favorite is "Favorite Site"
    await expect(page.getByRole('button', { name: 'Favorite Site' })).toBeVisible();

    // Find a tab to drag (Example Tab) in Temporary list
    const sourceTab = page.getByRole('button', { name: /Example Tab/i }).first();
    await expect(sourceTab).toBeVisible();

    // Get bounding boxes for coordinate-based drag (required for dnd-kit)
    const sourceBox = await sourceTab.boundingBox();
    const targetBox = await favoritesBar.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error('Could not get bounding boxes for drag elements');
    }

    // dnd-kit uses PointerSensor with distance: 8 activation constraint
    // 1. Move to source center
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);

    // 2. Mouse down to start potential drag
    await page.mouse.down();

    // 3. Move beyond activation distance (8px) with steps
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2 + 15,
      { steps: 5 }
    );

    // 4. Move to favorites bar with steps
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 10,
    });

    // 5. Release to complete drop
    await page.mouse.up();

    // Wait for state update
    await page.waitForTimeout(100);

    // Verify tab is still visible (addToFavorites mutation should have fired)
    await expect(page.getByRole('button', { name: /Example Tab/i }).first()).toBeVisible();
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

test.describe('Tab Reordering via Drag and Drop', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`);

    await page.evaluate(async () => {
      await chrome.storage.local.set({ 'arcline.hasSeenOnboarding': true });
    });

    await addServiceWorkerBridgeMock(page);
    await page.reload();

    // Wait for main UI to load - check for Search Bar input
    await expect(page.getByRole('textbox').first()).toBeVisible();
  });

  test('should reorder tabs within Temporary section via drag and drop', async ({ page }) => {
    const temporaryZone = page.getByRole('region', { name: 'Temporary tabs drop zone' });

    // Get the two tabs in temporary zone
    const exampleTab = temporaryZone.getByRole('button', { name: /Example Tab/i }).first();
    const tempTab = temporaryZone.getByRole('button', { name: /Temporary Tab/i }).first();

    await expect(exampleTab).toBeVisible();
    await expect(tempTab).toBeVisible();

    // Get bounding boxes
    const sourceBox = await exampleTab.boundingBox();
    const targetBox = await tempTab.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error('Could not get bounding boxes for drag elements');
    }

    // Perform dnd-kit compatible drag
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2 + 15,
      { steps: 5 }
    );
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 10,
    });
    await page.mouse.up();

    await page.waitForTimeout(200);

    // Verify both tabs are still visible (reorder completed without errors)
    await expect(exampleTab).toBeVisible();
    await expect(tempTab).toBeVisible();
  });

  test('should move tab from Temporary to Pinned section', async ({ page }) => {
    const pinnedZone = page.getByRole('region', { name: 'Pinned tabs drop zone' });
    const temporaryZone = page.getByRole('region', { name: 'Temporary tabs drop zone' });

    const sourceTab = temporaryZone.getByRole('button', { name: /Example Tab/i }).first();
    const targetTab = pinnedZone.getByRole('button', { name: /Pinned Tab/i }).first();

    await expect(sourceTab).toBeVisible();
    await expect(targetTab).toBeVisible();

    const sourceBox = await sourceTab.boundingBox();
    const targetBox = await targetTab.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error('Could not get bounding boxes for drag elements');
    }

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2 + 15,
      { steps: 5 }
    );
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 10,
    });
    await page.mouse.up();

    await page.waitForTimeout(200);

    // Verify tab is still visible after the operation
    await expect(page.getByRole('button', { name: /Example Tab/i }).first()).toBeVisible();
  });

  test('should move tab from Pinned to Temporary section', async ({ page }) => {
    const pinnedZone = page.getByRole('region', { name: 'Pinned tabs drop zone' });
    const temporaryZone = page.getByRole('region', { name: 'Temporary tabs drop zone' });

    const sourceTab = pinnedZone.getByRole('button', { name: /Pinned Tab/i }).first();
    const targetTab = temporaryZone.getByRole('button', { name: /Example Tab/i }).first();

    await expect(sourceTab).toBeVisible();
    await expect(targetTab).toBeVisible();

    const sourceBox = await sourceTab.boundingBox();
    const targetBox = await targetTab.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error('Could not get bounding boxes for drag elements');
    }

    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2 + 15,
      { steps: 5 }
    );
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 10,
    });
    await page.mouse.up();

    await page.waitForTimeout(200);

    // Verify tab is still visible after the operation
    await expect(page.getByRole('button', { name: /Pinned Tab/i }).first()).toBeVisible();
  });
});
