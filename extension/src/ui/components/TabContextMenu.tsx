import { useEffect, useMemo } from 'react';

import {
  useActivateTab,
  useCloseTab,
  useFavorites,
  useToggleFavorite,
  useToggleTabPinned,
} from '@/hooks/use-spaces-query';
import type { TabEntry } from '@/shared/types';

interface TabContextMenuProps {
  tab: TabEntry;
  x: number;
  y: number;
  onClose: () => void;
}

export function TabContextMenu({ tab, x, y, onClose }: TabContextMenuProps) {
  const { data: favorites } = useFavorites();
  const { mutateAsync: togglePinned } = useToggleTabPinned();
  const { mutateAsync: toggleFavorite } = useToggleFavorite();
  const { mutateAsync: activate } = useActivateTab();
  const { mutateAsync: close } = useCloseTab();

  const isFavorite = useMemo(
    () => favorites?.some((fav) => fav.url === tab.url),
    [favorites, tab.url]
  );

  useEffect(() => {
    const handler = (event: MouseEvent | KeyboardEvent) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        onClose();
        return;
      }
      if (event.type === 'mousedown') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handler, { capture: true });
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-50 min-w-[200px] rounded-lg border border-white/10 bg-slate-900/95 p-2 text-sm text-slate-200 shadow-xl backdrop-blur"
      style={{ top: y, left: x }}
      onMouseDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      role="menu"
      tabIndex={-1}
      aria-label="Tab actions"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-white/10"
        onClick={() => {
          activate(tab.id).catch((error) => console.warn(error));
          onClose();
        }}
      >
        <span>Activate</span>
      </button>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-white/10"
        onClick={() => {
          toggleFavorite(tab).catch((error) => console.warn(error));
          onClose();
        }}
      >
        <span>{isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}</span>
      </button>
      <div className="my-1 h-px bg-white/10" />
      <button
        type="button"
        className="flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-white/10 text-xs text-slate-400"
        onClick={() => {
          togglePinned({ tabId: tab.id, pinned: !tab.pinned }).catch((error) =>
            console.warn(error)
          );
          onClose();
        }}
      >
        <span>{tab.pinned ? 'Unpin from Space' : 'Pin in Space'}</span>
      </button>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-white/10 text-red-400"
        onClick={() => {
          close(tab.id).catch((error) => console.warn(error));
          onClose();
        }}
      >
        <span>Close</span>
      </button>
    </div>
  );
}
