import { Check, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { storage } from '../../background/storage';
import { DEFAULT_SETTINGS } from '../../core/settings';
import { useT } from '../../sidepanel/i18n';
import { EdgeMock } from '../EdgeMock';
import {
  copyText,
  detectBrave,
  isMacPlatform,
  openBrowserPage,
  toggleSidebarKeys,
} from '../platform';
import { CopyButton, Keycaps, Segmented, StepHeading } from '../ui';
import type { StepProps } from './types';

type Browser = 'brave' | 'chrome';
type HoverSpeed = 'snappy' | 'balanced' | 'calm';

const SPEED_DELAY_MS: Record<HoverSpeed, number> = {
  snappy: 40,
  balanced: 90,
  calm: 180,
};

function delayToSpeed(ms: number): HoverSpeed {
  if (ms <= 60) return 'snappy';
  if (ms >= 140) return 'calm';
  return 'balanced';
}

const SETTINGS_URL: Record<Browser, string> = {
  brave: 'brave://settings/appearance',
  chrome: 'chrome://settings/appearance',
};

const BRAVE_STEPS = [
  'onboarding.edge.brave.step1',
  'onboarding.edge.brave.step2',
  'onboarding.edge.brave.step3',
] as const;

export function EdgeStep({ headingRef }: StepProps) {
  const t = useT();
  const [browser, setBrowser] = useState<Browser>('brave');
  const [fallbackNote, setFallbackNote] = useState(false);
  const [speed, setSpeed] = useState<HoverSpeed>(() =>
    delayToSpeed(DEFAULT_SETTINGS.edgeOpenDelayMs),
  );
  const [checkedSteps, setCheckedSteps] = useState<ReadonlySet<number>>(() => new Set());
  const url = SETTINGS_URL[browser];
  const keys = toggleSidebarKeys(isMacPlatform());

  useEffect(() => {
    let active = true;
    void detectBrave().then((isBrave) => {
      if (active) setBrowser(isBrave ? 'brave' : 'chrome');
    });
    void storage
      .getSettings()
      .then((s) => {
        if (active) setSpeed(delayToSpeed(s.edgeOpenDelayMs));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const handleSpeedChange = async (next: HoverSpeed) => {
    setSpeed(next);
    const current = await storage.getSettings();
    await storage.setSettings({ ...current, edgeOpenDelayMs: SPEED_DELAY_MS[next] });
  };

  const toggleChecklist = (idx: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const openSettings = async () => {
    setFallbackNote(false);
    if (await openBrowserPage(url)) return;
    await copyText(url);
    setFallbackNote(true);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
      <div className="onb-rise flex min-w-0 flex-col gap-5">
        <StepHeading
          title={t('onboarding.edge.title')}
          body={t('onboarding.edge.body')}
          headingRef={headingRef}
        />
        <EdgeMock />

        <div className="onb-surface flex flex-col gap-2.5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-semibold">{t('onboarding.edge.speed.title')}</span>
            <span className="onb-small">{t('onboarding.edge.speed.hint')}</span>
          </div>
          <Segmented<HoverSpeed>
            label={t('onboarding.edge.speed.title')}
            value={speed}
            onChange={(next) => void handleSpeedChange(next)}
            testId="onboarding-edge-speed"
            options={[
              { value: 'snappy', label: t('onboarding.edge.speed.snappy') },
              { value: 'balanced', label: t('onboarding.edge.speed.balanced') },
              { value: 'calm', label: t('onboarding.edge.speed.calm') },
            ]}
          />
        </div>

        <div className="onb-surface flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Keycaps keys={keys} />
          <div className="min-w-[180px] flex-1">
            <span className="text-[13px] font-semibold">{t('onboarding.edge.shortcut.label')}</span>
            <p className="onb-small m-0">{t('onboarding.edge.shortcut.hint')}</p>
          </div>
        </div>
      </div>

      <section
        aria-labelledby="onb-setup-title"
        className="onb-surface onb-rise flex min-w-0 flex-col gap-4 self-start p-5"
        style={{
          borderColor: 'var(--onb-accent-soft)',
          boxShadow: '0 0 0 1px var(--onb-accent-soft)',
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span
              className="onb-badge self-start"
              style={{ background: 'var(--onb-accent-soft)', color: 'var(--onb-accent)' }}
            >
              {t('onboarding.edge.setup.badge')}
            </span>
            <h2 id="onb-setup-title" className="onb-h2 text-[16px]">
              {t('onboarding.edge.setup.title')}
            </h2>
            <p className="onb-small">{t('onboarding.edge.setup.lead')}</p>
          </div>
          {browser === 'brave' && (
            <span className="onb-badge shrink-0" data-testid="onboarding-brave-progress">
              {checkedSteps.size} / {BRAVE_STEPS.length}
            </span>
          )}
        </div>

        <Segmented<Browser>
          label={t('onboarding.edge.setup.title')}
          value={browser}
          onChange={setBrowser}
          testId="onboarding-browser-toggle"
          options={[
            { value: 'brave', label: t('onboarding.edge.browser.brave') },
            { value: 'chrome', label: t('onboarding.edge.browser.chrome') },
          ]}
        />

        {browser === 'brave' ? (
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {BRAVE_STEPS.map((key, i) => {
              const done = checkedSteps.has(i);
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-pressed={done}
                    onClick={() => toggleChecklist(i)}
                    className="flex w-full cursor-pointer items-start gap-3 rounded-xl border-0 bg-transparent px-2 py-1.5 text-left transition-colors hover:bg-[var(--tile)]"
                    style={{ color: 'inherit', opacity: done ? 0.65 : 1 }}
                  >
                    <span
                      className="onb-list-num shrink-0"
                      style={
                        done
                          ? {
                              background: 'var(--onb-accent)',
                              color: '#fff',
                              borderColor: 'transparent',
                            }
                          : undefined
                      }
                    >
                      {done ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : i + 1}
                    </span>
                    <span className={`text-[13px] leading-[1.6] ${done ? 'line-through' : ''}`}>
                      {t(key)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="onb-small text-[13px]">{t('onboarding.edge.chrome.body')}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            className="onb-btn onb-btn-accent onb-btn-sm"
            data-testid="onboarding-open-settings"
            onClick={() => void openSettings()}
          >
            <ExternalLink size={14} aria-hidden="true" />
            <span>{t('onboarding.edge.openSettings')}</span>
          </button>
          <CopyButton text={url} label={t('onboarding.common.copyUrl')} />
        </div>
        <code className="onb-code self-start">{url}</code>
        {fallbackNote && (
          <p className="onb-small" role="status">
            {t('onboarding.edge.copyFallback')}
          </p>
        )}
      </section>
    </div>
  );
}
