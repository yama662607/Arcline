import '@/dev/reactPreamble';
import { getSidebarManager, initializeSidebar } from './sidebar';

// Initialize sidebar when content script loads
initializeSidebar();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const { command } = message as { command?: string };

  switch (command) {
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
  const sidebar = getSidebarManager();
  if (sidebar) {
    sidebar.destroy();
  }
});
