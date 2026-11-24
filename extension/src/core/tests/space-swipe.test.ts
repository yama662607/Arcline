import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpaceSwipeMachine } from '../space-swipe';

describe('SpaceSwipeMachine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ignores vertical scrolling and pinch-zoom wheel events', () => {
    const onCommit = vi.fn();
    const machine = new SpaceSwipeMachine({
      canGo: () => true,
      onCommit,
    });
    machine.setWidth(300);

    expect(machine.handleWheel(5, 40, false)).toBe(false);
    expect(machine.handleWheel(80, 0, true)).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits once per horizontal swipe and swallows trailing trackpad momentum', () => {
    const onCommit = vi.fn();
    const machine = new SpaceSwipeMachine({
      canGo: () => true,
      onCommit,
    });
    machine.setWidth(300);

    // Swipe toward next Space (positive deltaX) past 26% threshold (78px)
    expect(machine.handleWheel(45, 2)).toBe(true);
    expect(onCommit).not.toHaveBeenCalled();
    expect(machine.handleWheel(45, 1)).toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(1);

    // Trailing macOS trackpad inertia in the SAME direction must be swallowed (no second switch)
    expect(machine.handleWheel(60, 0)).toBe(true);
    expect(machine.handleWheel(40, 0)).toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);

    // Immediate reverse swipe (0ms wait!) must unlock immediately and switch back
    expect(machine.handleWheel(-45, 0)).toBe(true);
    expect(machine.handleWheel(-45, 0)).toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit).toHaveBeenLastCalledWith(-1);
  });

  it('commits on release if past releaseRatio, and snaps back if below', () => {
    const onCommit = vi.fn();
    const machine = new SpaceSwipeMachine({
      canGo: () => true,
      onCommit,
    });
    machine.setWidth(300);

    // Too small (20px < 13% of 300 = 39px) -> snaps back without switching
    machine.handleWheel(20, 0);
    vi.advanceTimersByTime(160);
    expect(onCommit).not.toHaveBeenCalled();
    expect(machine.getSnapshot().offset).toBe(0);

    // Moderate flick (50px >= 39px, < 78px) -> commits on release
    machine.handleWheel(50, 0);
    expect(onCommit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(160);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(1);
  });

  it('applies rubber-band resistance and never commits beyond first or last Space', () => {
    const onCommit = vi.fn();
    const machine = new SpaceSwipeMachine({
      canGo: (dir) => dir === 1,
      onCommit,
    });
    machine.setWidth(300);

    // Swiping left (dir = -1) at first Space is resisted and never commits
    expect(machine.handleWheel(-150, 0)).toBe(true);
    expect(machine.getSnapshot().offset).toBeLessThanOrEqual(300 * 0.16);
    vi.advanceTimersByTime(160);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
