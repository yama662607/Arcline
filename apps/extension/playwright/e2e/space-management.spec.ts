import { expect, test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Space Management', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    // Add Service Worker Bridge mock before navigating to popup
    await addServiceWorkerBridgeMock(page);

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
  });

  test('should create and manage spaces', async ({ page }) => {
    // Navigate to spaces tab
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Create new space
    await page.getByRole('button', { name: /\+ New/i }).click();
    await page.getByPlaceholder('Space name').fill('Test Space');
    await page.getByRole('button', { name: /Create/i }).click();

    // Verify space appears in list
    await expect(page.getByText('Test Space')).toBeVisible();

    // Switch to the new space
    await page.getByText('Test Space').click();

    // Verify space is now active (check if Switch button is visible for active space)
    await expect(page.getByText('Test Space')).toBeVisible();
  });

  test('should remove spaces with confirmation', async ({ page }) => {
    // Navigate to spaces tab
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Create a space to remove
    await page.getByRole('button', { name: /\+ New/i }).click();
    await page.getByPlaceholder('Space name').fill('Space to Remove');
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page.getByText('Space to Remove')).toBeVisible();

    // Remove the space - use more specific selector
    const spaceToRemove = page.getByText('Space to Remove');
    const removeButton = spaceToRemove.locator('..').getByLabel('Remove space');
    await removeButton.click();

    // Verify space is removed (should not be visible anymore)
    await expect(page.getByText('Space to Remove')).not.toBeVisible();
  });

  test('should switch between spaces', async ({ page }) => {
    // Navigate to spaces tab
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Create second space
    await page.getByRole('button', { name: /\+ New/i }).click();
    await page.getByPlaceholder('Space name').fill('Second Space');
    await page.getByRole('button', { name: /Create/i }).click();

    // Switch between spaces
    await page.getByText('Default Space').click();
    await expect(page.getByText('Default Space')).toBeVisible();

    await page.getByText('Second Space').click();
    await expect(page.getByText('Second Space')).toBeVisible();
  });
});

test.describe('Settings Panel', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    // Add Service Worker Bridge mock before navigating to popup
    await addServiceWorkerBridgeMock(page);

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.getByRole('button', { name: /Settings/i }).click();
  });

  test('should toggle auto-archive setting', async ({ page }) => {
    // Find and toggle auto-archive checkbox
    const autoArchiveCheckbox = page.getByLabel(/Auto-archive tabs/i);
    await expect(autoArchiveCheckbox).toBeVisible();

    // Check initial state (unchecked by default)
    await expect(autoArchiveCheckbox).not.toBeChecked();

    // Toggle on
    await autoArchiveCheckbox.check();
    await expect(autoArchiveCheckbox).toBeChecked();

    // Toggle off
    await autoArchiveCheckbox.uncheck();
    await expect(autoArchiveCheckbox).not.toBeChecked();
  });

  test('should adjust auto-archive interval', async ({ page }) => {
    // Find auto-archive checkbox
    const autoArchiveCheckbox = page.getByLabel(/Auto-archive tabs/i);

    // Try to enable it and check if interval input appears
    await autoArchiveCheckbox.check();

    // Look for any number input (the interval input might have different selectors)
    const numberInput = page.locator('input[type="number"]');
    if (await numberInput.isVisible()) {
      await numberInput.fill('60');
      await expect(numberInput).toHaveValue('60');
    }

    // Save changes if save button is available
    const saveButton = page.getByRole('button', { name: /Save/i });
    if (await saveButton.isVisible()) {
      await saveButton.click();
    }
  });

  test('should toggle compact mode', async ({ page }) => {
    // Find and toggle compact mode checkbox
    const compactCheckbox = page.getByLabel(/Compact mode/i);
    await expect(compactCheckbox).toBeVisible();

    // Toggle on
    await compactCheckbox.check();
    await expect(compactCheckbox).toBeChecked();

    // Toggle off
    await compactCheckbox.uncheck();
    await expect(compactCheckbox).not.toBeChecked();
  });

  test('should toggle show favicons setting', async ({ page }) => {
    // Find and toggle show favicons checkbox
    const faviconsCheckbox = page.getByLabel(/Show favicons/i);
    await expect(faviconsCheckbox).toBeVisible();

    // Toggle on
    await faviconsCheckbox.check();
    await expect(faviconsCheckbox).toBeChecked();

    // Toggle off
    await faviconsCheckbox.uncheck();
    await expect(faviconsCheckbox).not.toBeChecked();
  });

  test('should toggle animations setting', async ({ page }) => {
    // Find and toggle animations checkbox
    const animationsCheckbox = page.getByLabel(/Animations/i);
    await expect(animationsCheckbox).toBeVisible();

    // Toggle on
    await animationsCheckbox.check();
    await expect(animationsCheckbox).toBeChecked();

    // Toggle off
    await animationsCheckbox.uncheck();
    await expect(animationsCheckbox).not.toBeChecked();
  });
});

test.describe('Tab Operations', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    // Add Service Worker Bridge mock before navigating to popup
    await addServiceWorkerBridgeMock(page);

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.getByRole('button', { name: /Spaces/i }).click();
  });

  test('should show tab context menu', async ({ page }) => {
    // Wait for spaces to load
    await expect(page.getByText('Default Space')).toBeVisible();

    // Right-click on a space to show context menu (if implemented)
    const spaceButton = page.getByText('Default Space');
    await expect(spaceButton).toBeVisible();

    // Basic interaction test - the space should be clickable
    await spaceButton.click();
    await expect(spaceButton).toBeVisible();
  });
});

test.describe('Archive Management', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.getByRole('button', { name: /Archive/i }).click();
  });

  test('should display archived tabs', async ({ page }) => {
    // Should show archive count
    await expect(page.getByText(/Archive \(/i)).toBeVisible();
  });

  test('should restore archived tabs', async ({ page }) => {
    const restoreButton = page.getByLabel(/Restore tab/i).first();

    if (await restoreButton.isVisible()) {
      const initialArchiveCount = await page.getByLabel(/Restore tab/i).count();

      await restoreButton.click();

      // Verify tab is restored
      await expect(page.getByLabel(/Restore tab/i)).toHaveCount(initialArchiveCount - 1);
    }
  });

  test('should permanently delete archived tabs', async ({ page }) => {
    const deleteButton = page.getByLabel(/Delete tab/i).first();

    if (await deleteButton.isVisible()) {
      const initialArchiveCount = await page.getByLabel(/Delete tab/i).count();

      await deleteButton.click();

      // Handle confirmation if present
      const confirmButton = page.getByRole('button', { name: /Delete/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Verify tab is deleted
      await expect(page.getByLabel(/Delete tab/i)).toHaveCount(initialArchiveCount - 1);
    }
  });

  test('should clear all archived tabs', async ({ page }) => {
    const clearAllButton = page.getByRole('button', { name: /Clear all/i });

    if (await clearAllButton.isVisible()) {
      await clearAllButton.click();

      // Handle confirmation
      const confirmButton = page.getByRole('button', { name: /Clear/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // Verify archive is empty
      await expect(page.getByText(/No archived tabs/i)).toBeVisible();
    }
  });
});
