import type { SpaceSnapshot } from '@/shared/spaces';

import { hasChromeRuntime } from './utils';

const FALLBACK_SPACES: SpaceSnapshot[] = [
  {
    id: 1,
    name: 'Sample Space',
    color: '#3b82f6',
    pinnedTabs: [
      { id: 101, title: 'Pinned example', url: 'https://example.com', pinned: true }
    ],
    temporaryTabs: [
      { id: 201, title: 'Docs', url: 'https://developer.chrome.com' }
    ]
  }
];

export async function requestSpacesSnapshot(timeoutMs = 800): Promise<SpaceSnapshot[]> {
  if (!hasChromeRuntime()) {
    return FALLBACK_SPACES;
  }

  return new Promise<SpaceSnapshot[]>((resolve) => {
    const timer = setTimeout(() => {
      resolve(FALLBACK_SPACES);
    }, timeoutMs);

    try {
      chrome.runtime.sendMessage({ command: 'requestSpacesSnapshot' }, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          console.warn('requestSpacesSnapshot error:', chrome.runtime.lastError.message);
          resolve(FALLBACK_SPACES);
          return;
        }

        if (response && Array.isArray(response.spaces)) {
          resolve(response.spaces as SpaceSnapshot[]);
        } else {
          resolve(FALLBACK_SPACES);
        }
      });
    } catch (error) {
      clearTimeout(timer);
      console.warn('requestSpacesSnapshot exception', error);
      resolve(FALLBACK_SPACES);
    }
  });
}
