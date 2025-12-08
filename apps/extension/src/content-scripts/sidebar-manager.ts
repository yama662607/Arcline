import '@/dev/reactPreamble';

import { hasChromeRuntime, requestUiMode, type UiMode } from './shared-utils';
import { destroySidebar, getSidebarManager, initializeSidebar } from './sidebar';

let currentMode: UiMode | null = null;

function ensureSidebarInitialized() {
  if (!getSidebarManager()) {
    initializeSidebar();
  }
}

function applyUiMode(mode: UiMode) {
  if (mode === currentMode) {
    return;
  }

  currentMode = mode;

  if (mode === 'side-panel') {
    ensureSidebarInitialized();
  } else {
    destroySidebar();
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const payload = message as { command?: string; mode?: UiMode };

  if (payload.command === 'currentUiMode' && payload.mode) {
    applyUiMode(payload.mode);
    return false;
  }

  switch (payload.command) {
    case 'toggleSidebar': {
      const sidebar = getSidebarManager();
      if (sidebar) {
        sidebar.toggle();
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: 'Sidebar not initialized' });
      }
      return true;
    }
    case 'showSidebar': {
      const sidebar = getSidebarManager();
      if (sidebar) {
        sidebar.show();
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: 'Sidebar not initialized' });
      }
      return true;
    }
    case 'hideSidebar': {
      const sidebar = getSidebarManager();
      if (sidebar) {
        sidebar.hide();
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, error: 'Sidebar not initialized' });
      }
      return true;
    }
    default:
      return false;
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  destroySidebar();
});

async function bootstrapSidebarInjection() {
  if (window.top !== window) {
    return;
  }

  if (!hasChromeRuntime()) {
    // No chrome runtime available - skip sidebar initialization
    // Sidebar will only be initialized when explicitly requested via UI mode
    return;
  }

  const mode = await requestUiMode().catch(() => 'floating' as const);
  applyUiMode(mode);
}

void bootstrapSidebarInjection();
