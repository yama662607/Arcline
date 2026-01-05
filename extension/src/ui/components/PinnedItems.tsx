import type { PinnedItem } from '@/shared/types';
import { usePinnedItemDrop } from '@/ui/hooks/use-pinned-item-drop';
import { PinnedFolderRow, PinnedTabRow } from './PinnedItemRows';

interface PinnedItemsProps {
  items: PinnedItem[];
  spaceName: string;
  level?: number;
}

/**
 * List component for displaying pinned items (tabs and folders).
 * Re-exports PinnedFolderRow and PinnedTabRow for external use.
 */
export function PinnedItemList({ items, spaceName, level = 0 }: PinnedItemsProps) {
  // Empty state drop handling
  const { isOver, handleDragOver, handleDragLeave, handleDrop } = usePinnedItemDrop({
    item: null,
    spaceName,
  });

  if (!items || items.length === 0) {
    if (level === 0) {
      return (
        <div
          className={`px-3 py-4 text-center text-xs text-slate-500 border-2 border-dashed rounded-lg transition-colors ${
            isOver ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          aria-label="Pinned items drop zone"
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
            }
          }}
        >
          Drag tabs here to pin
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-0.5">
      {items.map((item, index) => (
        <PinnedItemRow
          key={item.id}
          item={item}
          spaceName={spaceName}
          level={level}
          index={index}
        />
      ))}
    </div>
  );
}

interface PinnedItemRowProps {
  item: PinnedItem;
  spaceName: string;
  level: number;
  index: number;
}

function PinnedItemRow({ item, spaceName, level, index }: PinnedItemRowProps) {
  if (item.type === 'folder') {
    return <PinnedFolderRow folder={item} spaceName={spaceName} level={level} index={index} />;
  }
  return <PinnedTabRow tab={item} spaceName={spaceName} level={level} index={index} />;
}

// Re-export row components for external use (e.g., VirtualPinnedList)
export { PinnedFolderRow, PinnedTabRow } from './PinnedItemRows';
