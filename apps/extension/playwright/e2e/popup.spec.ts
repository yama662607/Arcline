import { expect, test } from '../fixtures';

const popupPath = 'popup.html';

test.describe('Popup UI', () => {
  test('renders and toggles tabs', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/${popupPath}`);

    const spacesHeading = page.getByRole('heading', { name: /Spaces/i, level: 1 });
    await expect(spacesHeading).toBeVisible();

    const archiveTab = page.getByRole('button', { name: /Archive/i });
    await archiveTab.click();
    await expect(page.getByRole('heading', { name: /Archive \(/i })).toBeVisible();
  });
});
