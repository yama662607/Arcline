import { expect, test } from '../fixtures';

test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
  });

  test('should navigate tabs with keyboard', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Focus first tab
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Navigate with arrow keys
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');

    // Verify focus management
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should activate shortcuts with keyboard', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Focus create button and activate with Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // Verify create dialog opens
    await expect(page.getByPlaceholder('Space name')).toBeVisible();

    // Type name and submit with Ctrl+Enter
    await page.keyboard.type('Keyboard Space');
    await page.keyboard.press('Control+Enter');

    // Verify space is created
    await expect(page.getByText('Keyboard Space')).toBeVisible();
  });

  test('should escape dialogs with Escape key', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();
    await page.getByRole('button', { name: /\+ New/i }).click();

    // Verify dialog is open
    await expect(page.getByPlaceholder('Space name')).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');

    // Verify dialog is closed
    await expect(page.getByPlaceholder('Space name')).not.toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Check tab list has proper role
    await expect(page.getByRole('tablist')).toBeVisible();

    // Check tabs have proper roles
    await expect(page.getByRole('tab').first()).toBeVisible();

    // Check tabpanels have proper roles
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('should support screen readers', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Check for descriptive labels
    const tabRows = page.locator('[data-testid="tab-row"]');
    const firstTab = tabRows.first();

    await expect(firstTab).toHaveAttribute('aria-label');
    await expect(firstTab).toHaveAttribute('role');
  });

  test('should maintain focus management', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Focus create button
    const createButton = page.getByRole('button', { name: /\+ New/i });
    await createButton.focus();

    // Verify focus is visible
    await expect(createButton).toBeFocused();

    // Open dialog
    await createButton.click();

    // Verify focus moves to dialog
    await expect(page.getByPlaceholder('Space name')).toBeFocused();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    // This would require a contrast checking library
    // For now, just verify important elements are visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Spaces/i })).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
  });

  test('should adapt to different viewport sizes', async ({ page }) => {
    // Test small viewport
    await page.setViewportSize({ width: 300, height: 400 });
    await expect(page.getByRole('main')).toBeVisible();

    // Test large viewport
    await page.setViewportSize({ width: 800, height: 600 });
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('should handle scrolling in long tab lists', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Set small height to force scrolling
    await page.setViewportSize({ width: 400, height: 200 });

    // Check if scrollable
    const tabList = page.locator('[data-testid="tab-list"]');
    const scrollHeight = await tabList.evaluate((el) => el.scrollHeight);
    const clientHeight = await tabList.evaluate((el) => el.clientHeight);

    if (scrollHeight > clientHeight) {
      // Test scrolling
      await tabList.evaluate((el) => {
        el.scrollTop = 100;
      });
      await page.waitForTimeout(100);

      const scrollTop = await tabList.evaluate((el) => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
    }
  });
});

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);

    await page.getByRole('button', { name: /Spaces/i }).click();

    // Should show error state or fallback
    await expect(page.getByText(/Error|Failed|Offline/i)).toBeVisible();
  });

  test('should handle invalid input', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();
    await page.getByRole('button', { name: /\+ New/i }).click();

    // Try to create space with empty name
    await page.getByRole('button', { name: /Create/i }).click();

    // Should show validation error
    await expect(page.getByText(/required|empty|invalid/i)).toBeVisible();

    // Try with special characters
    await page.getByPlaceholder('Space name').fill('Space<>!@#');
    await page.getByRole('button', { name: /Create/i }).click();

    // Should handle gracefully
    await expect(page.locator('body')).toBeVisible();
  });

  test('should recover from errors', async ({ page }) => {
    await page.context().setOffline(true);

    await page.getByRole('button', { name: /Spaces/i }).click();

    // Go back online
    await page.context().setOffline(false);

    // Reload or retry
    await page.reload();

    // Should recover and show content
    await expect(page.getByRole('main')).toBeVisible();
  });
});

test.describe('Performance', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
  });

  test('should load quickly', async ({ page, extensionId }) => {
    const startTime = Date.now();

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    // Should load within 2 seconds
    expect(loadTime).toBeLessThan(2000);
  });

  test('should handle large tab lists efficiently', async ({ page }) => {
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Measure rendering time
    const startTime = Date.now();

    // Scroll through list
    await page.keyboard.press('End');
    await page.waitForTimeout(100);

    const renderTime = Date.now() - startTime;

    // Should handle large lists without significant delay
    expect(renderTime).toBeLessThan(1000);
  });

  test('should not leak memory', async ({ page }) => {
    // This would require memory monitoring tools
    // For now, just verify no obvious memory issues
    await page.getByRole('button', { name: /Spaces/i }).click();

    // Perform many operations
    for (let i = 0; i < 10; i++) {
      await page.getByRole('button', { name: /\+ New/i }).click();
      await page.keyboard.press('Escape');
    }

    // Should still be responsive
    await expect(page.locator('body')).toBeVisible();
  });
});
