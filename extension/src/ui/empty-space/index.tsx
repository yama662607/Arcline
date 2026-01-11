import React from 'react';
import ReactDOM from 'react-dom/client';
import { EmptySpace } from './EmptySpace';
import { mountFloatingUi, type FloatingUiInstance } from '../../floating/mount';
import { useSpacesStore } from '../../store/spacesSlice';
import '@/styles.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <EmptySpace />
    </React.StrictMode>
  );
  console.log('[Arcline] 🚀 EmptySpace page initialized');

  // Auto-open Floating UI after page initialization
  requestAnimationFrame(() => {
    autoOpenFloatingUi();
  });
} else {
  console.error('[Arcline] ❌ Root element not found in empty-space.html');
}

// Handle Floating UI mounting for empty space
let floatingInstance: FloatingUiInstance | null = null;
console.log('[Arcline] 👂 Registering message listener for EmptySpace');

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Arcline] 📥 Received message in EmptySpace:', message);
  if (message.command === 'openFloatingUiWithData') {
    console.log('[Arcline] ⚡ Handling openFloatingUiWithData command');

    // Pre-populate store with data before mounting/opening
    if (message.spaces) {
      console.log(`[Arcline] 📦 Updating store with ${message.spaces.length} spaces`);
      useSpacesStore.getState().setSpaces(message.spaces);
    }
    if (typeof message.activeSpaceId === 'number') {
      console.log(`[Arcline] 📍 Setting active space to ${message.activeSpaceId}`);
      useSpacesStore.getState().setActiveSpace(message.activeSpaceId);
    }

    handleOpenFloatingUi(message).catch((err) => {
      console.error('[Arcline] ❌ Error in handleOpenFloatingUi:', err);
    });
    sendResponse({ success: true });
    return true;
  }
  return false;
});

import type { SwipeDirection } from '@/lib/gestures';
import { createFloatingGestureController } from '../../content-scripts/floating-gestures';
import type { SpaceTransitionHandoff, SpaceSnapshot } from '@/shared/types';

// ... (imports)

// Helper to send navigateSpace message
function sendNavigateSpace(
  direction: SwipeDirection,
  options?: {
    mode: 'handoff' | 'flick';
    transition?: SpaceTransitionHandoff;
    perfId?: string;
    t0?: number;
  }
) {
  if (typeof crypto.randomUUID !== 'function') return;

  chrome.runtime.sendMessage(
    {
      method: 'navigateSpace',
      params: {
        direction,
        transition: options?.transition,
        perfId: options?.perfId,
        t0: options?.t0,
      },
      id: crypto.randomUUID(),
    },
    () => {
      if (chrome.runtime.lastError) {
        // Ignore
      }
    }
  );
}

// Helper to send activateSpace message
function sendActivateSpace(
  spaceIdOrUuid: number | string,
  options?: { perfId?: string; t0?: number }
) {
  if (typeof crypto.randomUUID !== 'function') return;

  const perfId = options?.perfId || `activate-${Math.random().toString(36).slice(2, 6)}`;
  const t0 = options?.t0 || Date.now();

  const params: { spaceId?: number; spaceUuid?: string; perfId?: string; t0?: number } = {
    perfId,
    t0,
  };

  if (typeof spaceIdOrUuid === 'number') {
    params.spaceId = spaceIdOrUuid;
  } else {
    params.spaceUuid = spaceIdOrUuid;
  }

  chrome.runtime.sendMessage(
    {
      method: 'activateSpace',
      params,
      id: crypto.randomUUID(),
    },
    () => {
      if (chrome.runtime.lastError) {
        // Ignore
      }
    }
  );
}

// Global gesture controller reference
let gestureController: ReturnType<typeof createFloatingGestureController> | null = null;

// Space switching event listener (from BottomSpaceBar)
window.addEventListener('arcline-space-bar-switch', (event: Event) => {
  const detail = (event as CustomEvent).detail;
  if (!detail) return;

  // Use gesture controller for flick transition if available
  if (gestureController && detail.direction) {
    const idOrUuid = detail.spaceUuid || (typeof detail.spaceId === 'number' ? detail.spaceId : -1);
    if (idOrUuid === -1) return;
    const perfId = `spacebar-${Math.random().toString(36).slice(2, 6)}`;
    const t0 = Date.now();

    const started = gestureController.triggerFlickTransition(detail.direction, () => {
      sendActivateSpace(idOrUuid, { perfId, t0 });
    });

    if (started) return;
  }

  // Fallback to direct activation
  chrome.runtime.sendMessage({
    method: 'activateSpace',
    params: {
      spaceId: detail.spaceId,
      spaceUuid: detail.spaceUuid,
    },
  });
});

async function handleOpenFloatingUi(message: {
  perfId?: string;
  t0?: number;
  spaces: SpaceSnapshot[];
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

    // Initialize Gesture Controller
    gestureController = createFloatingGestureController({
      getShadowRoot: () => shadowRoot,
      getHostElement: () => host,
      ensureHost: () => {}, // Already ensured
      onNavigateSpace: (direction, options) => sendNavigateSpace(direction, options),
      onPageTransition: () => {
        floatingInstance?.showPageTransition();
      },
    });

    // Setup Gesture Events
    gestureController.setup();

    floatingInstance = await mountFloatingUi({
      host,
      shadowRoot,
      perfId: message.perfId,
      t0: message.t0,
      onOpenStateChange: (isOpen: boolean) => {
        if (isOpen) {
          host.style.width = '100vw';
          host.style.pointerEvents = 'none';
        } else {
          host.style.width = '8px';
          host.style.pointerEvents = 'auto';
        }
      },
    });

    // Add pointer edge detection
    host.addEventListener('pointerenter', () => {
      floatingInstance?.openFromHover();
    });
  }

  if (floatingInstance) {
    floatingInstance.openInstantly({
      spaces: message.spaces,
      activeSpaceId: message.activeSpaceId,
    });
  }
}

// Auto-open Floating UI when the empty-space page loads
// This runs on initial page load only - message handler takes over after that
async function autoOpenFloatingUi() {
  // Skip if UI is already open (message handler already triggered)
  if (floatingInstance) {
    console.log('[Arcline] ⏭️ Skipping auto-open: Floating UI already exists');
    return;
  }

  console.log('[Arcline] 🚀 Auto-opening Floating UI on empty-space page');

  try {
    // Small delay to allow message listeners to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Skip if UI was opened by message handler during the delay
    if (floatingInstance) {
      console.log('[Arcline] ⏭️ Skipping auto-open: Floating UI created during delay');
      return;
    }

    // Request spaces snapshot from background
    const response = await chrome.runtime.sendMessage({
      command: 'requestSpacesSnapshot',
    });

    if (response?.spaces && Array.isArray(response.spaces)) {
      console.log(`[Arcline] 📦 Received ${response.spaces.length} spaces from background`);

      // Get active space ID from current tab's group
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeSpaceId = currentTab?.groupId ?? response.spaces[0]?.id ?? null;

      // Open the floating UI
      await handleOpenFloatingUi({
        spaces: response.spaces,
        activeSpaceId: activeSpaceId,
      });

      console.log('[Arcline] ✅ Floating UI auto-opened successfully');
    } else {
      console.warn('[Arcline] ⚠️ No spaces data received from background');
    }
  } catch (error) {
    console.error('[Arcline] ❌ Failed to auto-open Floating UI:', error);
  }
}
