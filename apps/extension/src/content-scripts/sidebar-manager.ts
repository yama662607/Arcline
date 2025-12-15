import '@/dev/reactPreamble';

import { hasChromeRuntime, requestUiMode, type UiMode } from './shared-utils';
import { applySidebarUiMode, cleanupSidebarOnUnload } from './sidebar-lifecycle';
import { getSidebarManager } from './sidebar';

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const payload = message as { command?: string; mode?: UiMode };

  if (payload.command === 'currentUiMode' && payload.mode) {
    applySidebarUiMode(payload.mode);
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
  cleanupSidebarOnUnload();
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
  applySidebarUiMode(mode);
}

void bootstrapSidebarInjection();
