import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceSnapshot } from '@/shared/types';
import {
  deriveSpaceStateFromSnapshots,
  loadSpaceState,
  type SpaceState,
  saveSpaceState,
} from './spaces';

// Mock chrome API
const mockChrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
};

global.chrome = mockChrome as any;

describe('spaces service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadSpaceState', () => {
    it('should return empty array if storage is empty', async () => {
      mockChrome.storage.local.get.mockResolvedValue({});
      const result = await loadSpaceState();
      expect(result).toEqual([]);
    });

    it('should return empty array if stored data is not an array', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ spaces: 'invalid-string' });
      const result = await loadSpaceState();
      expect(result).toEqual([]);
    });

    it('should parse and filter valid SpaceState objects', async () => {
      const validState: SpaceState = {
        id: 1,
        name: 'Work',
        color: 'blue',
        spaceBookmarks: [10, 11],
        temporaryTabs: [20, 21],
      };

      const invalidState = {
        id: 'string-id', // Invalid
        name: 'Invalid',
      };

      mockChrome.storage.local.get.mockResolvedValue({
        spaces: [validState, invalidState, null],
      });

      const result = await loadSpaceState();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(validState);
    });

    it('should handle storage errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      mockChrome.storage.local.get.mockRejectedValue(new Error('Storage Error'));

      const result = await loadSpaceState();
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('saveSpaceState', () => {
    it('should save spaces to storage', async () => {
      const spaces: SpaceState[] = [
        {
          id: 1,
          name: 'Test',
          color: 'red',
          spaceBookmarks: [],
          temporaryTabs: [],
        },
      ];

      await saveSpaceState(spaces);

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        spaces: spaces,
      });
    });

    it('should catch errors during save', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      mockChrome.storage.local.set.mockRejectedValue(new Error('Write Failure'));

      await saveSpaceState([]);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('deriveSpaceStateFromSnapshots', () => {
    it('should correctly transform snapshots to state', () => {
      const snapshot: SpaceSnapshot = {
        id: 100,
        name: 'Project',
        color: 'green',
        windowId: 1,
        created_at: 12345,
        last_active_at: 12345,
        pinnedTabs: [
          { id: 1, title: 'Pin1', url: '', pinned: true, active: false, windowId: 1, groupId: 100 },
        ],
        temporaryTabs: [
          {
            id: 2,
            title: 'Temp1',
            url: '',
            pinned: false,
            active: true,
            windowId: 1,
            groupId: 100,
          },
        ],
        tabs: [
          {
            id: 3,
            title: 'Tab3',
            url: '',
            pinned: false,
            active: false,
            windowId: 1,
            groupId: 100,
          },
        ],
      };

      const result = deriveSpaceStateFromSnapshots([snapshot]);

      expect(result).toHaveLength(1);
      const state = result[0];
      expect(state.id).toBe(100);
      expect(state.name).toBe('Project');
      expect(state.color).toBe('green');
      // Check ID mapping
      expect(state.spaceBookmarks).toEqual([1]);
      // temporaryTabs in State should include both temporaryTabs AND standard tabs from Snapshot
      expect(state.temporaryTabs).toContain(2);
      expect(state.temporaryTabs).toContain(3);
      expect(state.temporaryTabs).toHaveLength(2);
    });
  });
});
