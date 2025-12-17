import { describe, expect, it } from 'vitest';
import { SwipeDetector } from './gestures';

describe('SwipeDetector', () => {
    const createWheelEvent = (deltaX: number, deltaY = 0) => {
        return { deltaX, deltaY } as WheelEvent;
    };

    it('should detect right swipe (deltaX > threshold)', () => {
        const detector = new SwipeDetector({ threshold: 50 });

        // Accumulate
        expect(detector.process(createWheelEvent(20))).toBeNull();
        expect(detector.process(createWheelEvent(20))).toBeNull();
        // Trigger
        expect(detector.process(createWheelEvent(20))).toBe('right');
    });

    it('should detect left swipe (deltaX < -threshold)', () => {
        const detector = new SwipeDetector({ threshold: 50 });

        expect(detector.process(createWheelEvent(-30))).toBeNull();
        expect(detector.process(createWheelEvent(-30))).toBe('left');
    });

    it('should reset after timeout', async () => {
        const detector = new SwipeDetector({ threshold: 50, timeout: 50 });

        expect(detector.process(createWheelEvent(30))).toBeNull();

        // Wait for timeout
        await new Promise(resolve => setTimeout(resolve, 60));

        // Should start fresh (total was 30, now 0. +30 = 30 < 50)
        expect(detector.process(createWheelEvent(30))).toBeNull();
        // +30 = 60 > 50
        expect(detector.process(createWheelEvent(30))).toBe('right');
    });

    it('should ignore vertical dominant scroll', () => {
        const detector = new SwipeDetector({ threshold: 50 });

        // deltaY >> deltaX
        expect(detector.process(createWheelEvent(10, 50))).toBeNull();
        expect(detector.process(createWheelEvent(10, 50))).toBeNull();
        expect(detector.process(createWheelEvent(10, 50))).toBeNull(); // Total deltaX would be 30

        // Even if we add pure horizontal now
        expect(detector.process(createWheelEvent(10))).toBeNull(); // Total 10 (Verticals were ignored)
        expect(detector.process(createWheelEvent(41))).toBe('right'); // Total 51 > 50
    });

    it('should auto-reset after trigger', () => {
        const detector = new SwipeDetector({ threshold: 50 });
        expect(detector.process(createWheelEvent(60))).toBe('right');
        // Immediate next event shouldn't trigger unless it crosses threshold AGAIN
        expect(detector.process(createWheelEvent(10))).toBeNull();
    });

    it('should update config dynamically', () => {
        const detector = new SwipeDetector({ threshold: 50 });
        expect(detector.process(createWheelEvent(30))).toBeNull();

        // Increase threshold
        detector.updateConfig({ threshold: 100 });

        // +30 = 60. > 50 but < 100. Should NOT trigger.
        expect(detector.process(createWheelEvent(30))).toBeNull();

        // +50 = 110 > 100. Trigger.
        expect(detector.process(createWheelEvent(50))).toBe('right');
    });
});
