import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { addServiceWorkerBridgeMock, bypassOnboarding } from '../fixtures/service-worker-mock';

test.describe('Popup UI', () => {
  test('renders and toggles tabs', async ({ page, extensionId }) => {
    // Add Service Worker Bridge mock before navigating to popup
    await addServiceWorkerBridgeMock(page);

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await bypassOnboarding(page);

    const spacesHeading = page.getByRole('heading', { name: 'Spaces', level: 1 });
    await expect(spacesHeading).toBeVisible();

    const archiveTab = page.getByRole('button', { name: /Archive/i });
    await archiveTab.click();
    await expect(page.getByRole('heading', { name: /Archive \(/i })).toBeVisible();
  });
});
