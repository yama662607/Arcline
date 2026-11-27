import { Archive, PanelLeft, PanelLeftClose, Plus, Settings as SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import type { Space } from '../../core/types';
import { useT } from '../i18n';
import { DRAG_MIME, type DragPayload, readDragPayload } from './FavoritesGrid';
import { SpaceGlyph } from './SpaceGlyph';

const SPACE_DRAG_MIME = 'application/x-arcline-space';

interface SpaceSwitcherProps {
  spaces: Space[];
  activeSpaceId: string;
  isOverlay: boolean;
  archiveFanOpen: boolean;
  archivedCount: number;
  onSelect: (spaceId: string) => void;
  onCreate: () => void;
  onToggleArchiveFan: () => void;
  onToggleSidebarMode: () => void;
  onOpenSettings: () => void;
  onMoveSpace: (spaceId: string, index: number) => void;
  onDropOnSpace: (payload: DragPayload, targetSpaceId: string) => void;
  onSpaceContextMenu: (e: React.MouseEvent, space: Space) => void;
}

export function SpaceSwitcher({
  spaces,
  activeSpaceId,
  isOverlay,
  archiveFanOpen,
  archivedCount,
  onSelect,
  onCreate,
  onToggleArchiveFan,
  onToggleSidebarMode,
  onOpenSettings,
  onMoveSpace,
  onDropOnSpace,
  onSpaceContextMenu,
}: SpaceSwitcherProps) {
  const t = useT();
  const [dragHoverSpaceId, setDragHoverSpaceId] = useState<string | null>(null);

  return (
    /* Authentic Arc Bottom Bar: Archive (left) | Centered Space icons/dots | Settings & + (right) */
    <footer className="relative flex h-11 shrink-0 items-center justify-between gap-2 px-3">
      {dragHoverSpaceId && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-full border px-2.5 py-0.5 text-[11px] font-medium shadow-md"
          style={{
            borderColor: 'var(--rule)',
            backgroundColor: 'var(--menu)',
            color: 'var(--ink)',
          }}
        >
          {t('sidebar.switcher.moveTo', {
            name: spaces.find((s) => s.id === dragHoverSpaceId)?.name ?? '',
          })}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          data-arcline-archive-trigger="true"
          title={t('sidebar.switcher.archiveTitle')}
          aria-label={t('sidebar.switcher.archiveLabel')}
          aria-expanded={archiveFanOpen}
          onClick={onToggleArchiveFan}
          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all hover:bg-[var(--hover)] hover:text-[var(--ink)] active:scale-95 cursor-pointer"
          style={{
            color: archiveFanOpen ? 'var(--ink)' : 'var(--ink-muted)',
            backgroundColor: archiveFanOpen ? 'var(--hover)' : undefined,
          }}
        >
          <Archive size={15} strokeWidth={1.8} />
          {archivedCount > 0 && !archiveFanOpen && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1 right-1 h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: 'var(--accent)' }}
            />
          )}
        </button>

        <button
          type="button"
          data-arcline-sidebar-mode-toggle="true"
          title={t(isOverlay ? 'sidebar.switcher.dockTitle' : 'sidebar.switcher.floatTitle')}
          aria-label={t(isOverlay ? 'sidebar.switcher.dockTitle' : 'sidebar.switcher.floatTitle')}
          onClick={onToggleSidebarMode}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all hover:bg-[var(--hover)] hover:text-[var(--ink)] active:scale-95 cursor-pointer"
          style={{ color: isOverlay ? 'var(--ink-muted)' : 'var(--accent)' }}
        >
          {isOverlay ? (
            <PanelLeft size={15} strokeWidth={1.8} />
          ) : (
            <PanelLeftClose size={15} strokeWidth={1.8} />
          )}
        </button>
      </div>

      <nav
        aria-label={t('sidebar.switcher.spaces')}
        className="arcline-hscroll flex flex-1 items-center justify-center gap-1"
        onWheel={(e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
      >
        {spaces.map((space, index) => {
          const isActive = space.id === activeSpaceId;
          const isDragHover = dragHoverSpaceId === space.id;

          return (
            <button
              key={space.id}
              type="button"
              draggable
              title={space.name}
              aria-label={t('sidebar.switcher.spaceLabel', { name: space.name })}
              aria-pressed={isActive}
              onClick={() => onSelect(space.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSpaceContextMenu(e, space);
              }}
              onDragStart={(e) => {
                e.dataTransfer.setData(SPACE_DRAG_MIME, space.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (
                  !e.dataTransfer.types.includes(DRAG_MIME) &&
                  !e.dataTransfer.types.includes(SPACE_DRAG_MIME)
                ) {
                  return;
                }
                e.preventDefault();
                setDragHoverSpaceId(space.id);
              }}
              onDragLeave={() => setDragHoverSpaceId(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragHoverSpaceId(null);
                const draggedSpaceId = e.dataTransfer.getData(SPACE_DRAG_MIME);
                if (draggedSpaceId && draggedSpaceId !== space.id) {
                  onMoveSpace(draggedSpaceId, index);
                  return;
                }
                const payload = readDragPayload(e.dataTransfer);
                if (payload) onDropOnSpace(payload, space.id);
              }}
              className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150 hover:bg-[var(--hover)] active:scale-92 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              style={{
                color: isActive ? 'var(--ink)' : 'var(--ink-muted)',
                opacity: isActive || isDragHover ? 1 : 0.44,
                transform: isDragHover ? 'scale(1.18)' : undefined,
                boxShadow: isDragHover ? '0 0 0 1.5px var(--accent)' : undefined,
                backgroundColor: isDragHover
                  ? 'color-mix(in oklch, var(--accent) 18%, var(--hover))'
                  : undefined,
              }}
            >
              <SpaceGlyph icon={space.icon} size={15} />
              {isActive && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0.5 left-1/2 h-[2px] w-3 -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: 'currentColor', opacity: 0.7 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          title={t('sidebar.switcher.settings')}
          aria-label={t('sidebar.switcher.settings')}
          onClick={onOpenSettings}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:bg-[var(--hover)] hover:text-[var(--ink)] active:scale-95 cursor-pointer"
          style={{ color: 'var(--ink-muted)' }}
        >
          <SettingsIcon size={14} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          title={t('sidebar.switcher.create')}
          aria-label={t('sidebar.switcher.create')}
          onClick={onCreate}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:bg-[var(--hover)] hover:text-[var(--ink)] active:scale-95 cursor-pointer"
          style={{ color: 'var(--ink-muted)' }}
        >
          <Plus size={16} strokeWidth={1.9} />
        </button>
      </div>
    </footer>
  );
}
