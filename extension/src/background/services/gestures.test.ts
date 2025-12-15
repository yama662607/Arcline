import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GestureSettings } from '@/shared/gestures';
import {
  __resetGestureListenersForTests,
  DEFAULT_GESTURE_SETTINGS,
  evaluateSwipe,
  type GestureDetectionResult,
  getGestureSettings,
  initializeGestureDetection,
  type SwipeSample,
  saveGestureSettings,
  subscribeToSwipe,
} from './gestures';

const createSample = (overrides: Partial<SwipeSample> = {}): SwipeSample => ({
  startX: 0,
  startY: 0,
  endX: 200,
  endY: 10,
  durationMs: 150,
  timestamp: Date.now(),
  pointerType: 'touch',
  ...overrides,
});

type ChromeMock = {
  storage: {
    local: {
      get: Mock;
      set: Mock;
    };
  };
  runtime: {
    onMessage: {
      addListener: Mock;
    };
  };
};

const getChromeMock = () => globalThis.chrome as unknown as ChromeMock;

describe('gestures service', () => {
  beforeEach(() => {
    __resetGestureListenersForTests();
    (globalThis as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn(),
        },
      },
    } as unknown;

    initializeGestureDetection();
  });

  describe('evaluateSwipe', () => {
    it('returns null when gestures are disabled', () => {
      const result = evaluateSwipe(createSample(), { ...DEFAULT_GESTURE_SETTINGS, enabled: false });
      expect(result).toBeNull();
    });

    it('detects left swipe when deltaX is negative', () => {
      const result = evaluateSwipe(createSample({ endX: -200 }), DEFAULT_GESTURE_SETTINGS);
      expect(result?.direction).toBe('left');
      expect(result?.distance).toBeGreaterThan(0);
      expect(result?.velocity).toBeGreaterThan(0);
    });

    it('filters vertical dominant gestures', () => {
      const result = evaluateSwipe(createSample({ endX: 40, endY: 400 }), DEFAULT_GESTURE_SETTINGS);
      expect(result).toBeNull();
    });

    it('rejects gestures below distance threshold', () => {
      const result = evaluateSwipe(createSample({ endX: 20 }), DEFAULT_GESTURE_SETTINGS);
      expect(result).toBeNull();
    });
  });

  describe('gesture settings storage', () => {
    it('returns defaults when storage is empty', async () => {
      const settings = await getGestureSettings();
      expect(settings).toEqual(DEFAULT_GESTURE_SETTINGS);
      expect(getChromeMock().storage.local.get).toHaveBeenCalledWith('arclineGestureSettings');
    });

    it('merges and persists next settings', async () => {
      const merged = await saveGestureSettings({
        sensitivity: 'high',
      } satisfies Partial<GestureSettings>);
      expect(getChromeMock().storage.local.set).toHaveBeenCalledWith({
        arclineGestureSettings: merged,
      });
      expect(merged.sensitivity).toBe('high');
      expect(merged.distanceThreshold).toBeLessThanOrEqual(
        DEFAULT_GESTURE_SETTINGS.distanceThreshold
      );
    });
  });

  describe('subscribeToSwipe', () => {
    it('invokes listeners when swipe detected', async () => {
      const spy = vi.fn();
      subscribeToSwipe(spy);

      const addListenerMock = getChromeMock().runtime.onMessage.addListener;
      const listener = addListenerMock.mock.calls[0]?.[0] as
        | ((message: unknown, sender: unknown, sendResponse: (value: unknown) => void) => boolean)
        | undefined;

      if (!listener) {
        throw new Error('listener not registered');
      }

      const sample = createSample();
      const sendResponse = vi.fn();
      const handled = listener({ command: 'trackpadGestureSample', sample }, {}, sendResponse);
      expect(handled).toBe(true);
      await Promise.resolve();

      await vi.waitFor(() => {
        expect(spy).toHaveBeenCalledTimes(1);
      });
      const [[payload]] = spy.mock.calls as [[GestureDetectionResult]];
      expect(payload.direction).toBe('right');
      expect(sendResponse).toHaveBeenCalledWith({ ok: true });
    });
  });
});
