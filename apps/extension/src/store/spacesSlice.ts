import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface TabEntry {
  id: number;
  title: string;
  url?: string;
  pinned?: boolean;
}

export interface Space {
  id: number;
  name: string;
  color: string;
  pinnedTabs: TabEntry[];
  temporaryTabs: TabEntry[];
}

interface SpacesState {
  spaces: Space[];
  activeSpaceId: number | null;
  setSpaces: (spaces: Space[]) => void;
  setActiveSpace: (spaceId: number) => void;
}

export const useSpacesStore = create<SpacesState>()(
  devtools((set) => ({
    spaces: [],
    activeSpaceId: null,
    setSpaces: (spaces) => set({ spaces }),
    setActiveSpace: (spaceId) => set({ activeSpaceId: spaceId })
  }))
);
