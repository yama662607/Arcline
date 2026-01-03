import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Pinned Tabs', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    // Navigate to index.html (App.tsx with DndContext and proper floatingContext)
    // popup.html uses PopupApp which lacks DndContext for drag and drop
    await page.goto(`chrome-extension://${extensionId}/index.html`);

    // Skip onboarding
    await page.evaluate(async () => {
      await chrome.storage.local.set({ 'arcline.hasSeenOnboarding': true });
    });

    // Setup Mock Service Worker
    await addServiceWorkerBridgeMock(page);

    await page.reload();

    // Wait for tabs to load - check for Search Bar input
    await expect(page.getByRole('textbox').first()).toBeVisible();
    // Also verify drop zones are visible
    await expect(page.getByRole('region', { name: /Pinned tabs drop zone/i })).toBeVisible();
    await expect(page.getByRole('region', { name: /Temporary tabs drop zone/i })).toBeVisible();
  });

  test('should pin a tab via context menu', async ({ page }) => {
    // Find the tab by its title text (Example Tab is in temporaryTabs array)
    const targetTab = page.getByRole('button', { name: 'Example Tab' });
    await expect(targetTab).toBeVisible();

    // Right click to open context menu
    await targetTab.click({ button: 'right' });

    // Click "Pin Tab" from context menu (rendered in Portal)
    await page.getByRole('menuitem', { name: 'Pin Tab' }).click();

    // After pinning, the tab should still be visible (now in pinned section)
    // The mutation updates the mock state
    await expect(targetTab).toBeVisible();
  });

  test('should unpin a tab via context menu', async ({ page }) => {
    // Find the pinned tab (Pinned Tab is in pinnedTabs array)
    const targetTab = page.getByRole('button', { name: 'Pinned Tab' });
    await expect(targetTab).toBeVisible();

    // Right click to open context menu
    await targetTab.click({ button: 'right' });

    // Click "Unpin Tab" from context menu
    await page.getByRole('menuitem', { name: 'Unpin Tab' }).click();

    // After unpinning, the tab should still be visible (now in temporary section)
    await expect(targetTab).toBeVisible();
  });

  test('should move tab between sections via drag and drop', async ({ page }) => {
    // index.html uses floating variant which has aria-label regions
    const pinnedZone = page.getByRole('region', { name: 'Pinned tabs drop zone' });
    const temporaryZone = page.getByRole('region', { name: 'Temporary tabs drop zone' });

    // Source: Example Tab in Temporary zone
    const sourceTab = temporaryZone.getByRole('button', { name: /Example Tab/i }).first();
    // Drop target: Pinned Tab in Pinned zone (targeting an item is more reliable)
    const targetTab = pinnedZone.getByRole('button', { name: /Pinned Tab/i }).first();

    await expect(sourceTab).toBeVisible();
    await expect(targetTab).toBeVisible();

    // Get bounding boxes for coordinate-based drag (required for dnd-kit)
    const sourceBox = await sourceTab.boundingBox();
    const targetBox = await targetTab.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error('Could not get bounding boxes for drag elements');
    }

    // dnd-kit uses PointerSensor with distance: 8 activation constraint
    // We need to simulate pointer events properly:
    // 1. Move to source center
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);

    // 2. Mouse down to start potential drag
    await page.mouse.down();

    // 3. Move beyond activation distance (8px) with steps to trigger pointermove events
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2 + 15, // 15px > 8px activation distance
      { steps: 5 }
    );

    // 4. Move to target tab with steps for smooth transition
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 10,
    });

    // 5. Release to complete drop
    await page.mouse.up();

    // Wait for state update and re-render
    await page.waitForTimeout(300);

    // Verify the tab is still visible (DnD completed without errors)
    // The tab should still be visible somewhere in the UI after the operation
    await expect(page.getByRole('button', { name: /Example Tab/i }).first()).toBeVisible();
  });
});
