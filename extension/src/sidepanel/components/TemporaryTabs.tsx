import { ArrowDown, Pin, Plus, VolumeX, X } from 'lucide-react';
import { useState } from 'react';
import type { LiveTab } from '../../core/types';
import { useT } from '../i18n';
import { Favicon } from './Favicon';
import { DRAG_MIME, type DragPayload, readDragPayload } from './FavoritesGrid';

function shortHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isEmptySpaceCanvasTab(tab: LiveTab): boolean {
  return tab.url.includes('/empty-space.html');
}

interface TemporaryTabsProps {
  spaceId: string;
  tabIds: number[];
  tabs: Map<number, LiveTab>;
  activeTabId?: number;
  onActivate: (tabId: number, url?: string) => void;
  onClose: (tabId: number) => void;
  onPin: (tabId: number) => void;
  onToggleMute: (tabId: number) => void;
  onNewTab: () => void;
  onClearAll: () => void;
  onDropPayload: (payload: DragPayload, targetIndex?: number) => void;
  onContextMenu: (e: React.MouseEvent, tab: LiveTab) => void;
}

export function TemporaryTabs({
  spaceId,
  tabIds,
  tabs,
  activeTabId,
  onActivate,
  onClose,
  onPin,
  onToggleMute,
  onNewTab,
  onClearAll,
  onDropPayload,
  onContextMenu,
}: TemporaryTabsProps) {
  const t = useT();
  const [dropState, setDropState] = useState<{ idx: number; pos: 'before' | 'after' } | null>(null);
  const [sectionDragOver, setSectionDragOver] = useState(false);
  const [draggingTabId, setDraggingTabId] = useState<number | null>(null);

  const liveTabs = tabIds
    .map((id) => tabs.get(id))
    .filter((t): t is LiveTab => t !== undefined && !isEmptySpaceCanvasTab(t));

  return (
    <section
      aria-label={t('sidebar.temp.sectionLabel')}
      data-space-id={spaceId}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
        e.preventDefault();
        setSectionDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setSectionDragOver(false);
          setDropState(null);
        }
      }}
      onDrop={(e) => {
        if (e.defaultPrevented) return;
        e.preventDefault();
        setSectionDragOver(false);
        const state = dropState;
        setDropState(null);
        setDraggingTabId(null);
        const payload = readDragPayload(e.dataTransfer);
        if (!payload) return;
        const idx = state ? (state.pos === 'before' ? state.idx : state.idx + 1) : undefined;
        onDropPayload(payload, idx);
      }}
      className="flex flex-1 flex-col px-3 pt-1 pb-3"
    >
      {/* Authentic Arc hairline divider + ↓ Clear */}
      <div className="my-1.5 flex h-5 items-center gap-2.5 pl-1 pr-0.5">
        <div
          className="h-px flex-1 transition-colors"
          style={{
            backgroundColor: sectionDragOver ? 'var(--accent)' : 'var(--rule)',
          }}
        />
        {liveTabs.length > 0 && (
          <button
            type="button"
            title={t('sidebar.temp.clearAllTitle')}
            onClick={onClearAll}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium transition-all hover:bg-[var(--hover)] hover:text-[var(--ink)] active:scale-95 cursor-pointer"
            style={{ color: 'var(--ink-muted)' }}
          >
            <ArrowDown size={11} strokeWidth={2.2} />
            <span>{t('sidebar.temp.clear')}</span>
          </button>
        )}
      </div>

      {/* Authentic Arc + New Tab rounded pill */}
      <button
        type="button"
        onClick={onNewTab}
        className="mb-1.5 flex h-[36px] items-center gap-3 rounded-[10px] px-2.5 text-left text-[13.5px] transition-[background-color,transform] duration-100 active:scale-[0.985] cursor-pointer"
        style={{
          backgroundColor: 'var(--tile)',
          color: 'var(--ink-muted)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--tile-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--tile)';
        }}
      >
        <span className="grid size-[18px] shrink-0 place-items-center">
          <Plus size={16} strokeWidth={2} />
        </span>
        <span>{t('sidebar.temp.newTab')}</span>
      </button>

      {liveTabs.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {liveTabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId;
            const isLoading = tab.status === 'loading';
            const isPlaying = tab.audible && !tab.muted;
            const host = shortHostname(tab.url);
            const showSubtitle = Boolean(host && tab.title.toLowerCase() !== host.toLowerCase());
            const dropClass =
              dropState?.idx === idx
                ? dropState.pos === 'before'
                  ? 'drop-line-top'
                  : 'drop-line-bottom'
                : '';

            return (
              <li
                key={tab.id}
                draggable
                style={{ opacity: draggingTabId === tab.id ? 0.42 : 1 }}
                onDragStart={(e) => {
                  setDraggingTabId(tab.id);
                  e.dataTransfer.setData(
                    DRAG_MIME,
                    JSON.stringify({ kind: 'tab', tabId: tab.id } satisfies DragPayload),
                  );
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDraggingTabId(null);
                  setDropState(null);
                  setSectionDragOver(false);
                }}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
                  setDropState({ idx, pos });
                }}
                onDragLeave={() => setDropState(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
                  setDropState(null);
                  setDraggingTabId(null);
                  const payload = readDragPayload(e.dataTransfer);
                  if (payload) onDropPayload(payload, pos === 'before' ? idx : idx + 1);
                }}
              >
                <div
                  className={`group flex min-h-[38px] items-center gap-2 rounded-[10px] py-1 pr-1.5 pl-2.5 transition-[background-color,box-shadow,transform] duration-100 ${
                    isActive ? '' : 'hover:bg-[var(--hover)]'
                  } ${dropClass}`}
                  style={{
                    backgroundColor: isActive ? 'var(--pill)' : undefined,
                    boxShadow: isActive ? 'var(--pill-shadow)' : undefined,
                  }}
                >
                  <button
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    title={`${tab.title}\n${tab.url}`}
                    onClick={() => onActivate(tab.id, tab.url)}
                    onAuxClick={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        onClose(tab.id);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onContextMenu(e, tab);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
                  >
                    <span className="relative grid size-[18px] shrink-0 place-items-center">
                      <Favicon
                        url={tab.url}
                        favIconUrl={tab.favIconUrl}
                        title={tab.title}
                        size={16}
                      />
                      {isLoading && <span aria-hidden="true" className="arcline-loading-ring" />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className="arcline-title-fade text-[13.5px] leading-snug"
                        style={{ fontWeight: isActive ? 500 : 400 }}
                      >
                        {tab.title}
                      </span>
                      {showSubtitle && (
                        <span
                          className="truncate text-[11px] leading-tight"
                          style={{ color: 'var(--ink-muted)' }}
                        >
                          {host}
                        </span>
                      )}
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-0.5">
                    {(isPlaying || tab.muted) && (
                      <button
                        type="button"
                        title={tab.muted ? t('sidebar.tab.unmute') : t('sidebar.tab.mute')}
                        aria-label={tab.muted ? t('sidebar.tab.unmute') : t('sidebar.tab.mute')}
                        onClick={() => onToggleMute(tab.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--hover)] cursor-pointer"
                        style={{ color: tab.muted ? 'var(--ink-muted)' : 'var(--ink)' }}
                      >
                        {tab.muted ? (
                          <VolumeX size={13} />
                        ) : (
                          <span className="arcline-eq" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                          </span>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      title={t('sidebar.temp.pinTitle')}
                      aria-label={t('sidebar.tab.pin')}
                      onClick={() => onPin(tab.id)}
                      className="hidden h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--hover)] group-hover:flex cursor-pointer"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      <Pin size={12} />
                    </button>
                    <button
                      type="button"
                      title={t('sidebar.tab.close')}
                      aria-label={t('sidebar.tab.close')}
                      onClick={() => onClose(tab.id)}
                      className="hidden h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-[var(--hover)] group-hover:flex cursor-pointer"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
