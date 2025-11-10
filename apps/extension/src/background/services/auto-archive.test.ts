import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveInactiveTabs,
  getAutoArchiveSettings,
  initializeAutoArchive,
  setupAlarmListener,
  setupAutoArchiveAlarm,
  setupTabActivityListeners,
  shouldExcludeFromAutoArchive,
} from './auto-archive';
import { archiveTab, getTabActivity, updateTabLastActivity } from './browser';

// Mock Chrome APIs
const mockChrome = {
  alarms: {
    clear: vi.fn(),
    create: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
    },
  },
  storage: {
    sync: {
      get: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    onActivated: {
      addListener: vi.fn(),
    },
    onUpdated: {
      addListener: vi.fn(),
    },
    onRemoved: {
      addListener: vi.fn(),
    },
  },
};

// Mock browser service functions
vi.mock('./browser', () => ({
  archiveTab: vi.fn(),
  getTabActivity: vi.fn(),
  updateTabLastActivity: vi.fn(),
  removeTabLastActivity: vi.fn(),
}));

// @ts-expect-error - Mocking global chrome
global.chrome = mockChrome;

describe('Auto-Archive Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setupAutoArchiveAlarm', () => {
    it('should create alarm when enabled', async () => {
      mockChrome.alarms.clear.mockResolvedValue(undefined);
      mockChrome.alarms.create.mockResolvedValue(undefined);

      await setupAutoArchiveAlarm(true, 30);

      expect(mockChrome.alarms.clear).toHaveBeenCalledWith('autoArchiveTabsAlarm');
      expect(mockChrome.alarms.create).toHaveBeenCalledWith('autoArchiveTabsAlarm', {
        delayInMinutes: 30,
        periodInMinutes: 30,
      });
    });

    it('should clear alarm when disabled', async () => {
      mockChrome.alarms.clear.mockResolvedValue(undefined);

      await setupAutoArchiveAlarm(false, 30);

      expect(mockChrome.alarms.clear).toHaveBeenCalledWith('autoArchiveTabsAlarm');
      expect(mockChrome.alarms.create).not.toHaveBeenCalled();
    });

    it('should use minimum 1 minute interval', async () => {
      mockChrome.alarms.clear.mockResolvedValue(undefined);
      mockChrome.alarms.create.mockResolvedValue(undefined);

      await setupAutoArchiveAlarm(true, 0.5); // Use 0.5 instead of 0 to trigger creation

      expect(mockChrome.alarms.create).toHaveBeenCalledWith('autoArchiveTabsAlarm', {
        delayInMinutes: 1, // Should be rounded up to 1
        periodInMinutes: 1,
      });
    });
  });

  describe('shouldExcludeFromAutoArchive', () => {
    it('should exclude pinned tabs', () => {
      const pinnedTab = {
        id: 1,
        pinned: true,
        active: false,
        url: 'https://example.com',
        audible: false,
      };

      expect(shouldExcludeFromAutoArchive(pinnedTab as chrome.tabs.Tab)).toBe(true);
    });

    it('should exclude active tabs', () => {
      const activeTab = {
        id: 1,
        pinned: false,
        active: true,
        url: 'https://example.com',
        audible: false,
      };

      expect(shouldExcludeFromAutoArchive(activeTab as chrome.tabs.Tab)).toBe(true);
    });

    it('should exclude Chrome internal pages', () => {
      const chromeTab = {
        id: 1,
        pinned: false,
        active: false,
        url: 'chrome://settings',
        audible: false,
      };

      expect(shouldExcludeFromAutoArchive(chromeTab as chrome.tabs.Tab)).toBe(true);
    });

    it('should exclude extension pages', () => {
      const extensionTab = {
        id: 1,
        pinned: false,
        active: false,
        url: 'chrome-extension://test/popup.html',
        audible: false,
      };

      expect(shouldExcludeFromAutoArchive(extensionTab as chrome.tabs.Tab)).toBe(true);
    });

    it('should exclude audible tabs', () => {
      const audibleTab = {
        id: 1,
        pinned: false,
        active: false,
        url: 'https://youtube.com',
        audible: true,
      };

      expect(shouldExcludeFromAutoArchive(audibleTab as chrome.tabs.Tab)).toBe(true);
    });

    it('should not exclude regular inactive tabs', () => {
      const regularTab = {
        id: 1,
        pinned: false,
        active: false,
        url: 'https://example.com',
        audible: false,
      };

      expect(shouldExcludeFromAutoArchive(regularTab as chrome.tabs.Tab)).toBe(false);
    });
  });

  describe('archiveInactiveTabs', () => {
    it('should archive tabs inactive beyond threshold', async () => {
      const currentTime = Date.now();
      const idleThreshold = 30 * 60 * 1000; // 30 minutes

      const mockTabs = [
        {
          id: 1,
          pinned: false,
          active: false,
          url: 'https://example.com',
          audible: false,
        },
        {
          id: 2,
          pinned: false,
          active: false,
          url: 'https://test.com',
          audible: false,
        },
      ];

      const mockTabActivity = {
        1: currentTime - idleThreshold - 1000, // Inactive
        2: currentTime - 1000, // Recently active
      };

      mockChrome.tabs.query.mockResolvedValue(mockTabs as chrome.tabs.Tab[]);
      vi.mocked(getTabActivity).mockResolvedValue(mockTabActivity);
      vi.mocked(archiveTab).mockResolvedValue(undefined);

      const archivedCount = await archiveInactiveTabs(mockTabActivity, currentTime, idleThreshold);

      expect(archivedCount).toBe(1);
      expect(archiveTab).toHaveBeenCalledWith(1);
    });

    it('should not archive excluded tabs', async () => {
      const currentTime = Date.now();
      const idleThreshold = 30 * 60 * 1000;

      const mockTabs = [
        {
          id: 1,
          pinned: true, // Excluded
          active: false,
          url: 'https://example.com',
          audible: false,
        },
        {
          id: 2,
          pinned: false,
          active: true, // Excluded
          url: 'https://test.com',
          audible: false,
        },
      ];

      const mockTabActivity = {
        1: currentTime - idleThreshold - 1000,
        2: currentTime - idleThreshold - 1000,
      };

      mockChrome.tabs.query.mockResolvedValue(mockTabs as chrome.tabs.Tab[]);
      vi.mocked(getTabActivity).mockResolvedValue(mockTabActivity);
      vi.mocked(archiveTab).mockResolvedValue(undefined);

      const archivedCount = await archiveInactiveTabs(mockTabActivity, currentTime, idleThreshold);

      expect(archivedCount).toBe(0);
      expect(archiveTab).not.toHaveBeenCalled();
    });
  });

  describe('getAutoArchiveSettings', () => {
    it('should return default settings when none stored', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({});

      const settings = await getAutoArchiveSettings();

      expect(settings).toEqual({
        enabled: false,
        idleMinutes: 30,
      });
    });

    it('should return stored settings', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        autoArchiveEnabled: true,
        autoArchiveIdleMinutes: 60,
      });

      const settings = await getAutoArchiveSettings();

      expect(settings).toEqual({
        enabled: true,
        idleMinutes: 60,
      });
    });

    it('should handle boolean conversion for enabled setting', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        autoArchiveEnabled: 'true', // String truthy value
        autoArchiveIdleMinutes: 45,
      });

      const settings = await getAutoArchiveSettings();

      expect(settings.enabled).toBe(true);
      expect(settings.idleMinutes).toBe(45);
    });
  });

  describe('setupTabActivityListeners', () => {
    it('should set up tab activity listeners', () => {
      setupTabActivityListeners();

      expect(mockChrome.tabs.onActivated.addListener).toHaveBeenCalled();
      expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(mockChrome.tabs.onRemoved.addListener).toHaveBeenCalled();
    });
  });

  describe('setupAlarmListener', () => {
    it('should set up alarm listener', () => {
      setupAlarmListener();

      expect(mockChrome.alarms.onAlarm.addListener).toHaveBeenCalled();
    });
  });

  describe('initializeAutoArchive', () => {
    it('should initialize auto-archive functionality', async () => {
      const mockTabs = [
        {
          id: 1,
          active: true,
        },
        {
          id: 2,
          active: false,
        },
      ];

      mockChrome.tabs.query.mockResolvedValue(mockTabs as chrome.tabs.Tab[]);
      mockChrome.storage.sync.get.mockResolvedValue({
        autoArchiveEnabled: true,
        autoArchiveIdleMinutes: 30,
      });
      mockChrome.alarms.clear.mockResolvedValue(undefined);
      mockChrome.alarms.create.mockResolvedValue(undefined);

      vi.mocked(updateTabLastActivity).mockResolvedValue(undefined);

      await initializeAutoArchive();

      expect(mockChrome.tabs.query).toHaveBeenCalled();
      expect(updateTabLastActivity).toHaveBeenCalledWith(1); // Only active tab
      expect(mockChrome.alarms.create).toHaveBeenCalledWith('autoArchiveTabsAlarm', {
        delayInMinutes: 30,
        periodInMinutes: 30,
      });
    });

    it('should handle initialization errors gracefully', async () => {
      mockChrome.tabs.query.mockRejectedValue(new Error('Chrome API error'));

      await expect(initializeAutoArchive()).resolves.not.toThrow();
    });
  });
});
