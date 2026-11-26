import { Command, FolderTree, Layers, Monitor, Moon, PanelLeft, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { storage } from '../../background/storage';
import { DEFAULT_SETTINGS } from '../../core/settings';
import type { SearchEngine, ThemeMode } from '../../core/types';
import { useI18n } from '../../sidepanel/i18n';
import { Segmented, StepHeading } from '../ui';
import type { StepProps } from './types';

interface WelcomeStepProps extends StepProps {
  theme: ThemeMode;
  onThemeChange: (next: ThemeMode) => void;
}

export function WelcomeStep({ headingRef, theme, onThemeChange }: WelcomeStepProps) {
  const { t } = useI18n();
  const [searchEngine, setSearchEngineState] = useState<SearchEngine>(
    DEFAULT_SETTINGS.searchEngine,
  );

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
