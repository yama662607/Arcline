import { describe, expect, it } from 'vitest';

import { __lockIntent, __shouldCommitSwipe } from './floating-gestures';

describe('floating-gestures intent lock', () => {
  it('locks horizontal when accumulatedX dominates and exceeds threshold', () => {
    // deltaX, deltaY, accumulatedX, accumulatedY
    expect(__lockIntent(20, 2, 20, 2)).toBe('horizontal');
  });

  it('locks vertical when accumulatedY dominates and exceeds threshold', () => {
    expect(__lockIntent(2, 18, 2, 18)).toBe('vertical');
  });

  it('returns null when below intensity threshold even if dominant', () => {
    expect(__lockIntent(4, 1, 4, 1)).toBeNull();
  });

  it('returns null for low-noise vectors', () => {
    expect(__lockIntent(1, 1, 1, 1)).toBeNull();
  });
});

describe('floating-gestures commit decision', () => {
  it('treats non-zero velocity as flick', () => {
    expect(__shouldCommitSwipe(0.1, 0.5)).toBe('flick');
  });

  it('commits handoff at 50% progress with zero velocity', () => {
    expect(__shouldCommitSwipe(0.5, 0)).toBe('handoff');
  });

  it('cancels when below threshold with zero velocity', () => {
    expect(__shouldCommitSwipe(0.3, 0)).toBe('cancel');
  });
});
