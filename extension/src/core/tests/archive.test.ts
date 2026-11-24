import { describe, expect, it } from 'vitest';
import { mergeArchive, selectTabsToArchive } from '../archive';
import { NO_GROUP } from '../snapshot';

describe('archive', () => {
  const HOUR = 60 * 60 * 1000;
  const NOW = 1_700_000_000_000;

  it('selects only idle unbound non-active non-pinned non-audible http tabs', () => {
    const stale = selectTabsToArchive({
      tabs: [
        { id: 1, url: 'https://stale.example.com', groupId: 10 },
        { id: 2, url: 'https://active.example.com', active: true, groupId: 10 },
        { id: 3, url: 'https://pinned.example.com', pinned: true, groupId: NO_GROUP },
        { id: 4, url: 'https://bound.example.com', groupId: 10 },
        { id: 5, url: 'https://music.example.com', audible: true, groupId: 10 },
        { id: 6, url: 'chrome://settings', groupId: 10 },
        { id: 7, url: 'https://fresh.example.com', groupId: 10 },
      ],
      bindings: { 4: { kind: 'pin', id: 'bm-4' } },
      activity: {
        1: NOW - 25 * HOUR,
        2: NOW - 25 * HOUR,
        3: NOW - 25 * HOUR,
        4: NOW - 25 * HOUR,
        5: NOW - 25 * HOUR,
        6: NOW - 25 * HOUR,
        7: NOW - 2 * HOUR,
      },
      nowMs: NOW,
      thresholdHours: 24,
    });

    expect(stale.map((t) => t.id)).toEqual([1]);
  });

  it('returns empty when thresholdHours is 0 (disabled)', () => {
    const stale = selectTabsToArchive({
      tabs: [{ id: 1, url: 'https://stale.example.com', groupId: 10 }],
      bindings: {},
      activity: { 1: 0 },
      nowMs: NOW,
      thresholdHours: 0,
    });
    expect(stale).toEqual([]);
  });

  it('deduplicates by URL and caps archive size', () => {
    const merged = mergeArchive(
      [
        { id: 'old-1', url: 'https://a.example', title: 'A old', spaceName: 'Main', archivedAt: 1 },
        { id: 'old-2', url: 'https://b.example', title: 'B', spaceName: 'Main', archivedAt: 2 },
      ],
      [{ id: 'new-1', url: 'https://a.example', title: 'A new', spaceName: 'Work', archivedAt: 3 }],
      2,
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]?.id).toBe('new-1');
    expect(merged[1]?.id).toBe('old-2');
  });
});
