export type SwipeDirection = -1 | 1;

export interface SpaceSwipeSnapshot {
  /** Horizontal visual displacement in px (negative = swiping toward next Space). */
  offset: number;
  /** True while user fingers are actively dragging horizontally. */
  dragging: boolean;
  /** Normalized progress in [-1, 1] relative to panel width (positive = next, negative = prev). */
  progress: number;
  /** Target direction being previewed (-1 prev, 1 next, 0 idle). */
  direction: -1 | 0 | 1;
}

export interface SpaceSwipeOptions {
  /** Fraction of panel width that commits a Space switch mid-gesture. */
  commitRatio?: number;
  /** Fraction of panel width that commits when the gesture finishes. */
  releaseRatio?: number;
  /** Idle time (ms) after the last wheel event before ending the gesture & swallowing momentum. */
  gestureEndMs?: number;
  /** Rubber-band multiplier when swiping past the first or last Space. */
  edgeResistance?: number;
  /** Minimum horizontal/vertical ratio before capturing a horizontal swipe. */
  axisRatio?: number;
  canGo: (direction: SwipeDirection) => boolean;
  onCommit: (direction: SwipeDirection) => void;
  onChange?: (snapshot: SpaceSwipeSnapshot) => void;
}

const DEFAULT_COMMIT_RATIO = 0.24;
const DEFAULT_RELEASE_RATIO = 0.12;
const DEFAULT_GESTURE_END_MS = 120;
const DEFAULT_EDGE_RESISTANCE = 0.22;
const DEFAULT_AXIS_RATIO = 1.15;

/**
 * Pure deterministic two-finger horizontal trackpad pager for switching Spaces.
 *
 * Prevents browser history Back/Forward conflicts (when paired with `overscroll-behavior-x: none`
 * and non-passive `wheel` + `preventDefault()`) and swallows macOS trackpad inertia in the SAME
 * direction, while immediately unlocking when the user intentionally reverses direction (or starts
 * a strong fresh impulse after momentum decays) so rapid back-and-forth Space swiping works
 * smoothly without moving the cursor.
 */
export class SpaceSwipeMachine {
  private offset = 0;
  private dragging = false;
  private spent = false;
  private spentDirection: SwipeDirection | 0 = 0;
  private minSpentDeltaX = Number.POSITIVE_INFINITY;
  private width = 290;
  private enabled = true;
  private endTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly commitRatio: number;
  private readonly releaseRatio: number;
  private readonly gestureEndMs: number;
  private readonly edgeResistance: number;
  private readonly axisRatio: number;

  constructor(private options: SpaceSwipeOptions) {
    this.commitRatio = options.commitRatio ?? DEFAULT_COMMIT_RATIO;
    this.releaseRatio = options.releaseRatio ?? DEFAULT_RELEASE_RATIO;
    this.gestureEndMs = options.gestureEndMs ?? DEFAULT_GESTURE_END_MS;
    this.edgeResistance = options.edgeResistance ?? DEFAULT_EDGE_RESISTANCE;
    this.axisRatio = options.axisRatio ?? DEFAULT_AXIS_RATIO;
  }

  setWidth(width: number): void {
    if (Number.isFinite(width) && width > 40) {
      this.width = width;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  getSnapshot(): SpaceSwipeSnapshot {
    const progress = Math.max(-1, Math.min(1, -this.offset / this.width));
    const direction: -1 | 0 | 1 = this.offset > 2 ? -1 : this.offset < -2 ? 1 : 0;
    return {
      offset: this.offset,
      dragging: this.dragging,
      progress,
      direction,
    };
  }

  /**
   * Process a wheel delta sample.
   * Returns `true` if the event was consumed as a horizontal Space swipe (caller should `preventDefault()`).
   */
  handleWheel(deltaX: number, deltaY: number, ctrlKey = false): boolean {
    if (!this.enabled || ctrlKey) return false;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absX === 0 && !this.dragging && !this.spent) return false;

    const horizontal = absX > absY * this.axisRatio;
    if (!horizontal && !this.dragging && !this.spent) {
      return false;
    }

    // Consume the wheel event so Chromium never escalates it to Back/Forward history navigation.
    if (this.endTimer !== undefined) clearTimeout(this.endTimer);
    this.endTimer = setTimeout(() => this.finishGesture(), this.gestureEndMs);

    if (this.spent) {
      const sampleDir: SwipeDirection | 0 = deltaX > 0 ? 1 : deltaX < 0 ? -1 : 0;
      const reversed = sampleDir !== 0 && sampleDir !== this.spentDirection && absX >= 5;
      const freshImpulseSameDir =
        sampleDir === this.spentDirection &&
        this.minSpentDeltaX <= 8 &&
        absX >= Math.max(24, this.minSpentDeltaX * 3);

      if (!reversed && !freshImpulseSameDir) {
        if (absX > 0 && absX < this.minSpentDeltaX) {
          this.minSpentDeltaX = absX;
        }
        // Swallow trailing macOS trackpad momentum from the already-committed swipe.
        return true;
      }

      // User intentionally reversed direction (or started a brand-new swipe): unlock immediately!
      this.spent = false;
      this.spentDirection = 0;
      this.minSpentDeltaX = Number.POSITIVE_INFINITY;
    }

    const step = -deltaX;
    const candidate = this.offset + step;
    const direction: SwipeDirection = candidate > 0 ? -1 : 1;
    const allowed = this.options.canGo(direction);

    this.dragging = true;
    const next = this.offset + (allowed ? step : step * this.edgeResistance);
    const maxTravel = allowed ? this.width * 0.55 : this.width * 0.16;
    this.offset = Math.max(-maxTravel, Math.min(maxTravel, next));
    this.emit();

    if (allowed && Math.abs(this.offset) >= this.width * this.commitRatio) {
      this.spent = true;
      this.spentDirection = direction;
      this.minSpentDeltaX = absX;
      this.commit(direction);
    }
    return true;
  }

  reset(): void {
    if (this.endTimer !== undefined) {
      clearTimeout(this.endTimer);
      this.endTimer = undefined;
    }
    const changed = this.offset !== 0 || this.dragging;
    this.offset = 0;
    this.dragging = false;
    this.spent = false;
    this.spentDirection = 0;
    this.minSpentDeltaX = Number.POSITIVE_INFINITY;
    if (changed) this.emit();
  }

  dispose(): void {
    if (this.endTimer !== undefined) {
      clearTimeout(this.endTimer);
      this.endTimer = undefined;
    }
  }

  private finishGesture(): void {
    this.endTimer = undefined;
    if (!this.spent && this.dragging) {
      const direction: SwipeDirection = this.offset > 0 ? -1 : 1;
      const farEnough = Math.abs(this.offset) >= this.width * this.releaseRatio;
      if (farEnough && this.options.canGo(direction)) {
        this.commit(direction);
        this.spent = false;
        this.spentDirection = 0;
        this.minSpentDeltaX = Number.POSITIVE_INFINITY;
        return;
      }
    }
    const changed = this.offset !== 0 || this.dragging;
    this.offset = 0;
    this.dragging = false;
    this.spent = false;
    this.spentDirection = 0;
    this.minSpentDeltaX = Number.POSITIVE_INFINITY;
    if (changed) this.emit();
  }

  private commit(direction: SwipeDirection): void {
    this.dragging = false;
    this.offset = 0;
    this.emit();
    this.options.onCommit(direction);
  }

  private emit(): void {
    this.options.onChange?.(this.getSnapshot());
  }
}
