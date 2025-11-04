import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import type { SpaceSnapshot } from '@/shared/spaces';
import { createChromeStorage } from './persist';

interface SpacesState {
  spaces: SpaceSnapshot[];
  activeSpaceId: number | null;
  setSpaces: (spaces: SpaceSnapshot[]) => void;
  setActiveSpace: (spaceId: number) => void;
}

export const useSpacesStore = create<SpacesState>()(
  devtools(
    persist(
      (set, _get) => ({
        spaces: [],
        activeSpaceId: null,
        setSpaces: (spaces) =>
          set((state) => {
            const hasActive = spaces.some((space) => space.id === state.activeSpaceId);
            const nextActive = hasActive
              ? state.activeSpaceId
              : spaces.length > 0 && spaces[0]
                ? spaces[0].id
                : null;

            return {
              spaces,
              activeSpaceId: nextActive,
            };
          }),
        setActiveSpace: (spaceId) => set({ activeSpaceId: spaceId }),
      }),
      {
        name: 'arcline-spaces',
        storage: createChromeStorage<{ activeSpaceId: number | null }>('spaces'),
        partialize: (state) => ({
          activeSpaceId: state.activeSpaceId,
        }),
      }
    )
  )
);
