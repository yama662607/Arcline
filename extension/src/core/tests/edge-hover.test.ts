import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdgeHoverMachine } from '../edge-hover';

describe('EdgeHoverMachine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createMachine(overrides = {}) {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const machine = new EdgeHoverMachine(
      {
        enabled: true,
        triggerWidthPx: 6,
        openDelayMs: 90,
        closeDelayMs: 250,
        panelWidthPx: 290,
        ...overrides,
      },
      { onOpen, onClose },
    );
    return { machine, onOpen, onClose };
  }

  it('ignores brief edge grazes shorter than openDelayMs', () => {
    const { machine, onOpen } = createMachine();
    machine.handlePointerMove(2, 0);
    vi.advanceTimersByTime(40);
    machine.handlePointerMove(200, 0);
    vi.advanceTimersByTime(200);
    expect(machine.isOpen).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('opens on deliberate dwell even with stationary duplicate move events', () => {
    const { machine, onOpen } = createMachine();
    machine.handlePointerMove(2, 0);
    vi.advanceTimersByTime(45);
    machine.handlePointerMove(2, 0);
    vi.advanceTimersByTime(50);
    expect(machine.isOpen).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('suppresses opening during mouse-down drag and post-release edge jitter until cursor exits', () => {
    const { machine, onOpen } = createMachine();
    machine.handlePointerMove(400, 1);
    machine.handlePointerMove(2, 1);
    vi.advanceTimersByTime(200);
    expect(machine.isOpen).toBe(false);

    // Release at edge + tiny jitter should NOT reopen until leaving edge first
    machine.handlePointerUp(2);
    machine.handlePointerMove(1, 0);
    vi.advanceTimersByTime(200);
    expect(machine.isOpen).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();

    // Leaving edge re-arms
    machine.handlePointerMove(120, 0);
    machine.handlePointerMove(2, 0);
    vi.advanceTimersByTime(100);
    expect(machine.isOpen).toBe(true);
  });

  it('auto-closes after closeDelayMs unless locked, and dismisses immediately on outside pointerdown', () => {
    const { machine, onClose } = createMachine();
    machine.forceOpen();
    machine.setLocked(true);
    machine.handlePointerMove(500, 0);
    vi.advanceTimersByTime(500);
    expect(machine.isOpen).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    // Explicit outside press closes even while locked
    machine.handleOutsidePointerDown(500);
    expect(machine.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('auto-closes smoothly once unlocked and pointer moves outside panel', () => {
    const { machine, onClose } = createMachine();
    machine.forceOpen();
    machine.handlePointerMove(500, 0);
    vi.advanceTimersByTime(100);
    // Moving back inside cancels close
    machine.handlePointerMove(150, 0);
    vi.advanceTimersByTime(400);
    expect(machine.isOpen).toBe(true);

    machine.handlePointerMove(500, 0);
    vi.advanceTimersByTime(260);
    expect(machine.isOpen).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cancels pending dwell open when pointer leaves document to an adjacent left monitor', () => {
    const { machine, onOpen } = createMachine();
    machine.handlePointerMove(1, 0);
    vi.advanceTimersByTime(40);
    machine.handleDocumentPointerLeave();
    vi.advanceTimersByTime(200);
    expect(machine.isOpen).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
