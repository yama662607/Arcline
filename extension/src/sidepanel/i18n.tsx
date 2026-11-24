import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { STORAGE_KEYS, storage } from '../background/storage';
import { DEFAULT_SETTINGS } from '../core/settings';
import { createTranslator, resolveLanguage, type Translator } from '../core/i18n';
import type { Language, LanguagePreference } from '../core/types';

interface I18nValue {
  /** Stored preference ('auto' | 'en' | 'ja'). */
  preference: LanguagePreference;
  /** Concrete language after resolving 'auto'. */
  lang: Language;
  t: Translator;
  /** Persists a new preference; every open Arcline surface updates live via storage events. */
  setPreference: (next: LanguagePreference) => Promise<void>;
}

const FALLBACK_LANG = resolveLanguage(DEFAULT_SETTINGS.language);
const I18nContext = createContext<I18nValue>({
  preference: DEFAULT_SETTINGS.language,
  lang: FALLBACK_LANG,
  t: createTranslator(FALLBACK_LANG),
  setPreference: async () => undefined,
});

/**
 * Loads `settings.language` from chrome.storage and keeps it live, so changing the language in
 * Settings (or the onboarding guide) re-renders every Arcline surface immediately.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LanguagePreference>(DEFAULT_SETTINGS.language);

  useEffect(() => {
    let active = true;
    const sync = () => {
      void storage
        .getSettings()
        .then((s) => {
          if (active) setPreferenceState(s.language);
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

  const setPreference = useCallback(async (next: LanguagePreference) => {
    setPreferenceState(next);
    const current = await storage.getSettings();
    await storage.setSettings({ ...current, language: next });
  }, []);

  const value = useMemo<I18nValue>(() => {
    const lang = resolveLanguage(preference);
    return { preference, lang, t: createTranslator(lang), setPreference };
  }, [preference, setPreference]);

  useEffect(() => {
    document.documentElement.lang = value.lang;
  }, [value.lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Shorthand for components that only need the translator. */
export function useT(): Translator {
  return useContext(I18nContext).t;
}
