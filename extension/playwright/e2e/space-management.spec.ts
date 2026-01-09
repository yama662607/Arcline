import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { addServiceWorkerBridgeMock, bypassOnboarding } from '../fixtures/service-worker-mock';

test.describe('Space Management', () => {
  test('should create a new space', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await bypassOnboarding(page);

    // Navigate to spaces tab
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Create new space
    await page.getByRole('button', { name: /\+ New/i }).click();
    await page.getByPlaceholder('Space name').fill('Test Space');
    await page.getByRole('button', { name: /Create/i }).click();

    // Verify space appears in list
    await expect(page.getByText('Test Space')).toBeVisible();
  });

  test('should switch to a created space', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await bypassOnboarding(page);
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Create a space
    await page.getByRole('button', { name: /\+ New/i }).click();
    await page.getByPlaceholder('Space name').fill('My Space');
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page.getByText('My Space')).toBeVisible();

    // Click on the space to switch
    await page.locator('div[role="button"]', { hasText: 'My Space' }).click();
    await expect(page.getByText('My Space')).toBeVisible();
  });

  test('should display multiple spaces after creation', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await bypassOnboarding(page);
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Default Space should already be visible from mock
    await expect(page.getByText('Default Space')).toBeVisible();

    // Create first space
    await page.getByRole('button', { name: /\+ New/i }).click();
    await page.getByPlaceholder('Space name').fill('Work');
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page.getByText('Work')).toBeVisible();

    // Create second space
    await page.getByRole('button', { name: /\+ New/i }).click();
    await page.getByPlaceholder('Space name').fill('Personal');
    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page.getByText('Personal')).toBeVisible();

    // Verify all three spaces are visible
    await expect(page.getByText('Default Space')).toBeVisible();
    await expect(page.getByText('Work')).toBeVisible();
    await expect(page.getByText('Personal')).toBeVisible();
  });

  test('should create space with different colors', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await bypassOnboarding(page);
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Open create space dialog
    await page.getByRole('button', { name: /\+ New/i }).click();
    await page.getByPlaceholder('Space name').fill('Colored Space');

    // Check if color picker/selector is available
    const colorButtons = page.locator('button[data-color]');
    const colorButtonCount = await colorButtons.count();

    if (colorButtonCount > 0) {
      // Click on a different color if available
      await colorButtons.first().click();
    }

    await page.getByRole('button', { name: /Create/i }).click();
    await expect(page.getByText('Colored Space')).toBeVisible();
  });
});

test.describe('Settings Panel', () => {
  test('should toggle compact mode', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await bypassOnboarding(page);
    await page.getByRole('button', { name: /Settings/i }).click();

    // Navigate to Appearance tab to find compact mode setting
    await page.getByRole('button', { name: /Appearance/i }).click();

    // Find the toggle switch using data-testid
    const compactRow = page.getByTestId('setting-compact-mode');
    await expect(compactRow).toBeVisible();
    const compactToggle = compactRow.getByRole('switch');

    // Toggle on
    await compactToggle.click();
    await expect(compactToggle).toHaveAttribute('aria-checked', 'true');

    // Toggle off
    await compactToggle.click();
    await expect(compactToggle).toHaveAttribute('aria-checked', 'false');
  });

  test('should toggle show favicons setting', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await bypassOnboarding(page);
    await page.getByRole('button', { name: /Settings/i }).click();

    // Navigate to Appearance tab to find show favicons setting
    await page.getByRole('button', { name: /Appearance/i }).click();

    // Find the toggle switch using data-testid
    const faviconsRow = page.getByTestId('setting-show-favicons');
    await expect(faviconsRow).toBeVisible();
    const faviconsToggle = faviconsRow.getByRole('switch');

    // Toggle on
    await faviconsToggle.click();
    await expect(faviconsToggle).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('Archive Management', () => {
  test('should display archive tab', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await bypassOnboarding(page);
    await page.getByRole('button', { name: /Archive/i }).click();

    // Should show archive heading with count
    await expect(page.getByRole('heading', { name: /Archive \(/i })).toBeVisible();
  });

  test('should display archived tabs count', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await bypassOnboarding(page);
    await page.getByRole('button', { name: /Archive/i }).click();

    await expect(page.getByRole('heading', { name: /Archive \(1\)/i })).toBeVisible();
  });
});
