import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRight, FolderInput, Trash2, Type } from 'lucide-react';
import type React from 'react';
import { useCallback, useState } from 'react';

import {
  useMovePinnedItem,
  useRemovePinnedItem,
  useUpdatePinnedItem,
} from '@/hooks/use-spaces-query';
import type { PinnedItem } from '@/shared/types';
import { useSpacesStore } from '@/store';

interface PinnedItemContextMenuProps {
  children: React.ReactNode;
  item: PinnedItem;
}

export function PinnedItemContextMenu({ children, item }: PinnedItemContextMenuProps) {
  const { mutate: removeItem } = useRemovePinnedItem();
  const { mutate: updateItem } = useUpdatePinnedItem();
  const { mutate: moveItem } = useMovePinnedItem();

  const spaces = useSpacesStore((state) => state.spaces);

  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(item.title);

  const handleRename = useCallback(() => {
    if (newTitle.trim() && newTitle !== item.title) {
      updateItem({ id: item.id, changes: { title: newTitle.trim() } });
    }
    setIsRenaming(false);
  }, [newTitle, item.id, item.title, updateItem]);

  const handleDelete = useCallback(() => {
    // eslint-disable-next-line no-alert
    if (
      item.type === 'folder' &&
      !confirm(`Are you sure you want to delete folder "${item.title}"?`)
    ) {
      return;
    }
    removeItem(item.id);
  }, [item, removeItem]);

  const handleMoveToSpace = useCallback(
    (spaceName: string) => {
      moveItem({
        id: item.id,
        spaceName,
        parentId: undefined, // Move to root of target space
        index: undefined, // Add at the end
      });
    },
    [item.id, moveItem]
  );

  const menuItemClass =
    'flex cursor-pointer select-none items-center gap-2 rounded py-1.5 px-2 outline-none hover:bg-white/10 data-[highlighted]:bg-white/10';

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="min-w-[220px] rounded-lg border border-white/10 bg-slate-900/95 p-1.5 text-sm text-slate-200 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
            {/* Rename */}
            <ContextMenu.Item className={menuItemClass} onSelect={() => setIsRenaming(true)}>
              <Type className="h-4 w-4 text-slate-400" />
              <span>Rename...</span>
            </ContextMenu.Item>

            {/* Move to Space */}
            <ContextMenu.Sub>
              <ContextMenu.SubTrigger className={menuItemClass}>
                <FolderInput className="h-4 w-4 text-slate-400" />
                <span className="flex-1">Move to Space...</span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </ContextMenu.SubTrigger>
              <ContextMenu.Portal>
                <ContextMenu.SubContent className="min-w-[180px] rounded-lg border border-white/10 bg-slate-900/95 p-1.5 shadow-xl backdrop-blur-md">
                  {spaces.map((space) => (
                    <ContextMenu.Item
                      key={space.id}
                      className={menuItemClass}
                      onSelect={() => handleMoveToSpace(space.name)}
                    >
                      {space.icon && <span className="text-base">{space.icon}</span>}
                      <span>{space.name}</span>
                    </ContextMenu.Item>
                  ))}
                </ContextMenu.SubContent>
              </ContextMenu.Portal>
            </ContextMenu.Sub>

            <ContextMenu.Separator className="my-1.5 h-px bg-white/10" />

            {/* Delete */}
            <ContextMenu.Item
              className="flex cursor-pointer select-none items-center gap-2 rounded py-1.5 px-2 outline-none hover:bg-red-500/20 text-red-400 data-[highlighted]:bg-red-500/20 data-[highlighted]:text-red-400"
              onSelect={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
              <span>{item.type === 'folder' ? 'Delete Folder' : 'Unpin'}</span>
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {/* Rename Dialog */}
      {isRenaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg border border-white/10 bg-slate-900 p-4 shadow-xl">
            <h3 className="mb-3 text-sm font-medium text-white">
              Rename {item.type === 'folder' ? 'Folder' : 'Item'}
            </h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              className="w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              // biome-ignore lint/a11y/noAutofocus: intentional focus for UX
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="rounded px-3 py-1.5 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRename}
                className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
