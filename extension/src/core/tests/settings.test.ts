import { describe, expect, it } from 'vitest';
import { completeSettings, DEFAULT_SETTINGS } from '../settings';

describe('completeSettings', () => {
  it('fills defaults for missing or invalid fields', () => {
    expect(completeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(
      completeSettings({
        theme: 'invalid' as never,
        showTopBar: true,
        autoArchiveHours: 999 as never,
        showOpenInCollapsedFolders: false,
        edgeTriggerWidthPx: 999,
        edgeOpenDelayMs: -10,
        edgeCloseDelayMs: 9999,
        overlayWidthPx: 100,
        swipeToSwitchSpace: false,
        openEmptySpacePage: false,
        language: 'fr' as never,
        searchEngine: 'bing' as never,
      }),
    ).toEqual({
      theme: 'system',
      showTopBar: true,
      autoArchiveHours: 24,
      showOpenInCollapsedFolders: false,
      edgeHoverEnabled: true,
      edgeTriggerWidthPx: 24,
      edgeOpenDelayMs: 0,
      edgeCloseDelayMs: 1200,
      overlayWidthPx: 220,
      swipeToSwitchSpace: false,
      openEmptySpacePage: false,
      language: 'auto',
      searchEngine: 'google',
      commandBarOpenMode: 'popup',
      customSiteSearches: [],
      disabledSiteSearchIds: [],
      favoriteShortcuts: {},
      customShortcuts: {},
    });
  });

  it('keeps valid language, search engine, command bar mode, and custom shortcuts', () => {
    expect(
      completeSettings({
        language: 'ja',
        searchEngine: 'brave',
        commandBarOpenMode: 'newtab',
        disabledSiteSearchIds: ['reddit', 'custom:docs'],
        customShortcuts: { openCommandBar: 'Alt+Space', toggleSidebar: 'Ctrl+B' },
      }),
    ).toMatchObject({
      language: 'ja',
      searchEngine: 'brave',
      commandBarOpenMode: 'newtab',
      disabledSiteSearchIds: ['reddit', 'custom:docs'],
      customShortcuts: { openCommandBar: 'alt+space', toggleSidebar: 'ctrl+b' },
    });
  });
});
