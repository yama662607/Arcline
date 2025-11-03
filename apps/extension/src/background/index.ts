/// <reference types="chrome" />
import { getSpacesSnapshot } from './services/browser';

const UI_MODE_KEY = 'arclineUiMode';
type UiMode = 'side-panel' | 'popup';

async function initializeUiMode() {
  const hasSidePanel = typeof chrome.sidePanel !== 'undefined';
  const mode: UiMode = hasSidePanel ? 'side-panel' : 'popup';

  await chrome.storage.local.set({ [UI_MODE_KEY]: mode });

  if (hasSidePanel) {
    chrome.sidePanel.setPanelBehavior?.({ openPanelOnActionClick: true }).catch((error) => {
      console.warn('Failed to configure side panel behavior', error);
    });
  } else {
    // Fallback: ensure action opens the popup
    chrome.action.setPopup({ popup: 'index.html' });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await initializeUiMode();
});

chrome.runtime.onStartup?.addListener(async () => {
  await initializeUiMode();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quickPinToggle') {
    await chrome.runtime.sendMessage({ command: 'quickPinToggle' });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const { command } = message as { command?: string };

  switch (command) {
    case 'requestUiMode': {
      (async () => {
        try {
          const result = await chrome.storage.local.get(UI_MODE_KEY);
          sendResponse({ command: 'currentUiMode', mode: (result[UI_MODE_KEY] as UiMode) ?? 'side-panel' });
        } catch (error) {
          console.error('Failed to respond with UI mode', error);
          sendResponse({ command: 'currentUiMode', mode: 'side-panel' as UiMode });
        }
      })();
      return true;
    }
    case 'requestSpacesSnapshot': {
      (async () => {
        const spaces = await getSpacesSnapshot();
        sendResponse({ command: 'spacesSnapshot', spaces });
      })().catch((error) => {
        console.error('Failed to respond with spaces snapshot', error);
        sendResponse({ command: 'spacesSnapshot', spaces: [] });
      });
      return true;
    }
    default:
      return false;
  }
});
