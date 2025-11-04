import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { createChromeStorage } from './persist';

interface TabsState {
  activeTabId: number | null;
  lastUpdatedAt: number | null;
  setActiveTabId: (id: number | null) => void;
  touch: () => void;
}

export const useTabsStore = create<TabsState>()(
  devtools(
    persist(
      (set) => ({
        activeTabId: null,
        lastUpdatedAt: null,
        setActiveTabId: (id) => set({ activeTabId: id }),
        touch: () => set({ lastUpdatedAt: Date.now() }),
      }),
      {
        name: 'arcline-tabs',
        storage: createChromeStorage<{ activeTabId: number | null }>('tabs'),
        partialize: (state) => ({ activeTabId: state.activeTabId }),
      }
    )
  )
);
