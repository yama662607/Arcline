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
      overlayWidthPx: 240,
      swipeToSwitchSpace: false,
      openEmptySpacePage: false,
      language: 'auto',
      searchEngine: 'google',
      customSiteSearches: [],
      favoriteShortcuts: {},
    });
  });

  it('keeps valid language and search engine choices', () => {
    expect(completeSettings({ language: 'ja', searchEngine: 'brave' })).toMatchObject({
      language: 'ja',
      searchEngine: 'brave',
    });
  });
});
