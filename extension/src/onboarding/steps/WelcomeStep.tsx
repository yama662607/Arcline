import {
  Command,
  Folder,
  FolderTree,
  Layers,
  Monitor,
  Moon,
  PanelLeft,
  Search,
  Star,
  Sun,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { storage } from '../../background/storage';
import { DEFAULT_SETTINGS } from '../../core/settings';
import type { LanguagePreference, SearchEngine, ThemeMode } from '../../core/types';
import { useI18n } from '../../sidepanel/i18n';
import { Segmented, StepHeading } from '../ui';
import type { StepProps } from './types';

interface WelcomeStepProps extends StepProps {
  theme: ThemeMode;
  onThemeChange: (next: ThemeMode) => void;
}

const PREVIEW_HUES = [
  { hue: 245, label: 'Blue' },
  { hue: 295, label: 'Lavender' },
  { hue: 165, label: 'Emerald' },
  { hue: 35, label: 'Amber' },
] as const;

export function WelcomeStep({ headingRef, theme, onThemeChange }: WelcomeStepProps) {
  const { t, preference, setPreference } = useI18n();
  const [searchEngine, setSearchEngineState] = useState<SearchEngine>(
    DEFAULT_SETTINGS.searchEngine,
  );
  const [previewHue, setPreviewHue] = useState<number>(245);

  useEffect(() => {
    let active = true;
    void storage
      .getSettings()
      .then((s) => {
        if (active) setSearchEngineState(s.searchEngine);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const handleSearchEngineChange = async (next: SearchEngine) => {
    setSearchEngineState(next);
    const current = await storage.getSettings();
    await storage.setSettings({ ...current, searchEngine: next });
  };

  const features = [
    { icon: Layers, key: 'spaces' },
    { icon: FolderTree, key: 'pins' },
    { icon: PanelLeft, key: 'edge' },
    { icon: Command, key: 'command' },
  ] as const;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.12fr_1fr] lg:gap-12">
      <div className="onb-rise flex flex-col gap-6">
        <StepHeading
          eyebrow={t('onboarding.welcome.eyebrow')}
          title={t('onboarding.welcome.title')}
          body={t('onboarding.welcome.body')}
          headingRef={headingRef}
        />
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
          {features.map(({ icon: Icon, key }) => (
            <li key={key} className="onb-surface flex items-start gap-3 p-3.5">
              <span className="onb-ico onb-ico-accent shrink-0" style={{ width: 30, height: 30 }}>
                <Icon size={16} aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13.5px] font-semibold">
                  {t(`onboarding.welcome.feature.${key}.title`)}
                </span>
                <span className="onb-small">{t(`onboarding.welcome.feature.${key}.body`)}</span>
              </div>
            </li>
          ))}
        </ul>

        {/* Live mini-sidebar preview reacting to language, theme, and hue swatch */}
        <div
          className="onb-surface flex flex-col gap-3 p-3.5"
          data-testid="onboarding-live-preview"
          style={{
            background: `linear-gradient(150deg, oklch(0.62 0.1 ${previewHue} / 0.14), var(--onb-surface))`,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold">
              {t('onboarding.welcome.preview.label')}
            </span>
            <fieldset
              className="m-0 flex items-center gap-1.5 border-0 p-0"
              aria-label="Space color preview"
            >
              {PREVIEW_HUES.map((swatch) => (
                <button
                  key={swatch.hue}
                  type="button"
                  aria-label={swatch.label}
                  aria-pressed={previewHue === swatch.hue}
                  onClick={() => setPreviewHue(swatch.hue)}
                  className="size-4 cursor-pointer rounded-full border-0 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: `oklch(0.64 0.16 ${swatch.hue})`,
                    boxShadow:
                      previewHue === swatch.hue
                        ? '0 0 0 2px var(--onb-card), 0 0 0 3.5px var(--ink)'
                        : undefined,
                  }}
                />
              ))}
            </fieldset>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <div
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
              style={{ background: 'var(--tile)' }}
            >
              <Star
                size={11}
                style={{ color: `oklch(0.62 0.16 ${previewHue})` }}
                aria-hidden="true"
              />
              <span className="truncate font-medium">Favorites</span>
            </div>
            <div
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
              style={{ background: 'var(--tile)' }}
            >
              <Folder
                size={11}
                style={{ color: `oklch(0.62 0.16 ${previewHue})` }}
                aria-hidden="true"
              />
              <span className="truncate font-medium">
                {t('onboarding.welcome.feature.pins.title')}
              </span>
            </div>
            <div
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5"
              style={{ background: 'var(--tile)' }}
            >
              <Search
                size={11}
                style={{ color: `oklch(0.62 0.16 ${previewHue})` }}
                aria-hidden="true"
              />
              <span className="truncate font-medium">
                {searchEngine === 'duckduckgo'
                  ? 'DuckDuckGo'
                  : searchEngine === 'brave'
                    ? 'Brave'
                    : 'Google'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <section
        aria-labelledby="onb-prefs-title"
        className="onb-surface onb-rise flex flex-col gap-5 self-start p-6"
      >
        <div className="flex flex-col gap-1">
          <h2 id="onb-prefs-title" className="onb-h2 text-[16px]">
            {t('onboarding.welcome.prefs.title')}
          </h2>
          <p className="onb-small">{t('onboarding.welcome.prefs.hint')}</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold">
              {t('onboarding.welcome.language.title')}
            </span>
            <span className="onb-small">{t('onboarding.welcome.language.hint')}</span>
          </div>
          <Segmented<LanguagePreference>
            label={t('onboarding.language.label')}
            value={preference}
            onChange={(next) => void setPreference(next)}
            testId="onboarding-welcome-language"
            options={[
              { value: 'auto', label: t('onboarding.language.auto') },
              { value: 'en', label: t('onboarding.language.en') },
              { value: 'ja', label: t('onboarding.language.ja') },
            ]}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold">{t('onboarding.welcome.theme.title')}</span>
            <span className="onb-small">{t('onboarding.welcome.theme.hint')}</span>
          </div>
          <Segmented<ThemeMode>
            label={t('onboarding.welcome.theme.title')}
            value={theme}
            onChange={onThemeChange}
            testId="onboarding-welcome-theme"
            options={[
              {
                value: 'system',
                label: t('onboarding.welcome.theme.system'),
                icon: <Monitor size={14} aria-hidden="true" />,
              },
              {
                value: 'light',
                label: t('onboarding.welcome.theme.light'),
                icon: <Sun size={14} aria-hidden="true" />,
              },
              {
                value: 'dark',
                label: t('onboarding.welcome.theme.dark'),
                icon: <Moon size={14} aria-hidden="true" />,
              },
            ]}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold">
              {t('onboarding.welcome.search.title')}
            </span>
            <span className="onb-small">{t('onboarding.welcome.search.hint')}</span>
          </div>
          <Segmented<SearchEngine>
            label={t('onboarding.welcome.search.title')}
            value={searchEngine}
            onChange={(next) => void handleSearchEngineChange(next)}
            testId="onboarding-welcome-search"
            options={[
              { value: 'google', label: 'Google' },
              { value: 'duckduckgo', label: 'DuckDuckGo' },
              { value: 'brave', label: 'Brave' },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
