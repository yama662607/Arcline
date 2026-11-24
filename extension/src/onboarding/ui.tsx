import { Check, Copy } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useT } from '../sidepanel/i18n';
import { copyText } from './platform';

export function Keycaps({ keys, label }: { keys: string[]; label?: string }) {
  return (
    <span className="onb-keycaps" role="img" aria-label={label ?? keys.join(' + ')}>
      {keys.map((key, i) => (
        <span key={key} className="inline-flex items-center gap-1.5" aria-hidden="true">
          {i > 0 && <span className="onb-keycap-plus">+</span>}
          <kbd className="onb-keycap">{key}</kbd>
        </span>
      ))}
    </span>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  testId,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  testId?: string;
}) {
  return (
    <fieldset className="onb-segmented m-0 border-0" aria-label={label} data-testid={testId}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="onb-segment"
          aria-pressed={value === option.value}
          data-value={option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </fieldset>
  );
}

/** Copies `text` and flashes a confirmation. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async () => {
    if (!(await copyText(text))) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button type="button" className="onb-btn onb-btn-ghost onb-btn-sm" onClick={onClick}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span>{copied ? t('onboarding.common.copied') : label}</span>
    </button>
  );
}

export function StepHeading({
  eyebrow,
  title,
  body,
  headingRef,
  badge,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  badge?: string;
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {eyebrow && <span className="onb-eyebrow">{eyebrow}</span>}
        {badge && <span className="onb-badge">{badge}</span>}
      </div>
      <h1 ref={headingRef} tabIndex={-1} className="onb-title">
        {title}
      </h1>
      <p className="onb-lead">{body}</p>
    </header>
  );
}
