import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LanguagePreference, ThemeMode } from '../core/types';
import { useI18n } from '../sidepanel/i18n';
import { finishOnboarding } from './platform';
import { CommandBarStep } from './steps/CommandBarStep';
import { EdgeStep } from './steps/EdgeStep';
import { ImportStep } from './steps/ImportStep';
import { WelcomeStep } from './steps/WelcomeStep';
import { Segmented } from './ui';
import { useAppearance } from './useAppearance';
import './onboarding.css';

const STEP_TITLE_KEYS = [
  'onboarding.step.welcome',
  'onboarding.step.edge',
  'onboarding.step.import',
  'onboarding.step.commandBar',
] as const;
const LAST_STEP = STEP_TITLE_KEYS.length - 1;

function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest('input, textarea, select, button, a, [contenteditable="true"]') !== null;
}

export function OnboardingApp() {
  const { t, preference, setPreference } = useI18n();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [finishing, setFinishing] = useState(false);
  const { theme, setTheme } = useAppearance(step);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  const goTo = useCallback((next: number) => {
    setStep((current) => {
      const clamped = Math.max(0, Math.min(LAST_STEP, next));
      if (clamped !== current) setDirection(clamped > current ? 'forward' : 'backward');
      return clamped;
    });
  }, []);

  const finish = useCallback(async () => {
    setFinishing(true);
    await finishOnboarding();
    setFinishing(false);
  }, []);

  const next = useCallback(() => {
    if (step >= LAST_STEP) void finish();
    else goTo(step + 1);
  }, [step, goTo, finish]);
  const back = useCallback(() => goTo(step - 1), [step, goTo]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
      if (e.key === 'ArrowRight') {
        if (step < LAST_STEP) {
          e.preventDefault();
          goTo(step + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (step > 0) {
          e.preventDefault();
          goTo(step - 1);
        }
      } else if (e.key === 'Enter' && !isInteractive(target)) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step, goTo, next]);

  // Move focus to the new step's heading (for screen readers and keyboard users) and reset scroll.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const stepProps = { headingRef };
  const stepTitle = t(STEP_TITLE_KEYS[step] ?? STEP_TITLE_KEYS[0]);

  return (
    <div ref={scrollRef} className="onb-root" data-testid="onboarding-root" data-step={step + 1}>
      <div className="onb-bg" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="arcline-grain-layer"
        style={{ position: 'fixed', opacity: 0.1 }}
      />

      <div className="mx-auto flex min-h-full w-full max-w-[1120px] flex-col gap-5 px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 place-items-center rounded-xl"
              style={{ background: 'var(--ink)', color: 'var(--onb-on-ink)' }}
              aria-hidden="true"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              >
                <path d="M4.5 19C5 9 9 4.5 12 4.5S19 9 19.5 19" />
                <path d="M9 19c.3-4 1.4-6.5 3-6.5s2.700 2.500 3 6.500" opacity="0.6" />
              </svg>
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-[17px] font-semibold tracking-[-0.01em]">Arcline</span>
              <span className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
                {t('onboarding.header.title')}
              </span>
            </div>
          </div>
          <Segmented<LanguagePreference>
            label={t('onboarding.language.label')}
            value={preference}
            onChange={(value) => void setPreference(value)}
            testId="onboarding-language-toggle"
            options={[
              { value: 'auto', label: t('onboarding.language.auto') },
              { value: 'en', label: t('onboarding.language.en') },
              { value: 'ja', label: t('onboarding.language.ja') },
            ]}
          />
        </header>

        <nav
          aria-label={t('onboarding.nav.stepper')}
          className="flex items-center gap-1 overflow-x-auto pb-1"
        >
          {STEP_TITLE_KEYS.map((key, i) => (
            <div key={key} className="flex items-center gap-1">
              {i > 0 && (
                <span className="onb-stepper-line" aria-hidden="true">
                  <span style={{ transform: `scaleX(${i <= step ? 1 : 0})` }} />
                </span>
              )}
              <button
                type="button"
                className="onb-stepper-item"
                aria-current={i === step ? 'step' : undefined}
                data-done={i < step}
                data-testid={`onboarding-stepper-${i + 1}`}
                aria-label={t('onboarding.nav.goTo', { n: i + 1, title: t(key) })}
                onClick={() => goTo(i)}
              >
                <span className="onb-stepper-dot">
                  {i < step ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{t(key)}</span>
              </button>
            </div>
          ))}
        </nav>

        <main className="onb-card flex flex-1 flex-col overflow-hidden rounded-[28px]">
          <section
            key={step}
            className={`flex-1 p-6 sm:p-9 ${direction === 'forward' ? 'onb-step-enter-forward' : 'onb-step-enter-backward'}`}
            data-testid={`onboarding-step-${step + 1}`}
            aria-label={stepTitle}
          >
            {step === 0 && (
              <WelcomeStep
                {...stepProps}
                theme={theme}
                onThemeChange={(m: ThemeMode) => void setTheme(m)}
              />
            )}
            {step === 1 && <EdgeStep {...stepProps} />}
            {step === 2 && <ImportStep {...stepProps} onSkip={() => goTo(3)} />}
            {step === 3 && <CommandBarStep {...stepProps} />}
          </section>

          <footer
            className="flex items-center justify-between gap-3 px-6 py-4 sm:px-9"
            style={{ borderTop: '1px solid var(--onb-line)' }}
          >
            <button
              type="button"
              className="onb-btn onb-btn-ghost"
              data-testid="onboarding-back"
              onClick={back}
              disabled={step === 0}
              style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span>{t('onboarding.nav.back')}</span>
            </button>
            <span
              className="hidden text-center text-[12px] md:block"
              style={{ color: 'var(--ink-muted)' }}
            >
              {t('onboarding.nav.stepOf', { current: step + 1, total: STEP_TITLE_KEYS.length })}
              {' · '}
              {t('onboarding.nav.hint')}
            </span>
            <button
              type="button"
              className="onb-btn onb-btn-primary"
              data-testid="onboarding-next"
              onClick={next}
              disabled={finishing}
            >
              <span>
                {step === LAST_STEP ? t('onboarding.nav.finish') : t('onboarding.nav.next')}
              </span>
              {step === LAST_STEP ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <ArrowRight size={16} aria-hidden="true" />
              )}
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
}
