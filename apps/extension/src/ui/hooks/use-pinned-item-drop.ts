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

      // Prevent dropping into itself or children (if folder)
      if (dragData.source === 'pinned' && item) {
        // If dragging same item
        if (dragData.item.id === item.id) {
          e.dataTransfer.dropEffect = 'none';
          setDropPosition(null);
          setIsOver(false);
          return;
        }
        // Check if dragging parent into child (simple check: if item is inside dragged folder)
        // Since we don't have full tree here, we skip complex check for now.
        // Backend/Chrome API handles cyclic move error usually.
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;

      let position: DropPosition = 'inside';

      if (item) {
        if (item.type === 'folder') {
          // Folder: Top 25% -> Before, Bottom 25% -> After, Middle -> Inside
          if (y < height * 0.25) position = 'top';
          else if (y > height * 0.75) position = 'bottom';
          else position = 'inside';
        } else {
          // Tab: Top 50% -> Before, Bottom 50% -> After
          if (y < height * 0.5) position = 'top';
          else position = 'bottom';
        }
      } else {
        // Empty container
        position = 'inside';
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

      let targetParentId: string | undefined;
      let targetIndex: number | undefined;

      if (item) {
        if (currentDropPosition === 'inside') {
          targetParentId = item.id;
          targetIndex = undefined; // Append to folder
        } else {
          targetParentId = item.parentId; // If root item, parentId is undefined
          const baseIndex = index ?? 0;
          targetIndex = currentDropPosition === 'top' ? baseIndex : baseIndex + 1;
        }
      } else {
        // Dropping into container (Space Root or Folder Content)
        // If 'item' is null, we assume we are at the "List" level.
        // But the hook is usually used on a Row.
        // If used on PinnedItemList (empty state), item is null.
        // We need to know parentId of the list?
        // Wait, if PinnedItemList is empty, we don't have item know parentId easily unless passed props.
        // But for 'inside' drop on Root List (empty), parentId is undefined (Space Root).
        targetParentId = undefined;
        targetIndex = undefined; // Append
      }

      if (dragData.source === 'pinned') {
        const itemId = dragData.item.id;
        if (typeof itemId === 'string') {
          moveItem({
            id: itemId,
            parentId: targetParentId,
            index: targetIndex,
            spaceName, // Resolves root if parentId is undefined
          });
        }
      } else if (dragData.source === 'temporary') {
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
