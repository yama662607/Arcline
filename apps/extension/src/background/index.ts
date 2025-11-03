/// <reference types="chrome" />
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

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message?.command === 'requestUiMode') {
    chrome.storage.local
      .get(UI_MODE_KEY)
      .then((result) => {
        chrome.runtime.sendMessage({ command: 'currentUiMode', mode: result[UI_MODE_KEY] as UiMode });
      })
      .catch((error) => {
        console.error('Failed to respond with UI mode', error);
      });
  }
});
