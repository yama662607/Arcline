import { Check, FileJson, FolderOpen, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArcImportError,
  createSampleArcSidebarJson,
  filterImportedSidebar,
  parseArcSidebar,
} from '../../core/arc-import';
import type { ImportedSidebar } from '../../core/types';
import { getCurrentWindowId, sendCommand } from '../../sidepanel/api';
import { ArcImportPreview } from '../../sidepanel/components/ArcImportPreview';
import { useT } from '../../sidepanel/i18n';
import { ARC_SIDEBAR_PATHS, type ArcPathOs, copyText, defaultArcPathOs } from '../platform';
import { CopyButton, Segmented, StepHeading } from '../ui';
import type { StepProps } from './types';

type ErrorKey =
  | 'onboarding.import.error.json'
  | 'onboarding.import.error.format'
  | 'onboarding.import.error.failed';

type Phase = 'pick' | 'importing' | 'done';

interface ImportStepProps extends StepProps {
  onSkip: () => void;
}

export function ImportStep({ headingRef, onSkip }: ImportStepProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pathOs, setPathOs] = useState<ArcPathOs>(() => defaultArcPathOs());
  const [rawJson, setRawJson] = useState<unknown>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [fileError, setFileError] = useState<ErrorKey | null>(null);
  const [phase, setPhase] = useState<Phase>('pick');
  const [dragOver, setDragOver] = useState(false);
  const [pickerCopied, setPickerCopied] = useState(false);

  const [skipEmpty, setSkipEmpty] = useState(true);
  const [skipSearches, setSkipSearches] = useState(true);
  const [dedupe, setDedupe] = useState(true);
  const [selectedSpaces, setSelectedSpaces] = useState<ReadonlySet<number>>(() => new Set());
  const [includeFavorites, setIncludeFavorites] = useState(true);
  const [importedSummary, setImportedSummary] = useState<{
    spaces: number;
    pins: number;
    favorites: number;
  } | null>(null);

  const activePath = ARC_SIDEBAR_PATHS[pathOs];

  const { parsed, parseError } = useMemo<{
    parsed: ImportedSidebar | null;
    parseError: ErrorKey | null;
  }>(() => {
    if (rawJson === null) return { parsed: null, parseError: null };
    try {
      return {
        parsed: parseArcSidebar(rawJson, {
          skipEmptyFolders: skipEmpty,
          skipGoogleSearches: skipSearches,
          dedupeWithinSpace: dedupe,
          skipBrokenLocalFiles: true,
        }),
        parseError: null,
      };
    } catch (err) {
      return {
        parsed: null,
        parseError:
          err instanceof ArcImportError
            ? 'onboarding.import.error.format'
            : 'onboarding.import.error.json',
      };
    }
  }, [rawJson, skipEmpty, skipSearches, dedupe]);

  // Select all spaces whenever a new file/sample is loaded
  useEffect(() => {
    if (!parsed) {
      setSelectedSpaces(new Set());
      return;
    }
    setSelectedSpaces(new Set(parsed.spaces.map((_, idx) => idx)));
    setIncludeFavorites(true);
  }, [parsed?.spaces.length, rawJson]);

  // Allow pasting StorableSidebar.json text directly with Cmd+V / Ctrl+V
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, [contenteditable="true"]')
      ) {
        return;
      }
      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (!text?.startsWith('{')) return;
      try {
        const json = JSON.parse(text);
        setRawJson(json);
        setSourceName('clipboard.json');
        setIsSample(false);
        setFileError(null);
        setPhase('pick');
      } catch {
        /* ignore non-JSON clipboard text */
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const filtered = useMemo(
    () => (parsed ? filterImportedSidebar(parsed, selectedSpaces, includeFavorites) : null),
    [parsed, selectedSpaces, includeFavorites],
  );

  const error = fileError ?? parseError;
  const hasPreview = parsed !== null && phase !== 'done';
  const nothingSelected =
    filtered !== null && filtered.spaces.length === 0 && filtered.favorites.length === 0;

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    setPhase('pick');
    setIsSample(false);
    setSourceName(file.name);
    try {
      setRawJson(JSON.parse(await file.text()));
    } catch {
      setRawJson(null);
      setSourceName(null);
      setFileError('onboarding.import.error.json');
    }
  };

  const loadSample = () => {
    setFileError(null);
    setPhase('pick');
    setIsSample(true);
    setSourceName('Sample StorableSidebar.json');
    setRawJson(createSampleArcSidebarJson());
  };

  const copyAndPickFile = async () => {
    const copied = await copyText(activePath);
    if (copied) setPickerCopied(true);
    inputRef.current?.click();
  };

  const reset = () => {
    setRawJson(null);
    setSourceName(null);
    setIsSample(false);
    setFileError(null);
    setPhase('pick');
    setPickerCopied(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const toggleSpace = (idx: number) => {
    setSelectedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const runImport = async () => {
    if (!filtered || nothingSelected) return;
    setPhase('importing');
    setFileError(null);
    try {
      const windowId = await getCurrentWindowId();
      await sendCommand({ type: 'importArc', windowId, data: filtered });
      setImportedSummary({
        spaces: filtered.spaces.length,
        pins: filtered.stats.totalPins,
        favorites: filtered.favorites.length,
      });
      setPhase('done');
    } catch {
      setFileError('onboarding.import.error.failed');
      setPhase('pick');
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.15fr] lg:gap-10">
      <div className="onb-rise flex min-w-0 flex-col gap-5">
        <StepHeading
          badge={t('onboarding.import.optional')}
          title={t('onboarding.import.title')}
          body={t('onboarding.import.body')}
          headingRef={headingRef}
        />

        <section className="onb-surface flex flex-col gap-3 p-4" aria-labelledby="onb-where">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 id="onb-where" className="onb-h2">
                {t('onboarding.import.where.title')}
              </h2>
              <span className="onb-badge">{t('onboarding.import.where.autoDetected')}</span>
            </div>
            <Segmented<ArcPathOs>
              label={t('onboarding.import.where.title')}
              value={pathOs}
              onChange={(next) => {
                setPathOs(next);
                setPickerCopied(false);
              }}
              testId="onboarding-import-os-toggle"
              options={[
                { value: 'mac', label: 'macOS' },
                { value: 'windows', label: 'Windows' },
              ]}
            />
          </div>

          <p className="onb-small">
            {pathOs === 'mac' ? t('onboarding.import.where.mac') : t('onboarding.import.where.win')}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <code className="onb-code min-w-0 flex-1" data-testid="onboarding-arc-path">
              {activePath}
            </code>
            <CopyButton text={activePath} label={t('onboarding.common.copyPath')} />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              className="onb-btn onb-btn-accent onb-btn-sm"
              data-testid="onboarding-copy-and-pick"
              onClick={() => void copyAndPickFile()}
            >
              <FolderOpen size={14} aria-hidden="true" />
              <span>{t('onboarding.import.copyAndPick')}</span>
            </button>
            {!hasPreview && phase !== 'done' && (
              <button
                type="button"
                className="onb-btn onb-btn-soft onb-btn-sm"
                data-testid="onboarding-try-sample"
                onClick={loadSample}
              >
                <Sparkles size={14} aria-hidden="true" />
                <span>{t('onboarding.import.sample.try')}</span>
              </button>
            )}
          </div>

          <p className="onb-small" role={pickerCopied ? 'status' : undefined}>
            {pickerCopied
              ? pathOs === 'mac'
                ? t('onboarding.import.where.copiedMac')
                : t('onboarding.import.where.copiedWin')
              : pathOs === 'mac'
                ? t('onboarding.import.where.finder')
                : t('onboarding.import.where.explorer')}
          </p>
        </section>

        <p
          className="flex items-start gap-2.5 text-[13px] leading-[1.65]"
          style={{ color: 'var(--ink-muted)' }}
        >
          <ShieldCheck
            size={18}
            className="mt-px shrink-0"
            style={{ color: 'var(--onb-accent)' }}
            aria-hidden="true"
          />
          <span>{t('onboarding.import.privacy')}</span>
        </p>
      </div>

      <div className="onb-rise flex min-w-0 flex-col gap-4">
        {phase === 'done' && importedSummary ? (
          <div
            className="onb-surface flex flex-col items-start gap-4 p-6"
            role="status"
            data-testid="onboarding-import-success"
          >
            <span className="onb-success-ring">
              <Check size={22} strokeWidth={2.6} aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="onb-h2 text-[18px]">{t('onboarding.import.success.title')}</h2>
              <p className="onb-lead text-[14px]">
                {t('onboarding.import.success.body', importedSummary)}
              </p>
            </div>
          </div>
        ) : (
          <>
            <label
              className="onb-drop"
              data-over={dragOver}
              data-testid="onboarding-dropzone"
              style={hasPreview ? { padding: '14px 16px' } : undefined}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void readFile(e.dataTransfer.files[0]);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                data-testid="onboarding-file-input"
                onChange={(e) => void readFile(e.target.files?.[0])}
              />
              <span
                className="onb-ico onb-ico-accent"
                style={{
                  width: hasPreview ? 32 : 40,
                  height: hasPreview ? 32 : 40,
                  borderRadius: 12,
                }}
              >
                {hasPreview ? (
                  <FileJson size={18} aria-hidden="true" />
                ) : (
                  <Upload size={20} aria-hidden="true" />
                )}
              </span>
              <span className="text-[14px] font-semibold">
                {sourceName ?? t('onboarding.import.drop.title')}
              </span>
              <span className="onb-small">{t('onboarding.import.drop.or')}</span>
            </label>

            {error && (
              <p
                role="alert"
                className="m-0 rounded-xl px-3.5 py-2.5 text-[13px]"
                style={{ background: 'oklch(0.62 0.2 25 / 0.14)', color: 'var(--ink)' }}
                data-testid="onboarding-import-error"
              >
                {t(error)}
              </p>
            )}

            {parsed && (
              <section
                className="onb-surface flex flex-col gap-3.5 p-4"
                aria-labelledby="onb-preview"
                data-testid="onboarding-import-preview"
              >
                <h2 id="onb-preview" className="onb-h2">
                  {t('onboarding.import.preview.title')}
                </h2>

                <ArcImportPreview
                  parsed={parsed}
                  selectedSpaceIndices={selectedSpaces}
                  onToggleSpace={toggleSpace}
                  onSelectAllSpaces={() =>
                    setSelectedSpaces(new Set(parsed.spaces.map((_, i) => i)))
                  }
                  onClearSpaces={() => setSelectedSpaces(new Set())}
                  includeFavorites={includeFavorites}
                  onToggleFavorites={setIncludeFavorites}
                  isSample={isSample}
                  cleanup={{
                    skipEmpty,
                    skipSearches,
                    dedupe,
                    onSkipEmpty: setSkipEmpty,
                    onSkipSearches: setSkipSearches,
                    onDedupe: setDedupe,
                  }}
                />

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="onb-btn onb-btn-accent"
                    data-testid="onboarding-import"
                    disabled={phase === 'importing' || nothingSelected}
                    onClick={() => void runImport()}
                  >
                    {phase === 'importing'
                      ? t('onboarding.import.importing')
                      : isSample
                        ? t('onboarding.import.sample.importAction')
                        : t('onboarding.import.action')}
                  </button>
                  <button
                    type="button"
                    className="onb-btn onb-btn-ghost"
                    onClick={reset}
                    disabled={phase === 'importing'}
                  >
                    {t('onboarding.import.clear')}
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {phase !== 'done' && (
          <button
            type="button"
            className="onb-btn onb-btn-ghost self-start"
            data-testid="onboarding-skip"
            onClick={onSkip}
          >
            {t('onboarding.import.skip')}
          </button>
        )}
      </div>
    </div>
  );
}
