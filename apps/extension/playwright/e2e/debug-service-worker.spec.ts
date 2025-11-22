import { test, expect } from '../fixtures';

test.describe('Service Worker Debug', () => {
    test('should verify service worker communication', async ({ page, extensionId, serviceWorker, context }) => {
        // Log service worker URL
        console.log('Service Worker URL:', serviceWorker.url());

        // Navigate to service worker page directly to check logs
        const swPage = await context.newPage();
        await swPage.goto(serviceWorker.url());

        // Wait for service worker page to load
        await swPage.waitForLoadState('networkidle');

        // Check if service worker script loaded
        const swContent = await swPage.content();
        console.log('Service Worker page loaded, contains script:', swContent.includes('Service Worker starting up'));

        // Listen for console messages on service worker page
        const swConsoleMessages: string[] = [];
        swPage.on('console', (msg) => {
            const text = `[SW Page] [${msg.type()}] ${msg.text()}`;
            swConsoleMessages.push(text);
            console.log(text);
        });

        // Wait a bit for any initial messages
        await swPage.waitForTimeout(2000);

        // Navigate to popup
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Wait for page to load
        await page.waitForLoadState('networkidle');

        // Wait a bit for any initial messages
        await page.waitForTimeout(2000);

        // Check if React Query is loading spaces
        const loadingSpinner = page.getByTestId('loading-spinner');

        // Wait up to 10 seconds for loading to complete
        try {
            if (await loadingSpinner.isVisible()) {
                await expect(loadingSpinner).not.toBeVisible({ timeout: 10000 });
            }
            console.log('Loading completed successfully');
        } catch (error) {
            console.log('Loading still pending after 10 seconds');

            // Check for error message
            const errorMessage = page.getByText(/スペースの読み込みに失敗しました/i);
            if (await errorMessage.isVisible()) {
                const errorText = await errorMessage.textContent();
                console.log('Error message found:', errorText);
            }

            // Take screenshot for debugging
            await page.screenshot({ path: 'debug-popup-loading.png', fullPage: true });
        }

        // Check if spaces-new-button is available
        const newSpaceButton = page.getByTestId('spaces-new-button');
        const isVisible = await newSpaceButton.isVisible().catch(() => false);
        console.log('New space button visible:', isVisible);

        // Print all console messages from service worker page
        console.log('All Service Worker Page console messages:');
        swConsoleMessages.forEach(msg => console.log('  ', msg));

        // Evaluate bridge communication directly
        const bridgeStatus = await page.evaluate(() => {
            try {
                // Check if chrome.runtime is available
                if (!chrome?.runtime) {
                    return { error: 'Chrome runtime not available' };
                }

                // Try to send a test message
                return new Promise((resolve) => {
                    const id = 'test_' + Date.now();
                    const message = {
                        type: 'query',
                        method: 'getSpacesSnapshot',
                        id
                    };

                    // Set up response handler
                    const listener = (response: any) => {
                        if (response.id === id) {
                            chrome.runtime.onMessage.removeListener(listener);
                            resolve({ success: true, response });
                        }
                    };

                    chrome.runtime.onMessage.addListener(listener);

                    // Send message
                    chrome.runtime.sendMessage(message);

                    // Timeout after 3 seconds
                    setTimeout(() => {
                        chrome.runtime.onMessage.removeListener(listener);
                        resolve({ error: 'Message timeout' });
                    }, 3000);
                });
            } catch (error) {
                return { error: (error as Error).message };
            }
        });

        console.log('Bridge communication test:', bridgeStatus);

        // Close service worker page
        await swPage.close();
    });
});
