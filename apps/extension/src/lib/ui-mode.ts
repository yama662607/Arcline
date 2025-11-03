/// <reference types="chrome" />

export type UiMode = 'side-panel' | 'popup';

const DEFAULT_MODE: UiMode = 'side-panel';

function hasChromeRuntime(): boolean {
  return typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function';
}

export async function requestUiMode(timeoutMs = 500): Promise<UiMode> {
  if (!hasChromeRuntime()) {
    return DEFAULT_MODE;
  }

  return new Promise<UiMode>((resolve) => {
    let settled = false;

    const cleanup = (mode: UiMode) => {
      if (settled) return;
      settled = true;
      chrome.runtime.onMessage.removeListener(listener);
      resolve(mode);
    };

    const timer = setTimeout(() => {
      cleanup(DEFAULT_MODE);
    }, timeoutMs);

    const listener = (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'command' in message &&
        (message as { command: string }).command === 'currentUiMode'
      ) {
        const mode = (message as { mode?: UiMode }).mode ?? DEFAULT_MODE;
        clearTimeout(timer);
        cleanup(mode);
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    try {
      chrome.runtime.sendMessage({ command: 'requestUiMode' }, () => {
        if (chrome.runtime.lastError) {
          console.warn('requestUiMode fallback:', chrome.runtime.lastError.message);
          clearTimeout(timer);
          cleanup(DEFAULT_MODE);
        }
      });
    } catch (error) {
      console.warn('requestUiMode exception', error);
      clearTimeout(timer);
      cleanup(DEFAULT_MODE);
    }
  });
}
