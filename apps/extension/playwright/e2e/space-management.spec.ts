import { expect, test } from '../fixtures';

test.describe('Space Management', () => {
  test.beforeEach(async ({ page, extensionId }) => {
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
    await expect(page.getByText('Test Space')).toHaveClass(/active/);
  });

  test('should remove spaces with confirmation', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Try to remove last space (should be disabled)
    const removeButton = page.getByLabel(/Remove space/i).first();
    await expect(removeButton).toBeDisabled();

    // Create additional space first
    await page.getByRole('button', { name: /\+ New/i }).click();
    await page.getByPlaceholder('Space name').fill('Another Space');
    await page.getByRole('button', { name: /Create/i }).click();

    // Now removal should be possible
    await page
      .getByLabel(/Remove space/i)
      .first()
      .click();

    // Handle confirmation dialog if present
    const confirmButton = page.getByRole('button', { name: /Remove/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Verify space is removed
    await expect(page.getByText('Temporary Space')).not.toBeVisible();
  });

  test('should switch between spaces', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Create multiple spaces
    await page.getByRole('button', { name: /Create Space/i }).click();
    await page.getByPlaceholder('Space name').fill('Work');
    await page.getByRole('button', { name: /Create/i }).click();

    await page.getByRole('button', { name: /\+ New/i }).click();
    await page.getByPlaceholder('Space name').fill('Personal');
    await page.getByRole('button', { name: /Create/i }).click();

    // Switch between spaces
    await page.getByText('Work').click();
    await expect(page.getByText('Work')).toHaveClass(/active/);

    await page.getByText('Personal').click();
    await expect(page.getByText('Personal')).toHaveClass(/active/);
  });
});

test.describe('Tab Operations', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.getByRole('button', { name: /Spaces/i }).click();
  });

  test('should pin and unpin tabs', async ({ page }) => {
    const pinButton = page.getByLabel(/Toggle pin/i).first();

    // Get initial state
    const isPinned = await pinButton.getAttribute('aria-pressed');

    // Toggle pin
    await pinButton.click();

    // Verify state changed
    const newPinnedState = await pinButton.getAttribute('aria-pressed');
    expect(newPinnedState).not.toBe(isPinned);
  });

  test('should close tabs', async ({ page }) => {
    const closeButton = page.getByLabel(/Close tab/i).first();
    const initialTabCount = await page.getByLabel(/Close tab/i).count();

    await closeButton.click();

    // Verify tab is removed
    await expect(page.getByLabel(/Close tab/i)).toHaveCount(initialTabCount - 1);
  });

  test('should archive tabs', async ({ page }) => {
    const archiveButton = page.getByLabel(/Archive tab/i).first();
    const initialTabCount = await page.getByLabel(/Archive tab/i).count();

    await archiveButton.click();

    // Verify tab is removed from current view
    await expect(page.getByLabel(/Archive tab/i)).toHaveCount(initialTabCount - 1);

    // Check archive tab
    await page.getByRole('button', { name: /Archive/i }).click();
    await expect(page.getByText(/archived/i)).toBeVisible();
  });

  test('should search tabs', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search tabs/i);

    // Type search query
    await searchInput.fill('Test');

    // Verify filtering works
    const visibleTabs = await page.locator('[data-testid="tab-row"]').count();

    // Clear search
    await searchInput.clear();

    // Verify all tabs are visible again
    const allTabs = await page.locator('[data-testid="tab-row"]').count();
    expect(allTabs).toBeGreaterThanOrEqual(visibleTabs);
  });

  test('should show tab context menu', async ({ page }) => {
    const tabRow = page.locator('[data-testid="tab-row"]').first();

    // Right-click on tab
    await tabRow.click({ button: 'right' });

    // Verify context menu appears
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Open in new tab/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Copy URL/i })).toBeVisible();
  });
});

test.describe('Settings Panel', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.getByRole('button', { name: /Settings/i }).click();
  });

  test('should toggle settings', async ({ page }) => {
    // Toggle auto-archive
    const autoArchiveToggle = page.getByLabel(/Auto-archive/i);
    await autoArchiveToggle.click();

    // Verify setting is saved
    await expect(autoArchiveToggle).toHaveAttribute('aria-checked', 'true');

    // Toggle again
    await autoArchiveToggle.click();
    await expect(autoArchiveToggle).toHaveAttribute('aria-checked', 'false');
  });

  test('should adjust auto-archive interval', async ({ page }) => {
    const intervalInput = page.getByLabel(/Archive interval/i);

    // Change interval
    await intervalInput.fill('60');

    // Verify setting is applied
    await expect(intervalInput).toHaveValue('60');
  });

  test('should switch themes', async ({ page }) => {
    const themeSelect = page.getByLabel(/Theme/i);

    // Change theme
    await themeSelect.selectOption('dark');

    // Verify theme is applied
    await expect(page.locator('body')).toHaveClass(/dark/);
  });

  test('should toggle compact mode', async ({ page }) => {
    const compactToggle = page.getByLabel(/Compact mode/i);
    await compactToggle.click();

    // Verify compact mode is enabled
    await expect(page.locator('body')).toHaveClass(/compact/);
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
