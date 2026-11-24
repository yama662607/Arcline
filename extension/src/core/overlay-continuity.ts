/**
 * Pure per-window tracker for floating overlay continuity across tab switches & page navigations.
 *
 * Rules:
 * - Tracks whether the user currently has the Arcline floating overlay open in each window.
 * - Background tab hiding (`tab-hidden` / `visibilitychange`) does NOT clear window state.
 * - Explicit user dismissal (cursor leave, outside click, Esc, Ctrl+B) clears window state.
 * - Switching to a restricted internal page (`brave://`, `chrome://`, CWS) or a plain New Tab
 *   Command Bar (`empty-space.html` without `openOverlay=1`) clears window state so stale
 *   open flags never leak into later CLI or Command Bar navigations.
 * - Losing browser focus to another OS app (`WINDOW_ID_NONE`) clears all window states so
 *   external launches (CLI `arcline open`, Raycast, external links) never pop open a stale sidebar.
 */

export function isOverlayCapableUrl(url?: string): boolean {
  if (!url) return false;
  if (/^https?:\/\//i.test(url)) {
    // Chrome Web Store blocks content script injection
    if (/^https:\/\/chromewebstore\.google\.com\//i.test(url)) return false;
    return true;
  }
  return url.includes('/empty-space.html');
}

export function isTransientBlankUrl(url?: string): boolean {
  return !url || url === 'about:blank';
}

export function isPlainNewTabCommandBarUrl(url?: string): boolean {
  if (!url) return false;
  if (url === 'chrome://newtab/' || url === 'brave://newtab/') {
    return true;
  }
  if (!url.includes('/empty-space.html')) return false;
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('openOverlay') !== '1';
  } catch {
    return !url.includes('openOverlay=1');
  }
}

export class OverlayContinuityTracker {
  private readonly openByWindow = new Map<number, boolean>();

  isOpen(windowId: number): boolean {
    return this.openByWindow.get(windowId) === true;
  }

  /** Called when an active tab's overlay reports user-visible open or explicit close. */
  reportOverlayState(windowId: number, activeTab: boolean, state: 'open' | 'closed'): void {
    if (!activeTab) return;
    if (state === 'open') {
      this.openByWindow.set(windowId, true);
    } else {
      this.openByWindow.delete(windowId);
    }
  }

  /** Called when a keyboard command (e.g. next-space / previous-space) explicitly wants overlay open. */
  setWindowOpen(windowId: number, open: boolean): void {
    if (open) {
      this.openByWindow.set(windowId, true);
    } else {
      this.openByWindow.delete(windowId);
    }
  }

  /**
   * Called on `chrome.tabs.onActivated`.
   * Returns `{ shouldOpenOverlay, shouldCloseNativeSidePanel }`.
   */
  onTabActivated(
    windowId: number,
    url: string | undefined,
    nativeSidePanelOpen: boolean,
  ): { shouldOpenOverlay: boolean; shouldCloseNativeSidePanel: boolean } {
    if (isTransientBlankUrl(url)) {
      // Newly created tabs briefly pass through empty / about:blank before navigating to their
      // target URL; preserve window continuity until the real destination URL commits.
      return { shouldOpenOverlay: false, shouldCloseNativeSidePanel: false };
    }

    const overlayCapable = isOverlayCapableUrl(url);
    const plainNewTab = isPlainNewTabCommandBarUrl(url);

    if (!overlayCapable) {
      // Restricted internal page: clear floating-overlay continuity so it never leaks later.
      this.openByWindow.delete(windowId);
      return { shouldOpenOverlay: false, shouldCloseNativeSidePanel: false };
    }

    if (plainNewTab) {
      // Plain New Tab / Command Bar: do not cover the Command Bar with the sidebar,
      // and clear continuity unless the user hovers the left edge explicitly.
      this.openByWindow.delete(windowId);
      return {
        shouldOpenOverlay: false,
        shouldCloseNativeSidePanel: nativeSidePanelOpen,
      };
    }

    if (nativeSidePanelOpen) {
      // Seamless handoff from native Side Panel (e.g. clicking a tab/Favorite from brave://extensions)
      this.openByWindow.set(windowId, true);
      return { shouldOpenOverlay: true, shouldCloseNativeSidePanel: true };
    }

    return {
      shouldOpenOverlay: this.openByWindow.get(windowId) === true,
      shouldCloseNativeSidePanel: false,
    };
  }

  /** Called when a newly loaded document's overlay script asks whether to auto-open on boot. */
  shouldAutoOpenOnInit(windowId: number, activeTab: boolean, url: string | undefined): boolean {
    if (!activeTab) return false;
    if (isPlainNewTabCommandBarUrl(url)) {
      this.openByWindow.delete(windowId);
      return false;
    }
    if (!isOverlayCapableUrl(url)) return false;
    return this.openByWindow.get(windowId) === true;
  }

  /** Called on `chrome.windows.onFocusChanged`. Clearing on WINDOW_ID_NONE (-1) prevents CLI leaks. */
  onWindowFocusChanged(focusedWindowId: number, windowIdNone: number): void {
    if (focusedWindowId === windowIdNone) {
      this.openByWindow.clear();
    }
  }

  onWindowRemoved(windowId: number): void {
    this.openByWindow.delete(windowId);
  }
}
