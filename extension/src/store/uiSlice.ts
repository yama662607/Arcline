import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { createChromeStorage } from './persist';

interface ScrollPositions {
  pinnedList: number;
  temporaryList: number;
  archiveList: number;
  commandPalette: number;
}

interface UiState {
  scrollPositions: ScrollPositions;
  activeTab: 'spaces' | 'archive' | 'settings';
  setScrollPosition: (key: keyof ScrollPositions, position: number) => void;
  getScrollPosition: (key: keyof ScrollPositions) => number;
  setActiveTab: (tab: 'spaces' | 'archive' | 'settings') => void;
}

const defaultScrollPositions: ScrollPositions = {
  pinnedList: 0,
  temporaryList: 0,
  archiveList: 0,
  commandPalette: 0,
};

export const useUiStore = create<UiState>()(
  devtools(
    persist(
      (set, get) => ({
        scrollPositions: { ...defaultScrollPositions },
        activeTab: 'spaces',
        setScrollPosition: (key, position) =>
          set((state) => ({
            scrollPositions: {
              ...state.scrollPositions,
              [key]: position,
            },
          })),
        getScrollPosition: (key) => get().scrollPositions[key] ?? 0,
        setActiveTab: (tab) => set({ activeTab: tab }),
      }),
      {
        name: 'arcline-ui',
        storage: createChromeStorage<{
          scrollPositions: ScrollPositions;
          activeTab: 'spaces' | 'archive' | 'settings';
        }>('ui'),
        partialize: (state) => ({
          scrollPositions: state.scrollPositions,
          activeTab: state.activeTab,
        }),
      }
    )
  )
);
