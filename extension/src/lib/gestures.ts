export type SwipeDirection = 'left' | 'right';

export interface GestureConfig {
  /** Minimum cumulative delta required to trigger a swipe */
  threshold: number;
  /** Time in ms to reset the accumulator if no events received */
  timeout: number;
  /** Minimum absolute velocity (delta/time) to consider - not fully used in simple accumulator but good for future */
  // minVelocity?: number;
}

const DEFAULT_CONFIG: GestureConfig = {
  threshold: 100, // Reduced sensitivity to avoid accidental triggers? Or increased? 100 is reasonable for trackpad.
  timeout: 300,
};

/**
 * Detects trackpad swipes based on WheelEvent streams.
 * Note: Trackpad 'swipe' generates a series of wheel events with deltaX.
 */
export class SwipeDetector {
  private totalDeltaX = 0;
  private lastEventTime = 0;
  private config: GestureConfig;

  constructor(config: Partial<GestureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  updateConfig(config: Partial<GestureConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Processes a wheel event and returns a direction if a swipe is detected.
   * Returns null if no swipe is detected yet or if resetting.
   */
  process(e: WheelEvent): SwipeDirection | null {
    const now = Date.now();

    // Reset if timeout expired (user stopped swiping)
    if (now - this.lastEventTime > this.config.timeout) {
      this.totalDeltaX = 0;
    }

    this.lastEventTime = now;

    // Ignore vertical scrolling dominant events (optional, but good practice)
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      return null;
    }

    this.totalDeltaX += e.deltaX;

    if (Math.abs(this.totalDeltaX) > this.config.threshold) {
      const direction = this.totalDeltaX > 0 ? 'right' : 'left';
      // deltaX > 0 means "scrolling right" -> showing content on the right.
      // In Space navigation:
      // Swipe Left (Fingers Left) -> deltaX > 0 -> Go to Next Space (Right).
      // Swipe Right (Fingers Right) -> deltaX < 0 -> Go to Previous Space (Left).

      // I'll return 'right' for deltaX > 0 (Movement towards Right Space)
      // and 'left' for deltaX < 0 (Movement towards Left Space).

      this.totalDeltaX = 0; // Reset after trigger to prevent double firing immediately
      return direction;
    }

    return null;
  }

  reset() {
    this.totalDeltaX = 0;
    this.lastEventTime = 0;
  }
}
