import type { Language, LanguagePreference } from './types';
import { commandBarEn, commandBarJa } from './messages/commandBar';
import { commonEn, commonJa } from './messages/common';
import { onboardingEn, onboardingJa } from './messages/onboarding';
import { settingsEn, settingsJa } from './messages/settings';
import { sidebarEn, sidebarJa } from './messages/sidebar';
import { spacesEn, spacesJa } from './messages/spaces';

/**
 * Strongly-typed bilingual dictionary. English is the source of truth for the key set;
 * the Japanese table is typed `Record<MessageKey, string>` so a missing translation is a
 * compile error. Each area lives in `./messages/<area>.ts` and is merged here.
 */
const EN = {
  ...commonEn,
  ...sidebarEn,
  ...settingsEn,
  ...spacesEn,
  ...commandBarEn,
  ...onboardingEn,
} as const;

export type MessageKey = keyof typeof EN;

const JA: Record<MessageKey, string> = {
  ...commonJa,
  ...sidebarJa,
  ...settingsJa,
  ...spacesJa,
  ...commandBarJa,
  ...onboardingJa,
};

export const DICTIONARY: Readonly<Record<Language, Readonly<Record<MessageKey, string>>>> = {
  en: EN,
  ja: JA,
};

export type MessageParams = Record<string, string | number>;
export type Translator = (key: MessageKey, params?: MessageParams) => string;

/** Resolves the stored preference to a concrete language. 'auto' follows the browser UI language. */
export function resolveLanguage(
  pref: LanguagePreference | undefined,
  navigatorLanguage: string | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.language,
): Language {
  if (pref === 'en' || pref === 'ja') return pref;
  return navigatorLanguage?.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

/** Replaces `{name}` placeholders. Unknown placeholders are left untouched. */
function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function createTranslator(lang: Language): Translator {
  const table = DICTIONARY[lang];
  return (key, params) => interpolate(table[key] ?? EN[key], params);
}

export const LANGUAGE_OPTIONS: ReadonlyArray<{ value: LanguagePreference; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
];
