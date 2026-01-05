import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as uiMessaging from './ui-messaging';

// Mock dependencies
vi.mock('./ui-messaging', () => ({
  openFloatingUiOnTab: vi.fn().mockResolvedValue(undefined),
}));

// Mock Dexie db
vi.mock('@/db', () => ({
  db: {
    spaces: {
      orderBy: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(undefined),
    },
    items: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    },
    transaction: vi.fn().mockImplementation((_mode, _tables, callback) => callback()),
  },
}));

import { clearCachedSnapshot, activateTab } from './browser';

describe('activateTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCachedSnapshot();

    // Default mocks
    // biome-ignore lint/suspicious/noExplicitAny: mocking overloaded chrome methods needs any
    (vi.mocked(chrome.tabs.get) as any).mockResolvedValue({
      id: 123,
      active: false,
      windowId: 1,
      groupId: -1,
    } as chrome.tabs.Tab);
    // biome-ignore lint/suspicious/noExplicitAny: mocking overloaded chrome methods needs any
    (vi.mocked(chrome.tabs.update) as any).mockResolvedValue({
      id: 123,
      active: true,
    } as chrome.tabs.Tab);
    // biome-ignore lint/suspicious/noExplicitAny: mocking overloaded chrome methods needs any
    (vi.mocked(chrome.tabs.query) as any).mockResolvedValue([]);
    // biome-ignore lint/suspicious/noExplicitAny: mocking overloaded chrome methods needs any
    (vi.mocked(chrome.tabGroups.query) as any).mockResolvedValue([]);
    // Mock storage for getSpacesSnapshot > loadSpaceState fallback protection
    // biome-ignore lint/suspicious/noExplicitAny: mocking overloaded chrome methods needs any
    (vi.mocked(chrome.storage.local.get) as any).mockResolvedValue({});
  });

  it('should activate the tab and then trigger openFloatingUiOnTab', async () => {
    const tabId = 123;
    await activateTab(tabId);

    // Verify tab activation
    expect(chrome.tabs.update).toHaveBeenCalledWith(tabId, { active: true });
    // Verify openFloatingUiOnTab is called
    expect(uiMessaging.openFloatingUiOnTab).toHaveBeenCalledWith(
      tabId,
      expect.any(Array),
      -1,
      undefined
    );
  });

  it('should NOT trigger openFloatingUiOnTab if tab activation fails', async () => {
    const tabId = 456;
    const error = new Error('Activation failed');
    // biome-ignore lint/suspicious/noExplicitAny: mocking overloaded chrome methods needs any
    (vi.mocked(chrome.tabs.update) as any).mockRejectedValue(error);

    await expect(activateTab(tabId)).rejects.toThrow('Activation failed');

    expect(chrome.tabs.update).toHaveBeenCalledWith(tabId, { active: true });
    expect(uiMessaging.openFloatingUiOnTab).not.toHaveBeenCalled();
  });

  it('should NOT fail overall if openFloatingUiOnTab fails (Graceful Degradation)', async () => {
    const tabId = 789;
    const consoleSpy = vi.spyOn(console, 'warn');
    // Setup openFloatingUiOnTab to fail
    vi.mocked(uiMessaging.openFloatingUiOnTab).mockRejectedValue(new Error('UI Open Failed'));

    // Should NOT throw
    await activateTab(tabId);

    expect(chrome.tabs.update).toHaveBeenCalledWith(tabId, { active: true });
    expect(uiMessaging.openFloatingUiOnTab).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to open floating UI'),
      expect.any(Error)
    );
  });

  it('should pass correct spaces snapshot data to floating UI', async () => {
    const tabId = 101;
    // Mock data for snapshot
    const mockTabs = [
      { id: 1, title: 'Tab 1', url: 'http://a.com', groupId: -1 } as chrome.tabs.Tab,
    ];
    // biome-ignore lint/suspicious/noExplicitAny: mocking overloaded chrome methods needs any
    (vi.mocked(chrome.tabs.query) as any).mockResolvedValue(mockTabs);

    await activateTab(tabId);

    expect(uiMessaging.openFloatingUiOnTab).toHaveBeenCalledWith(
      tabId,
      expect.arrayContaining([
        expect.objectContaining({
          id: -1, // ungrouped
          temporaryTabs: expect.arrayContaining([
            expect.objectContaining({ id: 1, title: 'Tab 1' }),
          ]),
        }),
      ]),
      -1,
      undefined
    );
  });
});
