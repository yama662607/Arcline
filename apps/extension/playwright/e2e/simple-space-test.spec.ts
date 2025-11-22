import { expect, test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Simple Space Creation Test', () => {
  test('should create a new space', async ({ page, extensionId }) => {
    // Add Service Worker Bridge mock before navigating to popup
    await addServiceWorkerBridgeMock(page);

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Wait for the popup to load
    await page.waitForLoadState('networkidle');

    // Navigate to spaces tab if not already active
    const spacesTab = page.getByRole('button', { name: /Spaces/i });
    if (await spacesTab.isVisible()) {
      await spacesTab.click();
    }

    // Wait a moment for the spaces to load
    await page.waitForTimeout(500);

    // If loading spinner is visible, wait for it to disappear
    const loadingSpinner = page.getByTestId('loading-spinner');
    if (await loadingSpinner.isVisible().catch(() => false)) {
      await expect(loadingSpinner).not.toBeVisible({ timeout: 15000 });
    }

    // Ensure no error message is shown
    const errorMessage = page.getByText(/スペースの読み込みに失敗しました/i);
    await expect(errorMessage).not.toBeVisible({ timeout: 100 });

    // Click the new space button (identified by its test id)
    const newSpaceButton = page.getByTestId('spaces-new-button');
    await expect(newSpaceButton).toBeVisible({ timeout: 15000 });
    await newSpaceButton.click();

    // Fill in the space name
    const nameInput = page.getByPlaceholder('Space name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Test Space');

    // Click the Create button
    const createButton = page.getByRole('button', { name: /Create/i });
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Wait for the space to be created
    await page.waitForTimeout(2000);

    // Verify the space appears in the list
    await expect(page.getByText('Test Space')).toBeVisible();
  });

  test('should show error for empty space name', async ({ page, extensionId }) => {
    // Add Service Worker Bridge mock before navigating to popup
    await addServiceWorkerBridgeMock(page);

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Wait for the popup to load
    await page.waitForLoadState('networkidle');

    // Navigate to spaces tab if not already active
    const spacesTab = page.getByRole('button', { name: /Spaces/i });
    if (await spacesTab.isVisible()) {
      await spacesTab.click();
    }

    // Wait a moment for the spaces to load
    await page.waitForTimeout(1000);

    // Click the new space button (identified by its test id)
    const newSpaceButton = page.getByTestId('spaces-new-button');
    await expect(newSpaceButton).toBeVisible({ timeout: 15000 });
    await newSpaceButton.click();

    // Try to create without entering a name
    const createButton = page.getByRole('button', { name: /Create/i });
    await expect(createButton).toBeVisible();

    // Create button should be disabled when name is empty
    await expect(createButton).toBeDisabled();
  });
});
