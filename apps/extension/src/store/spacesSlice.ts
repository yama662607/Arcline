import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import type { SpaceSnapshot } from '@/shared/spaces';

interface SpacesState {
  spaces: SpaceSnapshot[];
  activeSpaceId: number | null;
  setSpaces: (spaces: SpaceSnapshot[]) => void;
  setActiveSpace: (spaceId: number) => void;
}

export const useSpacesStore = create<SpacesState>()(
  devtools((set, get) => ({
    spaces: [],
    activeSpaceId: null,
    setSpaces: (spaces) =>
      set((state) => {
        const hasActive = spaces.some((space) => space.id === state.activeSpaceId);
        const nextActive = hasActive
          ? state.activeSpaceId
          : spaces.length > 0
            ? spaces[0].id
            : null;

        return {
          spaces,
          activeSpaceId: nextActive
        };
      }),
    setActiveSpace: (spaceId) => set({ activeSpaceId: spaceId })
  }))
);
