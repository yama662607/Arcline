import { Archive, RotateCcw, Settings2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ArchivedTab } from '../../core/types';
import { useT } from '../i18n';
import { Favicon } from './Favicon';

interface ArchiveFanProps {
  open: boolean;
  archivedTabs: ArchivedTab[];
  onClose: () => void;
  onRestore: (archiveId: string) => void;
  onRemove: (archiveId: string) => void;
  onOpenAll: () => void;
}

function shortHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function ArchiveFan({
  open,
  archivedTabs,
  onClose,
  onRestore,
  onRemove,
  onOpenAll,
}: ArchiveFanProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        // Ignore clicks on the Archive toggle button itself (it handles toggling)
        if (target instanceof HTMLElement && target.closest('[data-arcline-archive-trigger]')) {
          return;
        }
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  const recent = archivedTabs.slice(0, 8);
  const now = Date.now();

  const formatAge = (archivedAt: number): string => {
    const mins = Math.max(0, Math.floor((now - archivedAt) / 60_000));
    if (mins < 1) return t('sidebar.archiveFan.justNow');
    if (mins < 60) return t('sidebar.archiveFan.minutesAgo', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('sidebar.archiveFan.hoursAgo', { count: hours });
    return t('sidebar.archiveFan.daysAgo', { count: Math.floor(hours / 24) });
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={t('sidebar.archiveFan.title')}
      data-arcline-archive-fan="true"
      className="absolute right-2.5 bottom-12 left-2.5 z-40 flex flex-col gap-1.5"
    >
      {/* Arc-style fanned card stack rising upward from the Archive button */}
      {recent.length === 0 ? (
        <div
          className="rounded-xl border px-3 py-4 text-center shadow-xl backdrop-blur-xl"
          style={{
            borderColor: 'var(--rule)',
            backgroundColor: 'color-mix(in oklch, var(--menu) 92%, transparent)',
            color: 'var(--ink-muted)',
          }}
        >
          <Archive size={16} className="mx-auto mb-1.5 opacity-60" />
          <p className="m-0 text-[11.5px]">{t('sidebar.archiveFan.empty')}</p>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-1">
          {recent.map((entry, idx) => {
            // Subtle Arc-like fan tilt: bottom-most (newest) is flat, higher cards fan slightly
            const fanAngle = Math.min(idx, 5) * -0.7;
            const fanOffsetX = Math.min(idx, 5) * 1.5;
            return (
              <div
                key={entry.id}
                className="group/fan relative flex items-center gap-2 rounded-[11px] border px-2.5 py-2 shadow-lg backdrop-blur-xl transition-all duration-150 hover:z-10 hover:translate-x-0 hover:scale-[1.015] hover:rotate-0"
                style={{
                  borderColor: 'var(--rule)',
                  backgroundColor: 'color-mix(in oklch, var(--menu) 94%, transparent)',
                  transform: `translateX(${fanOffsetX}px) rotate(${fanAngle}deg)`,
                  transformOrigin: 'left bottom',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onRestore(entry.id);
                    onClose();
                  }}
                  title={`${entry.title}\n${entry.url}`}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
                >
                  <Favicon url={entry.url} title={entry.title} size={15} />
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate text-[12px] font-medium leading-tight"
                      style={{ color: 'var(--ink)' }}
                    >
                      {entry.title}
                    </div>
                    <div
                      className="mt-0.5 flex items-center gap-1.5 truncate text-[10.5px]"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      <span className="truncate">{shortHost(entry.url)}</span>
                      <span>·</span>
                      <span className="shrink-0">{formatAge(entry.archivedAt)}</span>
                    </div>
                  </div>
                  <RotateCcw
                    size={12.5}
                    className="shrink-0 opacity-0 transition-opacity group-hover/fan:opacity-80"
                    style={{ color: 'var(--accent)' }}
                  />
                </button>
                <button
                  type="button"
                  aria-label="Remove archived tab"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(entry.id);
                  }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-[var(--hover)] group-hover/fan:opacity-75 hover:!opacity-100 cursor-pointer"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Compact footer pill to open full Archive tab in Settings */}
      <div
        className="flex items-center justify-between rounded-xl border px-2.5 py-1.5 text-[11px] shadow-md backdrop-blur-xl"
        style={{
          borderColor: 'var(--rule)',
          backgroundColor: 'color-mix(in oklch, var(--menu) 92%, transparent)',
          color: 'var(--ink-muted)',
        }}
      >
        <span className="font-medium">
          {t('sidebar.archiveFan.title')} ({archivedTabs.length})
        </span>
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenAll();
          }}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)] cursor-pointer"
          style={{ color: 'var(--ink-muted)' }}
        >
          <Settings2 size={11.5} />
          <span>{t('sidebar.archiveFan.viewAll')}</span>
        </button>
      </div>
    </div>
  );
}
