import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { createChromeStorage } from './persist';

interface ScrollPositions {
  pinnedList: number;
  temporaryList: number;
  archiveList: number;
  commandPalette: number;
}

type ActiveModal = 'settings' | 'archive' | 'bookmark-import' | null;

interface UiState {
  scrollPositions: ScrollPositions;
  activeTab: 'spaces' | 'archive' | 'settings';
  activeModal: ActiveModal;
  setScrollPosition: (key: keyof ScrollPositions, position: number) => void;
  getScrollPosition: (key: keyof ScrollPositions) => number;
  setActiveTab: (tab: 'spaces' | 'archive' | 'settings') => void;
  openModal: (modal: Exclude<ActiveModal, null>) => void;
  closeModal: () => void;
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
        activeModal: null,
        setScrollPosition: (key, position) =>
          set((state) => ({
            scrollPositions: {
              ...state.scrollPositions,
              [key]: position,
            },
          })),
        getScrollPosition: (key) => get().scrollPositions[key] ?? 0,
        setActiveTab: (tab) => set({ activeTab: tab }),
        openModal: (modal) => set({ activeModal: modal }),
        closeModal: () => set({ activeModal: null }),
      }),
      {
        name: 'arcline-ui',
        storage: createChromeStorage<{
          scrollPositions: ScrollPositions;
          // activeTab is intentionally excluded from persistence during the Arc-style UI refactor.
        }>('ui'),
        partialize: (state) => ({
          scrollPositions: state.scrollPositions,
        }),
      }
    )
  )
);
