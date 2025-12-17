import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Tab Search (Command Palette)', () => {
    test.beforeEach(async ({ page, extensionId }) => {
        // Navigate to popup
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Skip onboarding
        await page.evaluate(async () => {
            await chrome.storage.local.set({ 'arcline.hasSeenOnboarding': true });
        });

        // Setup Mock Service Worker (needed for search bridge calls)
        await addServiceWorkerBridgeMock(page);

        await page.reload();

        // Wait for main UI to load
        await expect(page.getByText('Temporary')).toBeVisible();
    });

    test.fixme('should open command palette with keyboard shortcut (Cmd+K)', async ({ page }) => {
        // Ensure focus
        await page.mouse.click(100, 100);

        // Initially not visible
        const palette = page.getByRole('dialog', { name: 'Command Menu' }); // cmdk renders div role=dialog? Or checks accessibility?
        // CommandPalette.tsx renders div role="dialog" aria-modal="true"
        await expect(palette).not.toBeVisible();

        // Press Cmd+K
        // Note: modify for Mac vs Windows if needed. Playwright handles Meta/Control.
        await page.keyboard.press('Meta+k');

        // Should be visible
        await expect(palette).toBeVisible();

        // Should focus input
        const input = page.getByPlaceholder('Search tabs, bookmarks, history...');
        await expect(input).toBeVisible();
        await expect(input).toBeFocused();
    });

    test.fixme('should search and display results', async ({ page }) => {
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));

        // Verify Header presence (Case insensitive)
        const header = page.getByText(/Current Tab/i);
        if (!await header.isVisible()) {
            console.log('Header NOT Visible. Dumping content:');
            console.log(await page.content());
        }
        await expect(header).toBeVisible();

        // Search Button
        const searchBtn = page.locator('button[aria-label="Open command palette"]');
        if (!await searchBtn.isVisible()) {
            console.log('Search Button NOT Visible. Listing all buttons:');
            const buttons = await page.getByRole('button').all();
            for (const btn of buttons) {
                console.log('Button:', await btn.innerText(), 'Aria:', await btn.getAttribute('aria-label'));
            }
        }
        await expect(searchBtn).toBeVisible();
        await searchBtn.click();

        const input = page.getByPlaceholder('Search tabs, bookmarks, history...');
        await expect(input).toBeVisible();

        // Type "Example"
        await input.fill('Example');

        // Wait for results
        // "Example Tab" is in Mock Data (Temporary/Pinned)
        // CommandPalette uses useUniversalSearch which uses Fuse on spaces data

        // cmdk items have role="option"?
        // Command.Item renders div.
        // We can check text.
        await expect(page.getByText('Example Tab')).toBeVisible();

        // Ensure "No results found" is NOT visible
        await expect(page.getByText('No results found.')).not.toBeVisible();
    });

    test.fixme('should close on Escape', async ({ page }) => {
        await page.keyboard.press('Meta+k');
        await expect(page.getByRole('dialog')).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).not.toBeVisible();
    });
});
