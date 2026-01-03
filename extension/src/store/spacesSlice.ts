import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type { SpaceSnapshot } from '@/shared/spaces';
import { createChromeStorage } from './persist';

interface SpacesState {
  spaces: SpaceSnapshot[];
  activeSpaceId: number | null;
  previousSpaceId: number | null;
  favoriteSpaceIds: number[];
  swipeProgress: number; // -1 to 1, 0 = no swipe
  setSpaces: (spaces: SpaceSnapshot[]) => void;
  setActiveSpace: (spaceId: number) => void;
  setActiveSpaceFromTabs: (spaces: SpaceSnapshot[]) => void;
  setFavoriteSpaces: (spaceIds: number[]) => void;
  toggleFavoriteSpace: (spaceId: number) => void;
  setSwipeProgress: (progress: number) => void;
}

export const useSpacesStore = create<SpacesState>()(
  devtools(
    persist(
      (set, _get) => ({
        spaces: [],
        activeSpaceId: null,
        previousSpaceId: null,
        favoriteSpaceIds: [],
        swipeProgress: 0,
        setSpaces: (spaces) =>
          set((state) => {
            // Find space that actually has an active tab right now
            const spaceWithActiveTab = spaces.find((s) =>
              [...s.tabs, ...s.pinnedTabs, ...s.temporaryTabs].some((t) => t.active)
            );

            let nextActive = state.activeSpaceId;

            if (spaceWithActiveTab) {
              nextActive = spaceWithActiveTab.id;
            } else {
              const hasActive = spaces.some((space) => space.id === state.activeSpaceId);
              if (!hasActive) {
                nextActive = spaces.length > 0 && spaces[0] ? spaces[0].id : null;
              }
            }

            return {
              spaces,
              activeSpaceId: nextActive,
            };
          }),
        setActiveSpace: (spaceId) =>
          set((state) => ({
            previousSpaceId: state.activeSpaceId,
            activeSpaceId: spaceId,
            swipeProgress: 0, // Reset swipe progress on space change
          })),
        setActiveSpaceFromTabs: (spaces) =>
          set(() => {
            const spaceWithActiveTab = spaces.find((s) =>
              [...s.tabs, ...s.pinnedTabs, ...s.temporaryTabs].some((t) => t.active)
            );
            if (spaceWithActiveTab) {
              return { activeSpaceId: spaceWithActiveTab.id };
            }
            return {};
          }),
        setFavoriteSpaces: (spaceIds) => set({ favoriteSpaceIds: spaceIds }),
        toggleFavoriteSpace: (spaceId) =>
          set((state) => ({
            favoriteSpaceIds: state.favoriteSpaceIds.includes(spaceId)
              ? state.favoriteSpaceIds.filter((id) => id !== spaceId)
              : [...state.favoriteSpaceIds, spaceId],
          })),
        setSwipeProgress: (progress) => set({ swipeProgress: progress }),
      }),
      {
        name: 'arcline-spaces',
        storage: createChromeStorage<{
          activeSpaceId: number | null;
          favoriteSpaceIds: number[];
        }>('spaces'),
        partialize: (state) => ({
          activeSpaceId: state.activeSpaceId,
          favoriteSpaceIds: state.favoriteSpaceIds,
        }),
      }
    )
  )
);
