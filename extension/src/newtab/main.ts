import { completeSettings } from '../core/settings';
import type { Settings } from '../core/types';

// Minimal chrome_url_overrides.newtab redirector:
// Separating newtab.html from empty-space.html ensures Chromium/Brave's NewTabFooterController
// ("Arcline | Customize Brave" bottom bar) never attaches to empty-space.html?commandBar=1.
const SETTINGS_KEY = 'arcline:settings';

async function redirectIfStillOpen(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.getCurrent || !chrome.tabs?.update) return;
  try {
    const [tab, stored] = await Promise.all([
      chrome.tabs.getCurrent(),
      chrome.storage?.local?.get(SETTINGS_KEY).catch(() => ({})),
    ]);
    if (tab?.id === undefined) return;
    const settings = completeSettings(
      (stored as Record<string, Partial<Settings> | undefined>)?.[SETTINGS_KEY],
    );
    // In popup mode, give the background Service Worker a brief window to close this tab and
    // show the modal over the active webpage; only fall back to empty-space.html if still open.
    if (settings.commandBarOpenMode === 'popup') {
      await new Promise((r) => setTimeout(r, 120));
    }
    await chrome.tabs.update(tab.id, {
      url: chrome.runtime.getURL('empty-space.html?commandBar=1'),
    });
  } catch {
    // Tab was already closed by background popup interception
  }
}

void redirectIfStillOpen();
