import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { createChromeStorage } from './persist';

interface SettingsState {
  defaultSpaceName: string;
  autoArchiveMinutes: number;
  enableAutoArchive: boolean;
  setDefaultSpaceName: (name: string) => void;
  setAutoArchiveMinutes: (minutes: number) => void;
  setEnableAutoArchive: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  devtools(
    persist(
      (set) => ({
        defaultSpaceName: 'Home',
        autoArchiveMinutes: 30,
        enableAutoArchive: false,
        setDefaultSpaceName: (name) => set({ defaultSpaceName: name }),
        setAutoArchiveMinutes: (minutes) => set({ autoArchiveMinutes: minutes }),
        setEnableAutoArchive: (value) => set({ enableAutoArchive: value })
      }),
      {
        name: 'arcline-settings',
        storage: createChromeStorage<SettingsState>('settings')
      }
    )
  )
);
