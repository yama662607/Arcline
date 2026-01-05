import { Virtuoso } from 'react-virtuoso';
import { memo } from 'react';
import type { PinnedItem } from '@/shared/types';
import { usePinnedItemDrop } from '@/ui/hooks/use-pinned-item-drop';

// Lazy imports to avoid circular dependencies
import { PinnedFolderRow, PinnedTabRow } from './PinnedItemRows';

interface VirtualPinnedListProps {
  items: PinnedItem[];
  spaceName: string;
  containerHeight?: number;
}

/**
 * Virtualized list for pinned items.
 * Uses React Virtuoso for efficient rendering of large lists.
 * Falls back to regular rendering for small lists (< 50 items).
 */
export function VirtualPinnedList({
  items,
  spaceName,
  containerHeight = 400,
}: VirtualPinnedListProps) {
  const { isOver, handleDragOver, handleDragLeave, handleDrop } = usePinnedItemDrop({
    item: null,
    spaceName,
  });

  // For small lists, use regular rendering (virtualization overhead not worth it)
  if (!items || items.length === 0) {
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

  // For small lists (< 50 items), don't use virtualization
  if (items.length < 50) {
    return (
      <div className="space-y-0.5">
        {items.map((item, index) => (
          <VirtualPinnedItemRow key={item.id} item={item} spaceName={spaceName} index={index} />
        ))}
      </div>
    );
  }

  // For large lists, use virtualization
  return (
    <Virtuoso
      style={{ height: containerHeight }}
      data={items}
      itemContent={(index, item) => (
        <VirtualPinnedItemRow item={item} spaceName={spaceName} index={index} />
      )}
      overscan={10}
    />
  );
}

interface VirtualPinnedItemRowProps {
  item: PinnedItem;
  spaceName: string;
  index: number;
}

/**
 * Memoized row component for virtualized list.
 */
const VirtualPinnedItemRow = memo(function VirtualPinnedItemRow({
  item,
  spaceName,
  index,
}: VirtualPinnedItemRowProps) {
  if (item.type === 'folder') {
    return <PinnedFolderRow folder={item} spaceName={spaceName} level={0} index={index} />;
  }
  return <PinnedTabRow tab={item} spaceName={spaceName} level={0} index={index} />;
});
