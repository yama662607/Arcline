import React from 'react';
import ReactDOM from 'react-dom/client';
import { EmptySpace } from './EmptySpace';
import '@/styles.css';

// Render the EmptySpace background component
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

// Import and initialize the unified Floating UI content script
// This ensures identical behavior, animations, and CSS as regular pages
import { initFloatingUi } from '../../content-scripts/floating-ui';

initFloatingUi().catch((error) => {
  console.error('[Arcline] ❌ Failed to initialize Floating UI:', error);
});
