import { describe, expect, it } from 'vitest';
import { orderTabsByMru, recordMruTab, removeMruTab, stepSwitcherIndex } from '../tab-switcher';

describe('tab-switcher MRU ordering & selection', () => {
  it('moves activated tab to front without duplicates and removes closed tabs', () => {
    let mru: number[] = [];
    mru = recordMruTab(mru, 1);
    mru = recordMruTab(mru, 2);
    mru = recordMruTab(mru, 3);
    mru = recordMruTab(mru, 1);
    expect(mru).toEqual([1, 3, 2]);
    expect(removeMruTab(mru, 3)).toEqual([1, 2]);
  });

  it('orders open tabs by MRU and appends unseen tabs up to limit', () => {
    const tabs = [
      { id: 10, title: 'A' },
      { id: 20, title: 'B' },
      { id: 30, title: 'C' },
      { id: 40, title: 'D' },
    ];
    const ordered = orderTabsByMru(tabs, [30, 10, 999], 3);
    expect(ordered.map((t) => t.id)).toEqual([30, 10, 20]);
  });

  it('wraps selection index forward and backward cleanly', () => {
    expect(stepSwitcherIndex(0, 1, 5)).toBe(1);
    expect(stepSwitcherIndex(4, 1, 5)).toBe(0);
    expect(stepSwitcherIndex(0, -1, 5)).toBe(4);
    expect(stepSwitcherIndex(0, 1, 0)).toBe(0);
  });
});
