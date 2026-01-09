import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTwoFingerTap } from './use-two-finger-tap';

describe('useTwoFingerTap', () => {
  it('should return a ref', () => {
    const onTap = vi.fn();
    const { result } = renderHook(() => useTwoFingerTap({ onTap }));

    expect(result.current).toBeDefined();
    expect(result.current.current).toBeNull();
  });

  it('should have correct initial state when disabled', () => {
    const onTap = vi.fn();
    const { result } = renderHook(() =>
      useTwoFingerTap({
        onTap,
        disabled: true,
      })
    );

    expect(result.current).toBeDefined();
    expect(result.current.current).toBeNull();
  });

  it('should accept custom maxTapDuration', () => {
    const onTap = vi.fn();
    const { result } = renderHook(() =>
      useTwoFingerTap({
        onTap,
        maxTapDuration: 100,
      })
    );

    expect(result.current).toBeDefined();
  });

  it('should accept custom maxMovement', () => {
    const onTap = vi.fn();
    const { result } = renderHook(() =>
      useTwoFingerTap({
        onTap,
        maxMovement: 5,
      })
    );

    expect(result.current).toBeDefined();
  });

  it('should return new ref on each render but maintain same instance', () => {
    const onTap = vi.fn();
    const { result, rerender } = renderHook(() => useTwoFingerTap({ onTap }));

    const firstRef = result.current;
    rerender();
    const secondRef = result.current;

    // The ref object itself should be the same (stable reference)
    expect(firstRef).toBe(secondRef);
  });
});

describe('useTwoFingerTap options', () => {
  it('should accept all options', () => {
    const onTap = vi.fn();
    const { result } = renderHook(() =>
      useTwoFingerTap({
        onTap,
        disabled: false,
        maxTapDuration: 200,
        maxMovement: 15,
      })
    );

    expect(result.current).toBeDefined();
  });

  it('should return stable ref across rerenders with same options', () => {
    const onTap = vi.fn();
    const options = {
      onTap,
      disabled: false,
      maxTapDuration: 300,
      maxMovement: 10,
    };

    const { result, rerender } = renderHook(() => useTwoFingerTap(options));

    const firstRef = result.current;
    rerender();

    expect(result.current).toBe(firstRef);
  });
});
