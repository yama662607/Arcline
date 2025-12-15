import type { UiMode } from './shared-utils';
import { destroySidebar, getSidebarManager, initializeSidebar } from './sidebar';

let currentMode: UiMode | null = null;

function ensureSidebarInitialized() {
  if (!getSidebarManager()) {
    initializeSidebar();
  }
}

export function applySidebarUiMode(mode: UiMode) {
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

export function cleanupSidebarOnUnload() {
  destroySidebar();
}
