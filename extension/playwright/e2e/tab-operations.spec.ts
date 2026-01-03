import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Tab Operations in Popup', () => {
  test.beforeEach(async ({ page }) => {
    await addServiceWorkerBridgeMock(page);
  });

  test('displays tabs in the spaces view', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await page.getByRole('button', { name: /Spaces/i }).click();

    await expect(page.getByText('Default Space')).toBeVisible({ timeout: 10_000 });
  });

  test('shows pinned tab section', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await page.getByRole('button', { name: /Spaces/i }).click();

    await expect(page.getByRole('button', { name: /Pinned Tab/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('shows temporary tab section', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await page.getByRole('button', { name: /Spaces/i }).click();

    await expect(page.getByRole('button', { name: /Temporary Tab/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('Archive Operations', () => {
  test.beforeEach(async ({ page }) => {
    await addServiceWorkerBridgeMock(page);
  });

  test('displays archived tabs in archive view', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await page.getByRole('button', { name: /Archive/i }).click();

    await expect(page.getByRole('heading', { name: /Archive/i })).toBeVisible();
    await expect(page.getByText('Archived Tab')).toBeVisible({ timeout: 10_000 });
  });

  test('shows archived tab details', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await page.getByRole('button', { name: /Archive/i }).click();

    await expect(page.getByText('archived.example.com')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Favorites Operations', () => {
  test.beforeEach(async ({ page }) => {
    await addServiceWorkerBridgeMock(page);
  });

  test('displays favorites section header', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await page.getByRole('button', { name: /Spaces/i }).click();

    // FavoritesBar always shows a "Favorites" header
    await expect(page.getByText('Favorites')).toBeVisible({ timeout: 10_000 });
  });
});
