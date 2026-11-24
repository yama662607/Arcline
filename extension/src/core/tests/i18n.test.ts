import { describe, expect, it } from 'vitest';
import { createTranslator, DICTIONARY, type MessageKey, resolveLanguage } from '../i18n';

describe('resolveLanguage', () => {
  it('honours explicit preferences', () => {
    expect(resolveLanguage('en', 'ja-JP')).toBe('en');
    expect(resolveLanguage('ja', 'en-US')).toBe('ja');
  });

  it('resolves auto from the browser language', () => {
    expect(resolveLanguage('auto', 'ja')).toBe('ja');
    expect(resolveLanguage('auto', 'ja-JP')).toBe('ja');
    expect(resolveLanguage('auto', 'en-US')).toBe('en');
    expect(resolveLanguage('auto', 'fr')).toBe('en');
    expect(resolveLanguage(undefined, undefined)).toBe('en');
  });
});

describe('dictionary', () => {
  it('has identical key sets and no empty values in en and ja', () => {
    const enKeys = Object.keys(DICTIONARY.en).sort();
    const jaKeys = Object.keys(DICTIONARY.ja).sort();
    expect(jaKeys).toEqual(enKeys);
    for (const key of enKeys) {
      const k = key as MessageKey;
      if (key.endsWith('.placeholder')) continue;
      expect(DICTIONARY.en[k], `en ${key}`).not.toBe('');
      expect(DICTIONARY.ja[k], `ja ${key}`).not.toBe('');
    }
  });

  it('keeps {placeholders} consistent between languages', () => {
    const tokens = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    for (const key of Object.keys(DICTIONARY.en) as MessageKey[]) {
      expect(tokens(DICTIONARY.ja[key]), key).toBe(tokens(DICTIONARY.en[key]));
    }
  });
});

describe('createTranslator', () => {
  it('interpolates params and leaves unknown placeholders alone', () => {
    const t = createTranslator('en');
    const key = Object.keys(DICTIONARY.en).find((k) =>
      DICTIONARY.en[k as MessageKey].includes('{'),
    );
    if (!key) return;
    const out = t(key as MessageKey, { count: 3, name: 'X' });
    expect(out).not.toContain('{count}');
  });
});
