import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Pinned Tabs', () => {
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

        // Wait for tabs to load (Temporary list)
        // Note: EnhancedTabList renders title uppercase in DOM? No, just text.
        // EnhancedTabList logic: <h3>{title} ({tabs.length})</h3>
        // Title passed: "Temporary".
        // Expect "Temporary (2)" if 2 items.
        // Or just wait for a button.
        await expect(page.getByRole('button', { name: 'Example Tab' })).toBeVisible();
    });

    test.fixme('should pin a tab via context menu', async ({ page }) => {
        const temporaryZone = page.getByRole('region', { name: 'Temporary tabs drop zone' });
        const pinnedZone = page.getByRole('region', { name: 'Pinned tabs drop zone' });

        // Initial state: Pinned has 1 ("Pinned Tab"), Temp has 2 ("Example Tab", "Temporary Tab")
        // Note: Mock data might vary. Checking based on standard mock.
        // Mock Pinned: 201 "Pinned Tab".
        // Mock Temp: 101 "Example Tab", 301 "Temporary Tab".

        const targetTab = temporaryZone.getByRole('button', { name: 'Example Tab' });
        await expect(targetTab).toBeVisible();

        // Right click to open context menu
        await targetTab.click({ button: 'right' });

        // Click "Pin Tab"
        // Context menu is rendered in a Portal, usually at root.
        await page.getByRole('menuitem', { name: 'Pin Tab' }).click();

        // Verify: Pinned zone should now contain "Example Tab"
        await expect(pinnedZone.getByRole('button', { name: 'Example Tab' })).toBeVisible();

        // Verify: Temporary zone should NOT contain "Example Tab"
        await expect(temporaryZone.getByRole('button', { name: 'Example Tab' })).not.toBeVisible();
    });

    test.fixme('should unpin a tab via context menu', async ({ page }) => {
        const pinnedZone = page.getByRole('region', { name: 'Pinned tabs drop zone' });
        const temporaryZone = page.getByRole('region', { name: 'Temporary tabs drop zone' });

        const targetTab = pinnedZone.getByRole('button', { name: 'Pinned Tab' });
        await expect(targetTab).toBeVisible();

        // Right click
        await targetTab.click({ button: 'right' });

        // Click "Unpin Tab"
        await page.getByRole('menuitem', { name: 'Unpin Tab' }).click();

        // Verify: Temporary zone should now contain "Pinned Tab"
        await expect(temporaryZone.getByRole('button', { name: 'Pinned Tab' })).toBeVisible();

        // Verify: Pinned zone should NOT contain "Pinned Tab"
        await expect(pinnedZone.getByRole('button', { name: 'Pinned Tab' })).not.toBeVisible();
    });

    test.fixme('should move tab between sections via drag and drop', async ({ page }) => {
        const pinnedZone = page.getByRole('region', { name: 'Pinned tabs drop zone' });
        const temporaryZone = page.getByRole('region', { name: 'Temporary tabs drop zone' });

        const sourceTab = temporaryZone.getByRole('button', { name: 'Example Tab' });
        // Drag to the zone itself or an item inside it?

        // We can drag to the 'Pinned Tab' in the pinned zone to reorder/move
        const pinnedTab = pinnedZone.getByRole('button', { name: 'Pinned Tab' });

        await expect(sourceTab).toBeVisible();
        await expect(pinnedTab).toBeVisible();

        // Perform Drag (Coordinate based for dnd-kit)
        const sourceBox = await sourceTab.boundingBox();
        const targetBox = await pinnedTab.boundingBox(); // Target an existing pinned tab to drop "over" it (insert)

        if (sourceBox && targetBox) {
            // Start
            await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
            await page.mouse.down();
            await page.waitForTimeout(200);

            // Move slightly
            await page.mouse.move(
                sourceBox.x + sourceBox.width / 2,
                sourceBox.y + sourceBox.height / 2 + 10
            );
            await page.waitForTimeout(100);

            // Move to target
            await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
                steps: 10,
            });
            await page.waitForTimeout(200);

            await page.mouse.up();
        }

        // Verify "Example Tab" is now in Pinned Zone
        await expect(pinnedZone.getByRole('button', { name: 'Example Tab' })).toBeVisible();
        await expect(temporaryZone.getByRole('button', { name: 'Example Tab' })).not.toBeVisible();
    });
});
