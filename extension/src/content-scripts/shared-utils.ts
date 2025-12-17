/// <reference types="chrome" />

/**
 * Shared utilities for content scripts
 * Provides common functionality to avoid code duplication
 */

export type UiMode = 'side-panel' | 'popup' | 'floating';

const DEFAULT_UI_MODE: UiMode = 'floating';

/**
 * Check if Chrome runtime is available
 */
export function hasChromeRuntime(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    !!chrome.runtime &&
    typeof chrome.runtime.sendMessage === 'function'
  );
}

/**
 * Request current UI mode from background script
 * @param timeoutMs - Timeout in milliseconds (default: 1000ms)
 * @returns Promise that resolves to the current UI mode
 */
export function requestUiMode(timeoutMs = 1000): Promise<UiMode> {
  if (!hasChromeRuntime()) {
    return Promise.resolve(DEFAULT_UI_MODE);
  }

  return new Promise<UiMode>((resolve) => {
    let settled = false;

    const cleanup = (mode: UiMode) => {
      if (settled) return;
      settled = true;
      resolve(mode);
    };

    const timer = window.setTimeout(() => {
      cleanup(DEFAULT_UI_MODE);
    }, timeoutMs);

    try {
      chrome.runtime.sendMessage({ command: 'requestUiMode' }, (response?: { mode?: UiMode }) => {
        window.clearTimeout(timer);
        if (chrome.runtime.lastError) {
          cleanup(DEFAULT_UI_MODE);
          return;
        }
        cleanup((response?.mode as UiMode | undefined) ?? DEFAULT_UI_MODE);
      });
    } catch (error) {
      console.warn('[Arcline] requestUiMode failed', error);
      window.clearTimeout(timer);
      cleanup(DEFAULT_UI_MODE);
    }
  });
}

/**
 * Request current settings from background script
 */
export function requestSettings(timeoutMs = 1000): Promise<{
  gesturesEnabled: boolean;
  gestureSensitivity: number;
}> {
  if (!hasChromeRuntime()) {
    return Promise.resolve({ gesturesEnabled: true, gestureSensitivity: 100 });
  }

  return new Promise((resolve) => {
    let settled = false;

    // Default settings
    const defaults = { gesturesEnabled: true, gestureSensitivity: 100 };

    const cleanup = (settings: typeof defaults) => {
      if (settled) return;
      settled = true;
      resolve(settings);
    };

    const timer = window.setTimeout(() => {
      cleanup(defaults);
    }, timeoutMs);

    try {
      // Use the Bridge format
      const id = `settings_${Date.now()}`;
      chrome.runtime.sendMessage(
        { type: 'query', method: 'getSettings', id },
        (response?: { data?: typeof defaults }) => {
          window.clearTimeout(timer);
          if (chrome.runtime.lastError || !response?.data) {
            cleanup(defaults);
            return;
          }
          cleanup({
            gesturesEnabled: response.data.gesturesEnabled ?? defaults.gesturesEnabled,
            gestureSensitivity: response.data.gestureSensitivity ?? defaults.gestureSensitivity,
          });
        }
      );
    } catch (error) {
      console.warn('[Arcline] requestSettings failed', error);
      window.clearTimeout(timer);
      cleanup(defaults);
    }
  });
}
