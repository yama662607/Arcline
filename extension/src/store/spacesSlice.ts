import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type { SpaceSnapshot } from '@/shared/spaces';
import { createChromeStorage } from './persist';

interface SpacesState {
  spaces: SpaceSnapshot[];
  activeSpaceId: number | null;
  activeSpaceUuid: string | null;
  previousSpaceId: number | null;
  favoriteSpaceIds: number[];
  swipeProgress: number; // -1 to 1, 0 = no swipe
  isModalOpen: boolean;
  setSpaces: (spaces: SpaceSnapshot[]) => void;
  setActiveSpace: (spaceId: number, spaceUuid?: string) => void;
  setActiveSpaceFromTabs: (spaces: SpaceSnapshot[]) => void;
  setFavoriteSpaces: (spaceIds: number[]) => void;
  toggleFavoriteSpace: (spaceId: number) => void;
  setSwipeProgress: (progress: number) => void;
  setIsModalOpen: (open: boolean) => void;
}

export const useSpacesStore = create<SpacesState>()(
  devtools(
    persist(
      (set, _get) => ({
        spaces: [],
        activeSpaceId: null,
        activeSpaceUuid: null,
        previousSpaceId: null,
        favoriteSpaceIds: [],
        swipeProgress: 0,
        isModalOpen: false,
        setSpaces: (spaces) =>
          set((state) => {
            // Find space that actually has an active tab right now
            const spaceWithActiveTab = spaces.find((s) =>
              [...s.tabs, ...s.pinnedTabs, ...s.temporaryTabs].some((t) => t.active)
            );

            let nextActiveId = state.activeSpaceId;
            let nextActiveUuid = state.activeSpaceUuid;

            if (spaceWithActiveTab) {
              nextActiveId = spaceWithActiveTab.id;
              nextActiveUuid = spaceWithActiveTab.uuid ?? null;
            } else {
              const hasActive = spaces.some(
                (space) =>
                  (state.activeSpaceUuid && space.uuid === state.activeSpaceUuid) ||
                  (!state.activeSpaceUuid && space.id === state.activeSpaceId)
              );
              if (!hasActive) {
                const firstSpace = spaces.length > 0 ? spaces[0] : null;
                nextActiveId = firstSpace ? firstSpace.id : null;
                nextActiveUuid = firstSpace?.uuid ?? null;
              }
            }

            return {
              spaces,
              activeSpaceId: nextActiveId,
              activeSpaceUuid: nextActiveUuid,
            };
          }),
        setActiveSpace: (spaceId, spaceUuid) =>
          set((state) => {
            // If uuid is not provided, try to find it from spaces
            let resolvedUuid = spaceUuid;
            if (!resolvedUuid && state.spaces.length > 0) {
              const space = state.spaces.find((s) => s.id === spaceId);
              resolvedUuid = space?.uuid;
            }

            return {
              previousSpaceId: state.activeSpaceId,
              activeSpaceId: spaceId,
              activeSpaceUuid: resolvedUuid ?? null,
              swipeProgress: 0, // Reset swipe progress on space change
            };
          }),
        setActiveSpaceFromTabs: (spaces) =>
          set(() => {
            const spaceWithActiveTab = spaces.find((s) =>
              [...s.tabs, ...s.pinnedTabs, ...s.temporaryTabs].some((t) => t.active)
            );
            if (spaceWithActiveTab) {
              return {
                activeSpaceId: spaceWithActiveTab.id,
                activeSpaceUuid: spaceWithActiveTab.uuid ?? null,
              };
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
        setIsModalOpen: (open) => set({ isModalOpen: open }),
      }),
      {
        name: 'arcline-spaces',
        storage: createChromeStorage<{
          activeSpaceId: number | null;
          activeSpaceUuid: string | null;
          favoriteSpaceIds: number[];
        }>('spaces'),
        partialize: (state) => ({
          activeSpaceId: state.activeSpaceId,
          activeSpaceUuid: state.activeSpaceUuid,
          favoriteSpaceIds: state.favoriteSpaceIds,
        }),
      }
    )
  )
);
