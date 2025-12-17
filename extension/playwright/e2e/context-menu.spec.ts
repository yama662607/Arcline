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

    // Expect context menu to appear
    const removeOption = page.getByRole('menuitem', { name: /Remove space/i });
    await expect(removeOption).toBeVisible();

    // Click remove
    await removeOption.click();

    // Verify it is gone
    await expect(page.getByText('Space to Remove')).not.toBeVisible();
  });
});
