import { type Page } from '@playwright/test';

export interface MockSpace {
    id: number;
    name: string;
    color: string;
    windowId: number;
    timestamp: number;
    pinnedTabs: any[];
    temporaryTabs: any[];
}

export async function addServiceWorkerBridgeMock(page: Page) {
    await page.addInitScript(() => {
        // Ensure chrome object exists and has runtime with sendMessage
        if (!(window as any).chrome) {
            (window as any).chrome = {};
        }

        if (!(window as any).chrome.runtime) {
            (window as any).chrome.runtime = {};
        }

        // Store message listeners and mock state
        const messageListeners: Function[] = [];
        let mockSpaces: MockSpace[] = [{
            id: 1,
            name: 'Default Space',
            color: 'blue',
            windowId: 1,
            timestamp: Date.now(),
            pinnedTabs: [],
            temporaryTabs: []
        }];

        // Mock chrome.runtime.sendMessage for Service Worker Bridge
        const chromeRuntime = (window as any).chrome.runtime;
        const originalSendMessage = chromeRuntime.sendMessage;

        chromeRuntime.sendMessage = (message: any, callback?: (response: any) => void) => {
            console.log('[Mock] Intercepted chrome.runtime.sendMessage:', message);

            // Handle Bridge messages
            if (message && (message.type === 'query' || message.type === 'mutation')) {
                // Mock responses for common methods
                setTimeout(() => {
                    let response: any = { id: message.id };

                    switch (message.method) {
                        case 'getSpacesSnapshot':
                            response.data = [...mockSpaces];
                            break;
                        case 'getSettings':
                            response.data = {};
                            break;
                        case 'getArchivedTabs':
                            response.data = [];
                            break;
                        case 'getBookmarksForSpace':
                            response.data = [];
                            break;
                        case 'createSpace':
                            // Add new space to mock state
                            const newSpace: MockSpace = {
                                id: Math.max(...mockSpaces.map(s => s.id), 0) + 1,
                                name: message.params?.name || 'New Space',
                                color: message.params?.color || 'blue',
                                windowId: 1,
                                timestamp: Date.now(),
                                pinnedTabs: [],
                                temporaryTabs: []
                            };
                            mockSpaces.push(newSpace);
                            response.data = newSpace.id;
                            console.log('[Mock] Created new space:', newSpace);
                            break;
                        case 'removeSpace':
                            // Remove space from mock state
                            const spaceIdToRemove = message.params?.spaceId;
                            if (spaceIdToRemove && mockSpaces.length > 1) {
                                mockSpaces = mockSpaces.filter(s => s.id !== spaceIdToRemove);
                                response.data = null;
                            } else {
                                response.error = 'Cannot remove space or last space';
                            }
                            break;
                        case 'toggleTabPinned':
                            response.data = message.params?.pinned ?? true;
                            break;
                        case 'moveTabToSpace':
                        case 'closeTab':
                        case 'activateTab':
                        case 'archiveTab':
                        case 'restoreArchivedTab':
                        case 'updateSettings':
                            response.data = null;
                            break;
                        default:
                            response.error = `Unknown method: ${message.method}`;
                    }

                    console.log('[Mock] Sending response:', response);

                    // Call callback if provided
                    if (callback) {
                        callback(response);
                    }

                    // Trigger all onMessage listeners (this is what Service Worker Bridge expects)
                    messageListeners.forEach((listener) => {
                        try {
                            listener(response, {}, () => { });
                        } catch (e) {
                            console.log('[Mock] Listener error:', e);
                        }
                    });
                }, 50); // Simulate network delay

                return;
            }

            // For non-Bridge messages, use original implementation if available
            if (originalSendMessage) {
                return originalSendMessage.call(chromeRuntime, message, callback);
            }
        };

        // Mock onMessage to capture listeners
        chromeRuntime.onMessage = {
            addListener: function (listener: Function) {
                console.log('[Mock] Adding message listener');
                messageListeners.push(listener);
            },
            removeListener: function (listener: Function) {
                const index = messageListeners.indexOf(listener);
                if (index > -1) {
                    messageListeners.splice(index, 1);
                }
            },
            hasListeners: function () {
                return messageListeners.length > 0;
            }
        };
    });
}
