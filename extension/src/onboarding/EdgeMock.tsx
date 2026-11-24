import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../sidepanel/i18n';

type Phase = 'idle' | 'hover' | 'open' | 'away';

const PHASES: Phase[] = ['idle', 'hover', 'open', 'away'];
const DURATIONS: Record<Phase, number> = { idle: 1800, hover: 1100, open: 2800, away: 1500 };
const CURSOR_POS: Record<Phase, { left: string; top: string }> = {
  idle: { left: '62%', top: '58%' },
  hover: { left: '1.5%', top: '48%' },
  open: { left: '12%', top: '42%' },
  away: { left: '66%', top: '64%' },
};
const EDGE_TRIGGER = 0.045;
const SIDEBAR_FRACTION = 0.31;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Animated browser-window mock. Autoplays the hover loop; real pointer movement takes over. */
export function EdgeMock() {
  const t = useT();
  const [phase, setPhase] = useState<Phase>('idle');
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const [tried, setTried] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const reduced = useRef(prefersReducedMotion());

  useEffect(() => {
    if (manualOpen !== null || reduced.current) return;
    const timer = window.setTimeout(() => {
      setPhase((current) => PHASES[(PHASES.indexOf(current) + 1) % PHASES.length] ?? 'idle');
    }, DURATIONS[phase]);
    return () => window.clearTimeout(timer);
  }, [phase, manualOpen]);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    setManualOpen((wasOpen) => {
      const next = wasOpen ? ratio < SIDEBAR_FRACTION + 0.02 : ratio < EDGE_TRIGGER;
      if (next) setTried(true);
      return next;
    });
  };

  const manual = manualOpen !== null;
  const open = manual ? manualOpen === true : phase === 'open';
  const glow = manual ? false : phase === 'hover';
  const caption = manual
    ? t(open ? 'onboarding.edge.mock.open' : 'onboarding.edge.mock.hover')
    : t(`onboarding.edge.mock.${phase}`);
  const cursor = CURSOR_POS[phase];

  return (
    <figure className="m-0 flex flex-col gap-3">
      <div
        ref={stageRef}
        className="onb-window"
        data-testid="onboarding-edge-mock"
        data-open={open}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setManualOpen(null)}
        role="img"
        aria-label={t('onboarding.edge.mock.try')}
      >
        <div className="onb-window-bar" aria-hidden="true">
          <i />
          <i />
          <i />
          <span className="onb-window-url" />
        </div>
        <div className="onb-window-page" aria-hidden="true">
          <div className="onb-sk onb-sk-hero" />
          <div className="onb-sk" style={{ height: 11, width: '72%' }} />
          <div className="onb-sk" style={{ height: 11, width: '55%' }} />
          <div className="onb-sk" style={{ height: 11, width: '64%' }} />
        </div>
        <div className="onb-edge-glow" data-on={glow} aria-hidden="true" />
        <div className="onb-mock-sidebar" data-open={open} aria-hidden="true">
          <div className="flex items-center gap-1.5">
            <span
              className="onb-mock-pill"
              style={{ width: 15, background: 'var(--onb-accent)' }}
            />
            <span className="onb-mock-pill" style={{ width: '46%' }} />
          </div>
          <div className="flex gap-1.5">
            <span className="onb-mock-fav" />
            <span className="onb-mock-fav" />
            <span className="onb-mock-fav" />
            <span className="onb-mock-fav" />
          </div>
          <span className="onb-mock-pill" style={{ width: '88%' }} />
          <span className="onb-mock-pill" style={{ width: '74%' }} />
          <span className="onb-mock-pill" style={{ width: '81%' }} />
          <span className="onb-mock-pill" style={{ width: '58%', marginTop: 6 }} />
          <span className="onb-mock-pill" style={{ width: '69%' }} />
        </div>
        {!manual && (
          <svg
            className="onb-cursor"
            style={{ left: cursor.left, top: cursor.top }}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M4 2.5 20 11.2l-7.1 1.9L9.6 20.4 4 2.5Z"
              fill="#fff"
              stroke="#111"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <figcaption
        className="flex items-center justify-between gap-3 text-[12.5px]"
        style={{ color: 'var(--ink-muted)' }}
      >
        <span className="font-semibold" style={{ color: 'var(--ink)' }} aria-live="polite">
          {caption}
        </span>
        {tried ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
            style={{
              background: 'var(--onb-accent-soft)',
              color: 'var(--onb-accent)',
            }}
            data-testid="onboarding-edge-tried"
          >
            <Check size={12} strokeWidth={3} aria-hidden="true" />
            <span>{t('onboarding.edge.mock.tried')}</span>
          </span>
        ) : (
          <span className="text-right">{t('onboarding.edge.mock.try')}</span>
        )}
      </figcaption>
    </figure>
  );
}
