import { useEffect } from 'react';

import type { SpaceSnapshot, TabEntry } from '@/shared/spaces';
import { activateTab, closeTab, moveTabToSpace, toggleTabPinned } from '@/lib/tabs';

interface TabContextMenuProps {
  tab: TabEntry;
  spaces: SpaceSnapshot[];
  activeSpaceId: number | null;
  x: number;
  y: number;
  onRequestClose: () => void;
}

export function TabContextMenu({ tab, spaces, activeSpaceId, x, y, onRequestClose }: TabContextMenuProps) {
  useEffect(() => {
    const handler = (event: MouseEvent | KeyboardEvent) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        onRequestClose();
        return;
      }
      if (event.type === 'mousedown') {
        onRequestClose();
      }
    };

    document.addEventListener('mousedown', handler, { capture: true });
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', handler);
    };
  }, [onRequestClose]);

  const otherSpaces = spaces.filter((space) => space.id !== activeSpaceId);

  return (
    <div
      className="fixed z-50 min-w-[200px] rounded-lg border border-white/10 bg-slate-900/95 p-2 text-sm text-slate-200 shadow-xl backdrop-blur"
      style={{ top: y, left: x }}
      onMouseDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-white/10"
        onClick={() => {
          activateTab(tab.id).catch((error) => console.warn(error));
          onRequestClose();
        }}
      >
        <span>Activate</span>
      </button>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-white/10"
        onClick={() => {
          toggleTabPinned(tab.id).catch((error) => console.warn(error));
          onRequestClose();
        }}
      >
        <span>{tab.pinned ? 'Unpin' : 'Pin'}</span>
      </button>
      {otherSpaces.length > 0 && (
        <div className="mt-1 border-t border-white/10 pt-1">
          <p className="px-2 pb-1 text-xs uppercase tracking-wide text-slate-400">Move to space</p>
          {otherSpaces.map((space) => (
            <button
              key={space.id}
              type="button"
              className="flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-white/10"
              onClick={() => {
                moveTabToSpace(tab.id, space.id).catch((error) => console.warn(error));
                onRequestClose();
              }}
            >
              <span>{space.name}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-1 border-t border-white/10 pt-1">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded px-2 py-1.5 text-red-300 hover:bg-red-500/20"
          onClick={() => {
            closeTab(tab.id).catch((error) => console.warn(error));
            onRequestClose();
          }}
        >
          <span>Close Tab</span>
        </button>
      </div>
    </div>
  );
}
