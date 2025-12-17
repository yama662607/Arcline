/// <reference types="chrome" />

import type { TabGroupColor } from '@/shared/chrome-types';
import type { SpaceSnapshot } from '@/shared/types';

// Persistent representation of a space in storage.
// Backed by Chrome tab group IDs and used as the single source of truth
// for space metadata and membership.
export interface SpaceState {
  id: number; // Chrome tab group ID
  name: string;
  color: TabGroupColor;
  // IDs of tabs that are treated as long-lived/pinned within this space
  spaceBookmarks: number[];
  // IDs of tabs that are treated as short-lived/temporary within this space
  temporaryTabs: number[];
  // Optional: last active tab within this space
  lastTab?: number;
}

const SPACES_STORAGE_KEY = 'spaces';

export async function loadSpaceState(): Promise<SpaceState[]> {
  try {
    const result = await chrome.storage.local.get(SPACES_STORAGE_KEY);
    const raw = result[SPACES_STORAGE_KEY];

    if (!Array.isArray(raw)) {
      return [];
    }

    // Trust the stored structure but guard against obviously invalid entries.
    return raw.filter((space): space is SpaceState => {
      return (
        typeof space === 'object' &&
        space !== null &&
        typeof space.id === 'number' &&
        typeof space.name === 'string' &&
        typeof space.color === 'string' &&
        Array.isArray(space.spaceBookmarks) &&
        Array.isArray(space.temporaryTabs)
      );
    });
  } catch (error) {
    console.warn('[Arcline] Failed to load spaces from storage', error);
    return [];
  }
}

export async function saveSpaceState(spaces: SpaceState[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [SPACES_STORAGE_KEY]: spaces });
  } catch (error) {
    console.warn('[Arcline] Failed to save spaces to storage', error);
  }
}

export function deriveSpaceStateFromSnapshots(snapshots: SpaceSnapshot[]): SpaceState[] {
  return snapshots.map((snapshot) => {
    const spaceBookmarks = snapshot.pinnedTabs.map((tab) => tab.id);
    const temporaryTabs = [...snapshot.temporaryTabs, ...snapshot.tabs].map((tab) => tab.id);

    return {
      id: snapshot.id,
      name: snapshot.name,
      color: snapshot.color,
      spaceBookmarks,
      temporaryTabs,
      lastTab: undefined,
    };
  });
}
