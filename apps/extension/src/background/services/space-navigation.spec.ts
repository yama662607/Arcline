import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceSnapshot, TabEntry } from '@/shared/types';
import * as browser from './browser';
import * as spaceNavigation from './space-navigation';

// Mock dependencies
vi.mock('./browser', () => ({
  getSpacesSnapshot: vi.fn(),
  broadcastSpacesSnapshot: vi.fn(),
  // We mock these but the test focuses on space-navigation logic
}));

// Mock chrome API
const mockChrome = {
  tabs: {
    query: vi.fn(),
    update: vi.fn(),
    sendMessage: vi.fn(),
  },
  windows: {
    update: vi.fn(),
  },
  runtime: {
    sendMessage: vi.fn(),
    lastError: null,
  },
};
global.chrome = mockChrome as any;

describe('space-navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper to create mock SpaceSnapshot
  const createMockSpace = (id: number, name: string): SpaceSnapshot => ({
    id,
    name,
    color: 'blue',
    windowId: 1,
    created_at: 0,
    last_active_at: 0,
    tabs: [],
    pinnedTabs: [],
    pinnedItems: [],
    temporaryTabs: [],
  });

  const createMockTab = (id: number, spaceId: number): TabEntry => ({
    id,
    title: `Tab ${id}`,
    url: 'http://example.com',
    pinned: false,
    active: false,
    windowId: 1,
    groupId: spaceId,
  });

  describe('navigateSpace', () => {
    it('should return false if there are less than 2 spaces', async () => {
      vi.mocked(browser.getSpacesSnapshot).mockResolvedValue([createMockSpace(1, 'Space 1')]);

      const result = await spaceNavigation.navigateSpace('left');
      expect(result).toBe(false);
    });

    it('should navigate to previous space (looping)', async () => {
      // Setup 3 spaces
      const space1 = createMockSpace(1, 'Space 1');
      const space2 = createMockSpace(2, 'Space 2');
      const space3 = createMockSpace(3, 'Space 3');

      // Add tabs to spaces so they are selectable
      space1.tabs = [createMockTab(101, 1)];
      space2.tabs = [createMockTab(102, 2)];
      space3.tabs = [createMockTab(103, 3)];

      vi.mocked(browser.getSpacesSnapshot).mockResolvedValue([space1, space2, space3]);

      // Mock active tab is in Space 1 (Index 0)
      mockChrome.tabs.query.mockResolvedValue([{ id: 101, groupId: 1, active: true, windowId: 1 }]);
      mockChrome.tabs.update.mockResolvedValue({ id: 103, active: true }); // Target should be Space 3 (Index 2)

      // Execute: Navigate LEFT from Space 1 should go to Space 3
      const result = await spaceNavigation.navigateSpace('left');

      expect(result).toBe(true);

      // Verify activation of tab in Space 3
      expect(mockChrome.tabs.update).toHaveBeenCalledWith(103, { active: true });

      // Verify window focus
      expect(mockChrome.windows.update).toHaveBeenCalledWith(1, { focused: true });

      // Verify Floating UI opening
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        103,
        expect.objectContaining({ command: 'spacesSnapshot' }),
        expect.any(Function)
      );

      // Verify delayed call
      vi.advanceTimersByTime(50);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        103,
        expect.objectContaining({ command: 'openFloatingUiInstantly' }),
        expect.any(Function)
      );
    });

    it('should navigate to next space', async () => {
      // Setup 2 spaces
      const space1 = createMockSpace(1, 'Space 1');
      const space2 = createMockSpace(2, 'Space 2');
      space1.tabs = [createMockTab(101, 1)];
      space2.tabs = [createMockTab(102, 2)];

      vi.mocked(browser.getSpacesSnapshot).mockResolvedValue([space1, space2]);

      // Mock active tab is in Space 1 (Index 0)
      mockChrome.tabs.query.mockResolvedValue([{ id: 101, groupId: 1, active: true, windowId: 1 }]);

      // Execute: Navigate RIGHT from Space 1 should go to Space 2
      const result = await spaceNavigation.navigateSpace('right');

      expect(result).toBe(true);
      expect(mockChrome.tabs.update).toHaveBeenCalledWith(102, { active: true });
    });

    it('should default to first space (index 0) if current space not found', async () => {
      const space1 = createMockSpace(1, 'Space 1');
      const space2 = createMockSpace(2, 'Space 2');
      space1.tabs = [createMockTab(101, 1)];
      space2.tabs = [createMockTab(102, 2)];
      vi.mocked(browser.getSpacesSnapshot).mockResolvedValue([space1, space2]);

      // Active tab is unknown (returns nothing)
      mockChrome.tabs.query.mockResolvedValue([]);

      const result = await spaceNavigation.navigateSpace('right');

      // Should succeed by assuming we are at Index 0, so 'right' goes to Index 1 (Space 2)
      expect(result).toBe(true);
      expect(mockChrome.tabs.update).toHaveBeenCalledWith(102, { active: true });
    });

    it('should fail if target space has no navigable tabs', async () => {
      const space1 = createMockSpace(1, 'Space 1');
      const space2 = createMockSpace(2, 'Space 2');
      space1.tabs = [createMockTab(101, 1)];
      space2.tabs = []; // Empty space

      vi.mocked(browser.getSpacesSnapshot).mockResolvedValue([space1, space2]);

      mockChrome.tabs.query.mockResolvedValue([{ id: 101, groupId: 1, active: true, windowId: 1 }]);

      const result = await spaceNavigation.navigateSpace('right');
      expect(result).toBe(false); // Should fail to navigate
    });
  });

  describe('openFloatingUiOnTab', () => {
    it('should send messages to open UI', async () => {
      const tabId = 999;
      const spaces = [createMockSpace(1, 'S1')];

      await spaceNavigation.openFloatingUiOnTab(tabId, spaces);

      // Immediate call: snapshot
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        { command: 'spacesSnapshot', spaces },
        expect.any(Function)
      );

      // Delayed call: open
      vi.advanceTimersByTime(50);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        tabId,
        { command: 'openFloatingUiInstantly' },
        expect.any(Function)
      );
    });
  });
});
