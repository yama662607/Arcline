import { ChevronDown, ChevronRight, Folder, Globe, Link2, Sparkles, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { countImportedNodes, filterImportedSidebar } from '../../core/arc-import';
import type { ImportedNode, ImportedSidebar } from '../../core/types';
import { useT } from '../i18n';

export interface CleanupOptionHandlers {
  skipEmpty: boolean;
  skipSearches: boolean;
  dedupe: boolean;
  onSkipEmpty: (next: boolean) => void;
  onSkipSearches: (next: boolean) => void;
  onDedupe: (next: boolean) => void;
}

interface ArcImportPreviewProps {
  parsed: ImportedSidebar;
  selectedSpaceIndices: ReadonlySet<number>;
  onToggleSpace: (index: number) => void;
  onSelectAllSpaces: () => void;
  onClearSpaces: () => void;
  includeFavorites: boolean;
  onToggleFavorites: (next: boolean) => void;
  cleanup?: CleanupOptionHandlers;
  isSample?: boolean;
  compact?: boolean;
}

function formatHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function NodeTree({
  nodes,
  depth = 0,
  emptyLabel,
}: {
  nodes: ReadonlyArray<ImportedNode>;
  depth?: number;
  emptyLabel: string;
}) {
  if (nodes.length === 0) {
    return (
      <p
        className="m-0 py-1 text-[11.5px]"
        style={{ color: 'var(--text-muted, var(--ink-muted))', paddingLeft: depth * 12 }}
      >
        {emptyLabel}
      </p>
    );
  }
  return (
    <ul
      className="m-0 flex list-none flex-col gap-1 p-0"
      style={{ paddingLeft: depth > 0 ? 14 : 0 }}
    >
      {nodes.map((node, idx) =>
        node.kind === 'folder' ? (
          <li key={`f-${depth}-${idx}-${node.title}`} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[12px] font-medium">
              <Folder
                size={12}
                className="shrink-0"
                style={{ color: 'var(--accent, var(--onb-accent))' }}
                aria-hidden="true"
              />
              <span className="min-w-0 truncate">{node.title}</span>
              <span
                className="shrink-0 text-[10.5px]"
                style={{ color: 'var(--text-muted, var(--ink-muted))' }}
              >
                ({node.children.length})
              </span>
            </div>
            {node.children.length > 0 && depth < 2 && (
              <NodeTree nodes={node.children} depth={depth + 1} emptyLabel={emptyLabel} />
            )}
          </li>
        ) : (
          <li
            key={`p-${depth}-${idx}-${node.url}`}
            className="flex items-center justify-between gap-2 text-[11.5px]"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Link2 size={11} className="shrink-0 opacity-60" aria-hidden="true" />
              <span className="truncate">{node.title}</span>
            </span>
            <span
              className="shrink-0 font-mono text-[10.5px]"
              style={{ color: 'var(--text-muted, var(--ink-muted))' }}
            >
              {formatHost(node.url)}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}

export function ArcImportPreview({
  parsed,
  selectedSpaceIndices,
  onToggleSpace,
  onSelectAllSpaces,
  onClearSpaces,
  includeFavorites,
  onToggleFavorites,
  cleanup,
  isSample = false,
  compact = false,
}: ArcImportPreviewProps) {
  const t = useT();
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set([0]));

  const filtered = useMemo(
    () => filterImportedSidebar(parsed, selectedSpaceIndices, includeFavorites),
    [parsed, selectedSpaceIndices, includeFavorites],
  );

  const toggleExpand = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const allSelected =
    parsed.spaces.length > 0 && selectedSpaceIndices.size === parsed.spaces.length;

  return (
    <div className="flex flex-col gap-3" data-testid="arc-import-preview-tree">
      {isSample && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium"
          style={{
            background:
              'var(--onb-accent-soft, color-mix(in oklch, var(--accent) 14%, transparent))',
            color: 'var(--accent, var(--onb-accent))',
          }}
          data-testid="onboarding-sample-banner"
        >
          <Sparkles size={14} className="shrink-0" aria-hidden="true" />
          <span>{t('onboarding.import.sample.banner')}</span>
        </div>
      )}

      {/* Live summary stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatBox
          value={filtered.spaces.length}
          label={t('onboarding.import.preview.spaces')}
          compact={compact}
        />
        <StatBox
          value={filtered.stats.totalPins}
          label={t('onboarding.import.preview.pins')}
          compact={compact}
        />
        <StatBox
          value={filtered.stats.totalFolders}
          label={t('onboarding.import.preview.folders')}
          compact={compact}
        />
        <StatBox
          value={filtered.favorites.length}
          label={t('onboarding.import.preview.favorites')}
          compact={compact}
        />
      </div>

      {/* Favorites (Top Apps) preview & toggle */}
      {parsed.favorites.length > 0 && (
        <div
          className="flex flex-col gap-2 rounded-xl border p-2.5"
          style={{
            borderColor: 'var(--border-subtle, var(--onb-line))',
            background: 'var(--bg-canvas, var(--tile))',
          }}
        >
          <label className="flex cursor-pointer items-center justify-between gap-2 text-[12px] font-semibold">
            <span className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={includeFavorites}
                onChange={(e) => onToggleFavorites(e.target.checked)}
                data-testid="import-toggle-favorites"
              />
              <Star
                size={13}
                style={{ color: 'var(--accent, var(--onb-accent))' }}
                aria-hidden="true"
              />
              <span>{t('onboarding.import.preview.favorites')}</span>
            </span>
            <span
              className="text-[11px] font-normal"
              style={{ color: 'var(--text-muted, var(--ink-muted))' }}
            >
              {parsed.favorites.length}
            </span>
          </label>
          {includeFavorites && (
            <div className="flex flex-wrap gap-1.5">
              {parsed.favorites.slice(0, 8).map((fav) => (
                <span
                  key={fav.url}
                  className="inline-flex max-w-[180px] items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px]"
                  style={{
                    borderColor: 'var(--border-subtle, var(--onb-line))',
                    background: 'var(--bg-surface, var(--onb-surface-strong))',
                  }}
                >
                  <Globe size={10} className="shrink-0 opacity-65" aria-hidden="true" />
                  <span className="truncate">{fav.title}</span>
                </span>
              ))}
              {parsed.favorites.length > 8 && (
                <span
                  className="inline-flex items-center px-1.5 text-[11px]"
                  style={{ color: 'var(--text-muted, var(--ink-muted))' }}
                >
                  +{parsed.favorites.length - 8}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Space selection & expandable tree */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 text-[12px]">
          <span className="font-semibold">
            {t('onboarding.import.preview.selectSpaces', {
              selected: selectedSpaceIndices.size,
              total: parsed.spaces.length,
            })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] underline-offset-2 hover:underline"
              style={{ color: 'var(--accent, var(--onb-accent))' }}
              onClick={allSelected ? onClearSpaces : onSelectAllSpaces}
              data-testid="import-toggle-all-spaces"
            >
              {allSelected
                ? t('onboarding.import.preview.deselectAll')
                : t('onboarding.import.preview.selectAll')}
            </button>
          </div>
        </div>

        <ul
          className={`m-0 flex list-none flex-col gap-1.5 overflow-y-auto p-0 ${compact ? 'max-h-[190px]' : 'max-h-[240px]'}`}
        >
          {parsed.spaces.map((space, idx) => {
            const counts = countImportedNodes(space.pinned);
            const checked = selectedSpaceIndices.has(idx);
            const isOpen = expanded.has(idx);
            const dotColor = `oklch(0.68 0.15 ${space.hue ?? 245})`;
            return (
              <li
                key={`${space.name}-${idx}`}
                className="rounded-xl border transition-opacity"
                style={{
                  borderColor: 'var(--border-subtle, var(--onb-line))',
                  background: 'var(--bg-canvas, var(--tile))',
                  opacity: checked ? 1 : 0.55,
                }}
              >
                <div className="flex items-center gap-2 px-2.5 py-2 text-[12.5px]">
                  <input
                    type="checkbox"
                    checked={checked}
                    aria-label={t('onboarding.import.preview.toggleSpace', { name: space.name })}
                    onChange={() => onToggleSpace(idx)}
                    data-testid={`import-space-check-${idx}`}
                    className="cursor-pointer"
                  />
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: dotColor }}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    onClick={() => toggleExpand(idx)}
                    aria-expanded={isOpen}
                    className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left"
                    style={{ color: 'inherit' }}
                    data-testid={`import-space-expand-${idx}`}
                  >
                    <span className="min-w-0 truncate font-medium">{space.name}</span>
                    <span
                      className="flex shrink-0 items-center gap-1.5 text-[11px]"
                      style={{ color: 'var(--text-muted, var(--ink-muted))' }}
                    >
                      <span>
                        {t('onboarding.import.preview.spacePins', { count: counts.pins })}
                      </span>
                      {counts.folders > 0 && (
                        <span>
                          · {t('onboarding.import.preview.spaceFolders', { count: counts.folders })}
                        </span>
                      )}
                      {isOpen ? (
                        <ChevronDown size={13} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={13} aria-hidden="true" />
                      )}
                    </span>
                  </button>
                </div>
                {isOpen && (
                  <div
                    className="border-t px-3 py-2"
                    style={{ borderColor: 'var(--border-subtle, var(--onb-line))' }}
                  >
                    <NodeTree
                      nodes={space.pinned}
                      emptyLabel={t('onboarding.import.preview.emptySpace')}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Live cleanup options */}
      {cleanup && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border px-3 py-2 text-[11.5px]"
          style={{
            borderColor: 'var(--border-subtle, var(--onb-line))',
            background: 'var(--bg-canvas, var(--tile))',
          }}
        >
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={cleanup.skipEmpty}
              onChange={(e) => cleanup.onSkipEmpty(e.target.checked)}
            />
            <span>{t('settings.import.skipEmpty')}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={cleanup.skipSearches}
              onChange={(e) => cleanup.onSkipSearches(e.target.checked)}
            />
            <span>{t('settings.import.skipSearches')}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={cleanup.dedupe}
              onChange={(e) => cleanup.onDedupe(e.target.checked)}
            />
            <span>{t('settings.import.dedupe')}</span>
          </label>
        </div>
      )}

      <p
        className="m-0 text-[11.5px] leading-[1.5]"
        style={{ color: 'var(--text-muted, var(--ink-muted))' }}
      >
        {t('onboarding.import.preview.tidy', {
          deduped: parsed.stats.deduped,
          empty: parsed.stats.skippedEmptyFolders,
          searches: parsed.stats.skippedSearches,
        })}
      </p>
    </div>
  );
}

function StatBox({ value, label, compact }: { value: number; label: string; compact: boolean }) {
  return (
    <div
      className="flex flex-col gap-0.5 rounded-xl border px-2.5 py-2"
      style={{
        borderColor: 'var(--border-subtle, var(--onb-line))',
        background: 'var(--bg-canvas, var(--tile))',
      }}
    >
      <strong className={`${compact ? 'text-[16px]' : 'text-[19px]'} font-semibold leading-tight`}>
        {value}
      </strong>
      <span
        className="text-[11px] leading-tight"
        style={{ color: 'var(--text-muted, var(--ink-muted))' }}
      >
        {label}
      </span>
    </div>
  );
}
