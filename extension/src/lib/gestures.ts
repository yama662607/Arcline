export type SwipeDirection = 'left' | 'right';

export interface GestureConfig {
  /** Minimum cumulative delta required to trigger a swipe */
  threshold: number;
  /** Time in ms to reset the accumulator if no events received */
  timeout: number;
  /** Cooldown in ms after a swipe is detected to prevent re-triggering */
  cooldown: number;
}

const DEFAULT_CONFIG: GestureConfig = {
  threshold: 50, // Lower threshold for better responsiveness (legacy used 25 for single event)
  timeout: 300,
  cooldown: 400, // Cooldown to prevent re-triggering during the same gesture (legacy used 400ms)
};

/**
 * Detects trackpad swipes based on WheelEvent streams.
 * Note: Trackpad 'swipe' generates a series of wheel events with deltaX.
 */
export class SwipeDetector {
  private totalDeltaX = 0;
  private lastEventTime = 0;
  private config: GestureConfig;
  private isSwiping = false;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<GestureConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  updateConfig(config: Partial<GestureConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Processes a wheel event and returns a direction if a swipe is detected.
   * Returns null if no swipe is detected yet, during cooldown, or if resetting.
   */
  process(e: WheelEvent): SwipeDirection | null {
    // Block during cooldown to prevent re-triggering
    if (this.isSwiping) {
      return null;
    }

    const now = Date.now();

    // Reset if timeout expired (user stopped swiping)
    if (now - this.lastEventTime > this.config.timeout) {
      this.totalDeltaX = 0;
    }

    this.lastEventTime = now;

    // Ignore vertical scrolling dominant events
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      return null;
    }

    this.totalDeltaX += e.deltaX;

    if (Math.abs(this.totalDeltaX) > this.config.threshold) {
      // deltaX > 0 means "scrolling right" -> Go to Next Space (Right).
      // deltaX < 0 means "scrolling left" -> Go to Previous Space (Left).
      const direction: SwipeDirection = this.totalDeltaX > 0 ? 'right' : 'left';

      // Reset accumulator and start cooldown
      this.totalDeltaX = 0;
      this.startCooldown();

      return direction;
    }

    return null;
  }

  private startCooldown() {
    this.isSwiping = true;
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
    }
    this.cooldownTimer = setTimeout(() => {
      this.isSwiping = false;
      this.cooldownTimer = null;
    }, this.config.cooldown);
  }

  reset() {
    this.totalDeltaX = 0;
    this.lastEventTime = 0;
    this.isSwiping = false;
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  /**
   * Get current accumulated delta X for UI feedback
   */
  getCurrentDelta(): number {
    return this.totalDeltaX;
  }
}
