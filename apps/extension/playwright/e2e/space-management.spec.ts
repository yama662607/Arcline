import { expect, test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Space Management', () => {
  test('should create a new space', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

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
});

test.describe('Settings Panel', () => {
  test('should toggle compact mode', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.getByRole('button', { name: /Settings/i }).click();

    const compactCheckbox = page.getByLabel(/Compact mode/i);
    await expect(compactCheckbox).toBeVisible();

    await compactCheckbox.check();
    await expect(compactCheckbox).toBeChecked();

    await compactCheckbox.uncheck();
    await expect(compactCheckbox).not.toBeChecked();
  });

  test('should toggle show favicons setting', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.getByRole('button', { name: /Settings/i }).click();

    const faviconsCheckbox = page.getByLabel(/Show favicons/i);
    await expect(faviconsCheckbox).toBeVisible();

    await faviconsCheckbox.check();
    await expect(faviconsCheckbox).toBeChecked();
  });
});

test.describe('Archive Management', () => {
  test('should display archive tab', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.getByRole('button', { name: /Archive/i }).click();

    // Should show archive heading with count
    await expect(page.getByRole('heading', { name: /Archive \(/i })).toBeVisible();
  });

  test('should show empty state when no archived tabs', async ({ page, extensionId }) => {
    await addServiceWorkerBridgeMock(page);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.getByRole('button', { name: /Archive/i }).click();

    await expect(page.getByText('No archived tabs')).toBeVisible();
  });
});
