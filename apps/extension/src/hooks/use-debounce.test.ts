import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from './use-debounce';

describe('useDebounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('initial', 500));
        expect(result.current).toBe('initial');
    });

    it('should debounce value updates', () => {
        const { result, rerender } = renderHook(({ value }) => useDebounce(value, 500), {
            initialProps: { value: 'initial' },
        });

        rerender({ value: 'updated' });

        // Should still be initial immediately
        expect(result.current).toBe('initial');

        // Fast-forward time
        act(() => {
            vi.advanceTimersByTime(250);
        });
        expect(result.current).toBe('initial');

        // Finish the wait
        act(() => {
            vi.advanceTimersByTime(250);
        });
        expect(result.current).toBe('updated');
    });

    it('should cancel previous timer on new update', () => {
        const { result, rerender } = renderHook(({ value }) => useDebounce(value, 500), {
            initialProps: { value: 'initial' },
        });

        rerender({ value: 'update1' });

        act(() => {
            vi.advanceTimersByTime(250);
        });

        // Update again before timer finishes
        rerender({ value: 'update2' });

        act(() => {
            vi.advanceTimersByTime(300); // 250 + 300 = 550 from start, but only 300 from update2
        });

        // Should not represent update1 (cancelled)
        // And 300ms is not enough for 500ms delay of update2
        expect(result.current).toBe('initial');

        act(() => {
            vi.advanceTimersByTime(200);
        });
        expect(result.current).toBe('update2');
    });
});
