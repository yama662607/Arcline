import { type DragEvent, useCallback, useState } from 'react';

import { useCreatePinnedTab, useMovePinnedItem } from '@/hooks/use-spaces-query';
import type { PinnedItem } from '@/shared/types';
import { getDragData } from '@/ui/hooks/use-tab-drag-drop';

export type DropPosition = 'top' | 'bottom' | 'inside';

interface UsePinnedItemDropProps {
  item: PinnedItem | null; // null represents the empty list container
  spaceName: string;
  index?: number; // Index of the item in its parent list
}

function resolveDropPosition(
  item: PinnedItem | null,
  e: DragEvent<HTMLElement>
): { position: DropPosition; isSelf: boolean } {
  const dragData = getDragData(e);
  if (!dragData) {
    return { position: 'inside', isSelf: false };
  }

  if (dragData.source === 'pinned' && item && dragData.item.id === item.id) {
    return { position: 'inside', isSelf: true };
  }

  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const height = rect.height;

  if (!item) {
    return { position: 'inside', isSelf: false };
  }

  if (item.type === 'folder') {
    if (y < height * 0.25) return { position: 'top', isSelf: false };
    if (y > height * 0.75) return { position: 'bottom', isSelf: false };
    return { position: 'inside', isSelf: false };
  }

  if (y < height * 0.5) return { position: 'top', isSelf: false };
  return { position: 'bottom', isSelf: false };
}

function resolveDropTarget(params: {
  item: PinnedItem | null;
  dropPosition: DropPosition;
  index?: number;
}): { parentId: string | undefined; index: number | undefined } {
  const { item, dropPosition, index } = params;

  if (!item) {
    return { parentId: undefined, index: undefined };
  }

  if (dropPosition === 'inside') {
    return { parentId: item.id, index: undefined };
  }

  const baseIndex = index ?? 0;
  const targetIndex = dropPosition === 'top' ? baseIndex : baseIndex + 1;
  return { parentId: item.parentId, index: targetIndex };
}

export function usePinnedItemDrop({ item, spaceName, index }: UsePinnedItemDropProps) {
  const [isOver, setIsOver] = useState(false);
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);

  const { mutate: moveItem } = useMovePinnedItem();
  const { mutate: createPinnedTab } = useCreatePinnedTab();

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const dragData = getDragData(e);
      if (!dragData) return;

      const { position, isSelf } = resolveDropPosition(item, e);
      if (isSelf) {
        e.dataTransfer.dropEffect = 'none';
        setDropPosition(null);
        setIsOver(false);
        return;
      }

      setDropPosition(position);
      setIsOver(true);
      e.dataTransfer.dropEffect = 'move';
    },
    [item]
  );

  const handleDragLeave = useCallback(() => {
    setIsOver(false);
    setDropPosition(null);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsOver(false);

      const currentDropPosition = dropPosition; // Capture current state
      setDropPosition(null);

      const dragData = getDragData(e);
      if (!dragData) return;

      const { parentId: targetParentId, index: targetIndex } = resolveDropTarget({
        item,
        dropPosition: currentDropPosition ?? 'inside',
        index,
      });

      if (dragData.source === 'pinned' && typeof dragData.item.id === 'string') {
        moveItem({
          id: dragData.item.id,
          parentId: targetParentId,
          index: targetIndex,
          spaceName,
        });
        return;
      }

      if (dragData.source === 'temporary') {
        createPinnedTab({
          spaceName,
          title: dragData.item.title,
          url: 'url' in dragData.item ? dragData.item.url : '',
          favIconUrl: 'favIconUrl' in dragData.item ? dragData.item.favIconUrl : undefined,
          parentId: targetParentId,
          index: targetIndex,
        });
      }
    },
    [dropPosition, item, spaceName, index, moveItem, createPinnedTab]
  );

  return {
    isOver,
    dropPosition,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
