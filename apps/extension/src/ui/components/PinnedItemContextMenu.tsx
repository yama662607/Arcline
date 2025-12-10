import { useEffect } from 'react';

import { useRemovePinnedItem, useUpdatePinnedItem } from '@/hooks/use-spaces-query';
import type { PinnedItem } from '@/shared/types';

interface PinnedItemContextMenuProps {
  item: PinnedItem;
  x: number;
  y: number;
  onClose: () => void;
}

export function PinnedItemContextMenu({ item, x, y, onClose }: PinnedItemContextMenuProps) {
  const { mutate: removeItem } = useRemovePinnedItem();
  const { mutate: updateItem } = useUpdatePinnedItem();

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

  const handleRename = () => {
    // TODO: Replace with a better UI (inline input or modal)
    // eslint-disable-next-line no-alert
    const title = prompt('Enter new title:', item.title);
    if (title && title !== item.title) {
      updateItem({ id: item.id, changes: { title } });
    }
    onClose();
  };

  const handleDelete = () => {
    // eslint-disable-next-line no-alert
    if (
      item.type === 'folder' &&
      !confirm(`Are you sure you want to delete folder "${item.title}"?`)
    ) {
      onClose();
      return;
    }
    removeItem(item.id);
    onClose();
  };

  return (
    <div
      className="fixed z-50 min-w-[160px] rounded-lg border border-white/10 bg-slate-900/95 p-1 text-sm text-slate-200 shadow-xl backdrop-blur"
      style={{ top: y, left: x }}
      onMouseDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      role="menu"
      tabIndex={-1}
      aria-label="Pinned item actions"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-white/10"
        onClick={handleRename}
      >
        <span>Rename</span>
      </button>

      <div className="my-1 h-px bg-white/10" />

      <button
        type="button"
        className="flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-white/10 text-red-400"
        onClick={handleDelete}
      >
        <span>{item.type === 'folder' ? 'Delete Folder' : 'Unpin'}</span>
      </button>
    </div>
  );
}
