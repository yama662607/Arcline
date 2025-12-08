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
