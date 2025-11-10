const GESTURE_STORAGE_KEY = 'arclineGestureSettings';

export type SwipeDirection = 'left' | 'right';

export interface GestureSettings {
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high';
  distanceThreshold: number;
  velocityThreshold: number;
  visualFeedback: boolean;
}

// Test utilities ---------------------------------------------------------
export function __resetGestureListenersForTests(): void {
  listeners.length = 0;
  listenerSeed = 0;
}

export interface SwipeSample {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  durationMs: number;
  timestamp: number;
  pointerType?: string;
}

export interface GestureDetectionResult {
  direction: SwipeDirection;
  distance: number;
  velocity: number;
  sample: SwipeSample;
}

type SwipeEventListener = (result: GestureDetectionResult) => void;

type ListenerEntry = {
  id: number;
  listener: SwipeEventListener;
};

export const DEFAULT_GESTURE_SETTINGS: GestureSettings = {
  enabled: true,
  sensitivity: 'medium',
  distanceThreshold: 75,
  velocityThreshold: 0.35,
  visualFeedback: true,
};

let listenerSeed = 0;
const listeners: ListenerEntry[] = [];

export async function getGestureSettings(): Promise<GestureSettings> {
  try {
    const stored = await chrome.storage.local.get(GESTURE_STORAGE_KEY);
    const settings = stored[GESTURE_STORAGE_KEY] as Partial<GestureSettings> | undefined;
    if (!settings) {
      return DEFAULT_GESTURE_SETTINGS;
    }

    return {
      ...DEFAULT_GESTURE_SETTINGS,
      ...settings,
    };
  } catch (error) {
    console.error('[Arcline] Failed to load gesture settings:', error);
    return DEFAULT_GESTURE_SETTINGS;
  }
}

export async function saveGestureSettings(
  nextSettings: Partial<GestureSettings>
): Promise<GestureSettings> {
  const current = await getGestureSettings();
  const merged: GestureSettings = {
    ...current,
    ...nextSettings,
  };

  try {
    await chrome.storage.local.set({ [GESTURE_STORAGE_KEY]: merged });
  } catch (error) {
    console.error('[Arcline] Failed to persist gesture settings:', error);
  }

  return merged;
}

export function subscribeToSwipe(listener: SwipeEventListener): () => void {
  const entry: ListenerEntry = {
    id: ++listenerSeed,
    listener,
  };

  listeners.push(entry);

  return () => {
    const index = listeners.findIndex((item) => item.id === entry.id);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  };
}

function adjustThresholds(settings: GestureSettings): GestureSettings {
  if (settings.sensitivity === 'high') {
    return {
      ...settings,
      distanceThreshold: Math.max(40, settings.distanceThreshold * 0.75),
      velocityThreshold: Math.max(0.2, settings.velocityThreshold * 0.8),
    };
  }

  if (settings.sensitivity === 'low') {
    return {
      ...settings,
      distanceThreshold: Math.max(100, settings.distanceThreshold * 1.2),
      velocityThreshold: Math.max(0.4, settings.velocityThreshold * 1.25),
    };
  }

  return settings;
}

function isValidPointer(sample: SwipeSample): boolean {
  if (!sample.pointerType) {
    return true;
  }

  return sample.pointerType === 'touch' || sample.pointerType === 'pen';
}

export function evaluateSwipe(
  sample: SwipeSample,
  settings: GestureSettings
): GestureDetectionResult | null {
  if (!settings.enabled) {
    return null;
  }

  const tunedSettings = adjustThresholds(settings);

  const deltaX = sample.endX - sample.startX;
  const deltaY = sample.endY - sample.startY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (!isValidPointer(sample)) {
    return null;
  }

  if (absX <= absY) {
    return null;
  }

  if (absX < tunedSettings.distanceThreshold) {
    return null;
  }

  const duration = Math.max(sample.durationMs, 1);
  const velocity = absX / duration;

  if (velocity < tunedSettings.velocityThreshold) {
    return null;
  }

  const direction: SwipeDirection = deltaX < 0 ? 'left' : 'right';

  return {
    direction,
    distance: absX,
    velocity,
    sample,
  };
}

async function handleGestureSample(sample: SwipeSample): Promise<void> {
  const settings = await getGestureSettings();
  const result = evaluateSwipe(sample, settings);

  if (!result) {
    return;
  }

  for (const entry of listeners) {
    try {
      entry.listener(result);
    } catch (error) {
      console.error('[Arcline] Swipe listener failed', error);
    }
  }
}

export function initializeGestureDetection(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (typeof message !== 'object' || message === null) {
      return false;
    }

    if ((message as { command?: string }).command !== 'trackpadGestureSample') {
      return false;
    }

    const payload = message as { sample?: SwipeSample };
    if (!payload.sample) {
      sendResponse?.({ ok: false, error: 'sample is required' });
      return false;
    }

    void handleGestureSample(payload.sample).then(() => {
      sendResponse?.({ ok: true });
    });

    return true;
  });
}
