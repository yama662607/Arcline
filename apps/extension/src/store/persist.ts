import { createJSONStorage } from 'zustand/middleware';

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

export function createChromeStorage<T>(key: string) {
  if (!hasChromeStorage()) {
    if (typeof window === 'undefined') {
      const memory = new Map<string, string>();
      return createJSONStorage<T>(() => ({
        getItem: (name) => memory.get(`${key}:${name}`) ?? null,
        setItem: (name, value) => void memory.set(`${key}:${name}`, value),
        removeItem: (name) => void memory.delete(`${key}:${name}`),
      }));
    }

    return createJSONStorage<T>(() => window.localStorage);
  }

  return createJSONStorage<T>(() => ({
    getItem: async (name) => {
      const result = await chrome.storage.local.get(`${key}:${name}`);
      return (result[`${key}:${name}`] as string | undefined) ?? null;
    },
    setItem: (name, value) => chrome.storage.local.set({ [`${key}:${name}`]: value }),
    removeItem: (name) => chrome.storage.local.remove(`${key}:${name}`),
  }));
}
