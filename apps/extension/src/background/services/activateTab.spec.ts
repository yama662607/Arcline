import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activateTab } from './browser';
import * as spaceNavigation from './space-navigation';

// Mock chrome API
const mockChrome = {
  tabs: {
    get: vi.fn(),
    update: vi.fn(),
    query: vi.fn(),
  },
  tabGroups: {
    query: vi.fn(),
  },
  storage: {
    sync: {
      get: vi.fn(),
    },
    local: {
      get: vi.fn(), // for loadSpaceState fallback
      set: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
  },
};

globalThis.chrome = mockChrome as unknown as typeof chrome;

// Mock dependencies
vi.mock('./space-navigation', () => ({
  openFloatingUiOnTab: vi.fn(),
}));

describe('activateTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockChrome.tabs.get.mockResolvedValue({
      id: 123,
      active: false,
      windowId: 1,
      groupId: -1,
    });
    mockChrome.tabs.update.mockResolvedValue({
      id: 123,
      active: true,
    });
    mockChrome.tabs.query.mockResolvedValue([]);
    mockChrome.tabGroups.query.mockResolvedValue([]);
    // Mock storage for getSpacesSnapshot > loadSpaceState fallback protection
    mockChrome.storage.local.get.mockResolvedValue({});
  });

  it('should activate the tab and then trigger openFloatingUiOnTab', async () => {
    const tabId = 123;
    await activateTab(tabId);

    // Verify tab activation
    expect(mockChrome.tabs.update).toHaveBeenCalledWith(tabId, { active: true });
    // Verify openFloatingUiOnTab is called
    expect(spaceNavigation.openFloatingUiOnTab).toHaveBeenCalledWith(tabId, expect.any(Array));
  });

  it('should NOT trigger openFloatingUiOnTab if tab activation fails', async () => {
    const tabId = 456;
    const error = new Error('Activation failed');
    mockChrome.tabs.update.mockRejectedValue(error);

    await expect(activateTab(tabId)).rejects.toThrow('Activation failed');

    expect(mockChrome.tabs.update).toHaveBeenCalledWith(tabId, { active: true });
    expect(spaceNavigation.openFloatingUiOnTab).not.toHaveBeenCalled();
  });

  it('should NOT fail overall if openFloatingUiOnTab fails (Graceful Degradation)', async () => {
    const tabId = 789;
    const consoleSpy = vi.spyOn(console, 'warn');
    // Setup openFloatingUiOnTab to fail
    vi.mocked(spaceNavigation.openFloatingUiOnTab).mockRejectedValue(new Error('UI Open Failed'));

    // Should NOT throw
    await activateTab(tabId);

    expect(mockChrome.tabs.update).toHaveBeenCalledWith(tabId, { active: true });
    expect(spaceNavigation.openFloatingUiOnTab).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to open floating UI'),
      expect.any(Error)
    );
  });

  it('should pass correct spaces snapshot data to floating UI', async () => {
    const tabId = 101;
    // Mock data for snapshot
    const mockTabs = [{ id: 1, title: 'Tab 1', url: 'http://a.com', groupId: -1 }];
    mockChrome.tabs.query.mockResolvedValue(mockTabs);

    await activateTab(tabId);

    expect(spaceNavigation.openFloatingUiOnTab).toHaveBeenCalledWith(
      tabId,
      expect.arrayContaining([
        expect.objectContaining({
          id: -1, // ungrouped
          temporaryTabs: expect.arrayContaining([
            expect.objectContaining({ id: 1, title: 'Tab 1' }),
          ]),
        }),
      ])
    );
  });
});
