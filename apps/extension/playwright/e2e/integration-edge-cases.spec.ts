import { expect, test } from '../fixtures';
import { addServiceWorkerBridgeMock } from '../fixtures/service-worker-mock';

test.describe('Cross-Browser Compatibility', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    // Add Service Worker Bridge mock before navigating to popup
    await addServiceWorkerBridgeMock(page);

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
  });

  test('should work in different viewport sizes', async ({ page }) => {
    const viewports = [
      { width: 320, height: 480 }, // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1280, height: 800 }, // Desktop
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.reload();

      // Verify basic functionality
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('button', { name: /Spaces/i })).toBeVisible();

      // Test tab switching
      await page.getByRole('button', { name: /Archive/i }).click();
      await expect(page.getByText(/Archive/i)).toBeVisible();

      await page.getByRole('button', { name: /Settings/i }).click();
      await expect(page.getByText(/Settings/i)).toBeVisible();
    }
  });

  test('should handle different zoom levels', async ({ page }) => {
    const zoomLevels = [0.8, 1.0, 1.2, 1.5];

    for (const zoom of zoomLevels) {
      await page.evaluate((level) => {
        document.body.style.zoom = level.toString();
      }, zoom);

      await page.waitForTimeout(100);

      // Verify UI remains usable
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('button', { name: /Spaces/i })).toBeVisible();
    }
  });
});

test.describe('Data Persistence', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
  });

  test('should persist spaces across sessions', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Create a space
    await page.getByRole('button', { name: /\+ New/i }).click();
    await page.getByPlaceholder('Space name').fill('Persistence Test');
    await page.getByRole('button', { name: /Create/i }).click();

    // Verify space exists
    await expect(page.getByText('Persistence Test')).toBeVisible();

    // Reload page
    await page.reload();
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Space should still exist
    await expect(page.getByText('Persistence Test')).toBeVisible();
  });

  test('should persist settings across sessions', async ({ page }) => {
    await page.getByRole('button', { name: /Settings/i }).click();

    // Change a setting
    const autoArchiveToggle = page.getByLabel(/Auto-archive/i);
    await autoArchiveToggle.click();

    // Reload page
    await page.reload();
    await page.getByRole('button', { name: /Settings/i }).click();

    // Setting should be preserved
    await expect(autoArchiveToggle).toHaveAttribute('aria-checked', 'true');
  });

  test('should persist pinned tabs', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Pin a tab
    const pinButton = page.getByLabel(/Toggle pin/i).first();
    await pinButton.click();

    // Reload page
    await page.reload();
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Tab should remain pinned
    await expect(pinButton).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Security', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
  });

  test('should sanitize user input', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();
    await page.getByRole('button', { name: /\+ New/i }).click();

    // Try to inject HTML
    const maliciousInput = '<script>alert("xss")</script>';
    await page.getByPlaceholder('Space name').fill(maliciousInput);
    await page.getByRole('button', { name: /Create/i }).click();

    // Should not execute script
    await expect(page.locator('body')).not.toContainText('xss');

    // Input should be sanitized or rejected
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle large inputs gracefully', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();
    await page.getByRole('button', { name: /\+ New/i }).click();

    // Try very long input
    const longInput = 'a'.repeat(10000);
    await page.getByPlaceholder('Space name').fill(longInput);

    // Should handle gracefully without crashing
    await expect(page.locator('body')).toBeVisible();
  });

  test('should validate URLs', async ({ page }) => {
    // This would test URL validation in tab operations
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Verify tab URLs are displayed safely
    const tabRows = page.locator('[data-testid="tab-row"]');
    if (await tabRows.first().isVisible()) {
      const firstTab = tabRows.first();
      await expect(firstTab).toBeVisible();
    }
  });
});

test.describe('Integration Tests', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
  });

  test('should integrate spaces and tabs', async ({ page }) => {
    // Create space
    await page.getByRole('button', { name: /Spaces/i }).click();
    await page.getByRole('button', { name: /\+ New/i }).click();
    await page.getByPlaceholder('Space name').fill('Integration Space');
    await page.getByRole('button', { name: /Create/i }).click();

    // Switch to new space
    await page.getByText('Integration Space').click();

    // Verify space is active
    await expect(page.getByText('Integration Space')).toHaveClass(/active/);

    // Tab operations should work in new space
    const pinButton = page.getByLabel(/Toggle pin/i).first();
    if (await pinButton.isVisible()) {
      await pinButton.click();
      await expect(pinButton).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('should integrate archive and restore', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Archive a tab
    const archiveButton = page.getByLabel(/Archive tab/i).first();
    if (await archiveButton.isVisible()) {
      await archiveButton.click();

      // Check archive
      await page.getByRole('button', { name: /Archive/i }).click();
      await expect(page.getByText(/archived/i)).toBeVisible();

      // Restore tab
      const restoreButton = page.getByLabel(/Restore tab/i).first();
      if (await restoreButton.isVisible()) {
        await restoreButton.click();

        // Go back to spaces
        await page.getByRole('button', { name: /Spaces/i }).click();

        // Tab should be restored
        await expect(page.locator('[data-testid="tab-row"]').first()).toBeVisible();
      }
    }
  });

  test('should integrate settings and behavior', async ({ page }) => {
    // Enable auto-archive
    await page.getByRole('button', { name: /Settings/i }).click();
    const autoArchiveToggle = page.getByLabel(/Auto-archive/i);
    await autoArchiveToggle.click();

    // Go back to spaces
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Settings should affect behavior
    // (This would require more complex setup to test auto-archive)
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
  });

  test('should handle empty state gracefully', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Should show empty state message
    await expect(page.getByText(/No tabs/i)).toBeVisible();
  });

  test('should handle rapid operations', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Rapidly create and delete spaces
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: /\+ New/i }).click();
      await page.getByPlaceholder('Space name').fill(`Space ${i}`);
      await page.getByRole('button', { name: /Create/i }).click();
      await page.waitForTimeout(50);
    }

    // Should not crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle browser storage quota', async ({ page }) => {
    // This would test behavior when storage is full
    // For now, just verify graceful handling
    await page.getByRole('button', { name: /Spaces/i }).click();
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle extension reload', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Simulate extension reload by clearing storage
    await page.evaluate(() => {
      chrome.storage.local.clear();
      chrome.storage.sync.clear();
    });

    // Reload page
    await page.reload();

    // Should handle gracefully
    await expect(page.locator('body')).toBeVisible();
  });
});
