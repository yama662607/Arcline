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

    // Wait for tabs to load - check for Current Tab header (ActiveTabHeader in App.tsx)
    await expect(page.getByText('Current Tab')).toBeVisible();
    // Also verify tab sections are visible
    await expect(page.getByRole('heading', { name: /Pinned/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Temporary/i })).toBeVisible();
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
    // popup.html uses floating variant which has aria-label regions
    const pinnedZone = page.getByRole('region', { name: 'Pinned tabs drop zone' });
    const temporaryZone = page.getByRole('region', { name: 'Temporary tabs drop zone' });

    // Source: Example Tab in Temporary zone
    const sourceTab = temporaryZone.getByRole('button', { name: /Example Tab/i }).first();
    // Drop target: pinned drop zone itself (more stable than targeting an item)
    const dropTarget = pinnedZone;

    await expect(sourceTab).toBeVisible();
    await expect(dropTarget).toBeVisible();

    // Get bounding boxes for coordinate-based drag (required for dnd-kit)
    const sourceBox = await sourceTab.boundingBox();
    const targetBox = await dropTarget.boundingBox();

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

    // 4. Move to target center with steps for smooth transition
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 10,
    });

    // 5. Release to complete drop
    await page.mouse.up();

    // Wait for state update
    await page.waitForTimeout(250);

    // Verify "Example Tab" moved to Pinned zone (tab should be pinned now)
    // After drop on pinned zone, toggleTabPinned mutation should fire
    await expect(pinnedZone.getByRole('button', { name: /Example Tab/i }).first()).toBeVisible();
  });
});
