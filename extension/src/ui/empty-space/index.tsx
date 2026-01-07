import React from 'react';
import ReactDOM from 'react-dom/client';
import { EmptySpace } from './EmptySpace';
import { mountFloatingUi, type FloatingUiInstance } from '../../floating/mount';
import '@/styles.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <EmptySpace />
    </React.StrictMode>
  );
  console.log('[Arcline] 🚀 EmptySpace page initialized');
} else {
  console.error('[Arcline] ❌ Root element not found in empty-space.html');
}

// Handle Floating UI mounting for empty space
let floatingInstance: FloatingUiInstance | null = null;
console.log('[Arcline] 👂 Registering message listener for EmptySpace');

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Arcline] 📨 Received message in EmptySpace:', message);
  if (message.command === 'openFloatingUiWithData') {
    console.log('[Arcline] ⚡ Handling openFloatingUiWithData command');
    handleOpenFloatingUi(message).catch(console.error);
    sendResponse({ success: true });
    return true;
  }
  return false;
});

async function handleOpenFloatingUi(message: {
  perfId?: string;
  t0?: number;
  spaces: any;
  activeSpaceId: number;
}) {
  if (!floatingInstance) {
    const host = document.createElement('div');
    host.id = 'arcline-floating-root';
    // Style as a floating host similar to content script
    Object.assign(host.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      height: '100vh',
      width: '8px',
      zIndex: '2147483646',
      pointerEvents: 'auto',
    });
    document.body.appendChild(host);

    const shadowRoot = host.attachShadow({ mode: 'open' });

    floatingInstance = await mountFloatingUi({
      host,
      shadowRoot,
      perfId: message.perfId,
      t0: message.t0,
    });
  }

  if (floatingInstance) {
    floatingInstance.openInstantly({
      spaces: message.spaces,
      activeSpaceId: message.activeSpaceId,
    });
  }
}
