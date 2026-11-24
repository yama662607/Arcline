import { describe, expect, it } from 'vitest';
import {
  isOverlayCapableUrl,
  isPlainNewTabCommandBarUrl,
  OverlayContinuityTracker,
} from '../overlay-continuity';

describe('OverlayContinuityTracker', () => {
  it('keeps overlay open across normal tab switches and new-page loads when previously open', () => {
    const tracker = new OverlayContinuityTracker();
    tracker.reportOverlayState(1, true, 'open');

    expect(tracker.onTabActivated(1, 'https://example.com/b', false)).toEqual({
      shouldOpenOverlay: true,
      shouldCloseNativeSidePanel: false,
    });
    expect(tracker.shouldAutoOpenOnInit(1, true, 'https://example.com/b')).toBe(true);
    // Background tabs never auto-open
    expect(tracker.shouldAutoOpenOnInit(1, false, 'https://example.com/bg')).toBe(false);
  });

  it('does NOT open overlay on destination pages when overlay was closed', () => {
    const tracker = new OverlayContinuityTracker();
    expect(tracker.onTabActivated(1, 'https://example.com/a', false)).toEqual({
      shouldOpenOverlay: false,
      shouldCloseNativeSidePanel: false,
    });
    expect(tracker.shouldAutoOpenOnInit(1, true, 'https://example.com/a')).toBe(false);

    // Explicit close resets state
    tracker.reportOverlayState(1, true, 'open');
    tracker.reportOverlayState(1, true, 'closed');
    expect(tracker.shouldAutoOpenOnInit(1, true, 'https://example.com/next')).toBe(false);
  });

  it('ignores state reports from inactive background tabs', () => {
    const tracker = new OverlayContinuityTracker();
    tracker.reportOverlayState(1, true, 'open');
    tracker.reportOverlayState(1, false, 'closed');
    expect(tracker.isOpen(1)).toBe(true);
  });

  it('clears state on plain New Tab Command Bar but keeps open for empty-space swipe (?openOverlay=1)', () => {
    const tracker = new OverlayContinuityTracker();
    tracker.reportOverlayState(1, true, 'open');

    // Empty-space swipe carries openOverlay=1 -> stays open
    expect(
      isPlainNewTabCommandBarUrl(
        'chrome-extension://abc/empty-space.html?spaceId=s1&openOverlay=1',
      ),
    ).toBe(false);
    expect(
      tracker.onTabActivated(
        1,
        'chrome-extension://abc/empty-space.html?spaceId=s1&openOverlay=1',
        false,
      ),
    ).toEqual({ shouldOpenOverlay: true, shouldCloseNativeSidePanel: false });

    // Plain New Tab Command Bar clears continuity so subsequent navigation stays closed
    expect(isPlainNewTabCommandBarUrl('chrome-extension://abc/empty-space.html')).toBe(true);
    expect(tracker.onTabActivated(1, 'chrome-extension://abc/empty-space.html', false)).toEqual({
      shouldOpenOverlay: false,
      shouldCloseNativeSidePanel: false,
    });
    expect(tracker.shouldAutoOpenOnInit(1, true, 'https://github.com/')).toBe(false);
  });

  it('clears state on restricted pages and hands off seamlessly from native Side Panel', () => {
    const tracker = new OverlayContinuityTracker();
    tracker.reportOverlayState(1, true, 'open');

    expect(isOverlayCapableUrl('brave://extensions')).toBe(false);
    expect(tracker.onTabActivated(1, 'brave://extensions', false)).toEqual({
      shouldOpenOverlay: false,
      shouldCloseNativeSidePanel: false,
    });
    expect(tracker.isOpen(1)).toBe(false);

    // Returning from brave://extensions while native Side Panel was open hands off to overlay
    expect(tracker.onTabActivated(1, 'https://example.com/', true)).toEqual({
      shouldOpenOverlay: true,
      shouldCloseNativeSidePanel: true,
    });
    expect(tracker.isOpen(1)).toBe(true);
  });

  it('preserves continuity across transient about:blank on newly created tabs until destination loads', () => {
    const tracker = new OverlayContinuityTracker();
    tracker.reportOverlayState(1, true, 'open');

    expect(tracker.onTabActivated(1, 'about:blank', false)).toEqual({
      shouldOpenOverlay: false,
      shouldCloseNativeSidePanel: false,
    });
    expect(tracker.isOpen(1)).toBe(true);
    expect(tracker.shouldAutoOpenOnInit(1, true, 'https://example.com/gamma')).toBe(true);
  });

  it('clears all window states when browser loses focus to another OS app (CLI / Raycast safety)', () => {
    const tracker = new OverlayContinuityTracker();
    tracker.reportOverlayState(1, true, 'open');
    tracker.onWindowFocusChanged(-1, -1);
    expect(tracker.isOpen(1)).toBe(false);
    expect(tracker.shouldAutoOpenOnInit(1, true, 'https://example.com/from-cli')).toBe(false);
  });
});
