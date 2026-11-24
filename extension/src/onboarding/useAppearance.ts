import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS, storage } from '../background/storage';
import { DEFAULT_SETTINGS } from '../core/settings';
import type { ThemeMode } from '../core/types';

const STEP_HUES = [235, 285, 165, 25] as const;

/** Per-step hue so the gradient background drifts gently as the guide progresses. */
export function hueForStep(step: number): number {
  return STEP_HUES[step] ?? STEP_HUES[0];
}

/**
 * Keeps `settings.theme` live, resolves it against `prefers-color-scheme`, and reflects the
 * result on <html data-theme> so the shared Space theme tokens (light-dark()) follow it.
 */
export function useAppearance(step: number) {
  const [theme, setThemeState] = useState<ThemeMode>(DEFAULT_SETTINGS.theme);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    let active = true;
    const sync = () => {
      void storage
        .getSettings()
        .then((s) => {
          if (active) setThemeState(s.theme);
        })
        .catch(() => undefined);
    };
    sync();
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (STORAGE_KEYS.settings in changes) sync();
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      active = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const scheme: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', scheme);
    root.removeAttribute('data-neutral');
  }, [scheme]);

  useEffect(() => {
    const hue = hueForStep(step);
    document.documentElement.style.setProperty('--onb-hue', String(hue));
    document.documentElement.style.setProperty('--space-hue', String(hue));
  }, [step]);

  const setTheme = useCallback(async (next: ThemeMode) => {
    setThemeState(next);
    const current = await storage.getSettings();
    await storage.setSettings({ ...current, theme: next });
  }, []);

  return { theme, setTheme };
}
