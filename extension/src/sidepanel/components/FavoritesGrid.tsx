import { Plus, VolumeX, X } from 'lucide-react';
import { useState } from 'react';
import type { Favorite, LiveTab } from '../../core/types';
import { useT } from '../i18n';
import { Favicon } from './Favicon';

export const DRAG_MIME = 'application/x-arcline-drag';

export type DragPayload =
  | { kind: 'favorite'; id: string }
  | { kind: 'pin'; id: string }
  | { kind: 'folder'; id: string }
  | { kind: 'tab'; tabId: number };

export function readDragPayload(dt: DataTransfer): DragPayload | null {
  try {
    const raw = dt.getData(DRAG_MIME);
    if (!raw) return null;
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

interface FavoritesGridProps {
  favorites: Favorite[];
  tabs: Map<number, LiveTab>;
  activeTabId?: number;
  onOpen: (favoriteId: string) => void;
  onUnload: (favoriteId: string) => void;
  onToggleMute: (tabId: number) => void;
  onAddActiveTab: () => void;
  onDropPayload: (payload: DragPayload, targetIndex?: number) => void;
  onContextMenu: (e: React.MouseEvent, fav: Favorite) => void;
}

export function FavoritesGrid({
  favorites,
  tabs,
  activeTabId,
  onOpen,
  onUnload,
  onToggleMute,
  onAddActiveTab,
  onDropPayload,
  onContextMenu,
}: FavoritesGridProps) {
  const t = useT();
  const [gridDragOver, setGridDragOver] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Authentic Arc Browser 4-column tile grid (scales cleanly when fewer than 4 items)
  const columns =
    favorites.length === 0 ? 1 : favorites.length <= 3 ? Math.max(2, favorites.length) : 4;

  return (
    <section
      aria-label={t('sidebar.favorites.label')}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
        e.preventDefault();
        setGridDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setGridDragOver(false);
          setDropIndex(null);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setGridDragOver(false);
        const idx = dropIndex ?? undefined;
        setDropIndex(null);
        setDraggingId(null);
        const payload = readDragPayload(e.dataTransfer);
        if (payload) onDropPayload(payload, idx);
      }}
      className="shrink-0 px-3 pt-1 pb-2"
    >
      <div
        className="grid gap-2 rounded-xl transition-all duration-150"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          outline: gridDragOver ? '1.5px dashed var(--accent)' : 'none',
          outlineOffset: '3px',
          backgroundColor: gridDragOver
            ? 'color-mix(in oklch, var(--accent) 8%, transparent)'
            : undefined,
        }}
      >
        {favorites.map((fav, index) => {
          const live = fav.tabId !== undefined ? tabs.get(fav.tabId) : undefined;
          const isActive = fav.tabId !== undefined && fav.tabId === activeTabId;
          const isOpen = live !== undefined;
          const isPlaying = Boolean(live?.audible && !live.muted);
          const isMuted = Boolean(live?.muted);
          const isLoading = live?.status === 'loading';
          const isBeingDragged = draggingId === fav.id;

          return (
            <div
              key={fav.id}
              className="group/tile relative transition-opacity duration-120"
              style={{ opacity: isBeingDragged ? 0.42 : 1 }}
            >
              <button
                type="button"
                draggable
                title={live ? `${live.title}\n${live.url}` : `${fav.title}\n${fav.url}`}
                aria-label={fav.title}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onOpen(fav.id)}
                onAuxClick={(e) => {
                  if (e.button === 1 && isOpen) {
                    e.preventDefault();
                    onUnload(fav.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onContextMenu(e, fav);
                }}
                onDragStart={(e) => {
                  setDraggingId(fav.id);
                  e.dataTransfer.setData(
                    DRAG_MIME,
                    JSON.stringify({ kind: 'favorite', id: fav.id } satisfies DragPayload),
                  );
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDropIndex(null);
                  setGridDragOver(false);
                }}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
                  e.preventDefault();
                  setDropIndex(index);
                }}
                className="relative grid h-12 w-full place-items-center rounded-[12px] transition-[background-color,box-shadow,transform] duration-120 active:scale-[0.95] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                style={{
                  backgroundColor: isActive ? 'var(--tile-active)' : 'var(--tile)',
                  boxShadow:
                    dropIndex === index
                      ? 'inset 0 0 0 2px var(--accent), 0 0 0 2px color-mix(in oklch, var(--accent) 28%, transparent)'
                      : isActive
                        ? 'inset 0 0 0 1px rgb(255 255 255 / 0.28), 0 2px 8px rgb(0 0 0 / 0.12)'
                        : 'none',
                  transform: dropIndex === index ? 'scale(1.03)' : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--tile-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--tile)';
                }}
              >
                <span className="relative grid place-items-center">
                  <Favicon
                    url={live?.url || fav.url}
                    favIconUrl={live?.favIconUrl}
                    title={fav.title}
                    size={20}
                  />
                  {isLoading && <span aria-hidden="true" className="arcline-loading-ring" />}
                </span>

                {isOpen && !isActive && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: 'var(--ink-muted)', opacity: 0.55 }}
                  />
                )}
              </button>

              {(isPlaying || isMuted) && fav.tabId !== undefined && (
                <button
                  type="button"
                  title={isMuted ? t('sidebar.tab.unmute') : t('sidebar.tab.mute')}
                  aria-label={t(
                    isMuted ? 'sidebar.favorites.unmuteLabel' : 'sidebar.favorites.muteLabel',
                    {
                      title: fav.title,
                    },
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (fav.tabId !== undefined) onToggleMute(fav.tabId);
                  }}
                  className="absolute right-1 bottom-1 flex h-4 w-4 items-center justify-center rounded-full transition-transform hover:scale-110 cursor-pointer"
                  style={{
                    backgroundColor: 'color-mix(in oklch, var(--menu) 85%, transparent)',
                    color: 'var(--ink)',
                  }}
                >
                  {isMuted ? (
                    <VolumeX size={10} strokeWidth={2.2} />
                  ) : (
                    <span className="arcline-eq" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                </button>
              )}

              {isOpen && (
                <button
                  type="button"
                  title={t('sidebar.favorites.closeTabTitle')}
                  aria-label={t('sidebar.favorites.closeTabLabel', { title: fav.title })}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnload(fav.id);
                  }}
                  className="pointer-events-none absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full opacity-0 transition-all duration-120 hover:scale-110 group-hover/tile:pointer-events-auto group-hover/tile:opacity-100 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--menu)',
                    color: 'var(--ink-muted)',
                    boxShadow: '0 2px 6px rgb(0 0 0 / 0.25)',
                  }}
                >
                  <X size={10} strokeWidth={2.5} />
                </button>
              )}
            </div>
          );
        })}

        {favorites.length === 0 && (
          <button
            type="button"
            onClick={onAddActiveTab}
            className="col-span-full flex h-11 items-center justify-center gap-1.5 rounded-[12px] border border-dashed text-[12px] transition-colors hover:bg-[var(--hover)] cursor-pointer"
            style={{
              borderColor: 'var(--rule)',
              color: 'var(--ink-muted)',
            }}
          >
            <Plus size={14} />
            <span>{t('sidebar.favorites.addTitle')}</span>
          </button>
        )}
      </div>
    </section>
  );
}
