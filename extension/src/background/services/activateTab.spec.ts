import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as uiMessaging from './ui-messaging';

import { chromeMock } from '@/test/chrome-mock';

// Mock dependencies
vi.mock('./ui-messaging', () => ({
  openFloatingUiOnTab: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./browser', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./browser')>();
  return {
    ...actual,
    getSpacesSnapshot: vi.fn().mockResolvedValue([
      {
        id: -1,
        name: 'Ungrouped',
        color: 'grey',
        windowId: 1,
        tabs: [],
        pinnedTabs: [],
        pinnedItems: [],
        temporaryTabs: [
          {
            id: 1,
            title: 'Tab 1',
            url: 'http://a.com',
            pinned: false,
            active: false,
            windowId: 1,
            groupId: -1,
          },
        ],
      },
    ]),
  };
});

import { clearCachedSnapshot, activateTab } from './browser';

describe('activateTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCachedSnapshot();

    // Default mocks
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      id: 123,
      active: false,
      windowId: 1,
      groupId: -1,
    } as chrome.tabs.Tab);
    vi.mocked(chrome.tabs.update).mockResolvedValue({
      id: 123,
      active: true,
    } as chrome.tabs.Tab);
    vi.mocked(chrome.tabs.query).mockResolvedValue([]);
    vi.mocked(chrome.tabGroups.query).mockResolvedValue([]);
    // Mock storage for getSpacesSnapshot > loadSpaceState fallback protection
    vi.mocked(chrome.storage.local.get).mockResolvedValue({});
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
      undefined
    );
  });

  it('should NOT trigger openFloatingUiOnTab if tab activation fails', async () => {
    const tabId = 456;
    const error = new Error('Activation failed');
    vi.mocked(chrome.tabs.update).mockRejectedValue(error);

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
    vi.mocked(chrome.tabs.query).mockResolvedValue(mockTabs);

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
      undefined
    );
  });
});
