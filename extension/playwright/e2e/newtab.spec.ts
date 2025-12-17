import { expect } from '@playwright/test';

import { test } from '../fixtures';

test('new tab shows home screen and can open command palette', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/newtab.html`);

  await expect(page.getByRole('heading', { name: 'Arcline' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Command Palette' })).toBeVisible();

  await page.getByRole('button', { name: 'Open Command Palette' }).click();

  await expect(page.getByRole('dialog', { name: 'Command Menu' })).toBeVisible();
});

test('new tab fallback kicks in when new tab override is disabled', async ({
  page,
  extensionId,
}) => {
  await page.goto(`chrome-extension://${extensionId}/newtab.html`);

  await page.evaluate(async () => {
    await chrome.storage.local.set({
      'arcline.settings': {
        defaultSpaceName: 'Home',
        autoArchiveEnabled: false,
        autoArchiveIdleMinutes: 30,
        enableNewTabOverride: false,
        uiMode: 'floating',
        showFavicons: true,
        compactMode: false,
        enableAnimations: true,
        theme: 'auto',
        gesturesEnabled: true,
        gestureSensitivity: 100,
      },
    });
  });

  await page.reload();

  await expect(page).toHaveURL(
    /^(chrome:\/\/new-tab-page\/|chrome-search:\/\/local-ntp\/local-ntp\.html)/
  );
});
