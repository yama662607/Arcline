import { Folder, FolderOpen } from 'lucide-react';
import { memo, useState } from 'react';

import { useActivateTab, useOpenUrlInTab } from '@/hooks/use-spaces-query';
import type { PinnedFolder, PinnedItem, PinnedTab } from '@/shared/types';
import { PinnedItemContextMenu } from '@/ui/components/PinnedItemContextMenu';
import { usePinnedItemDrop } from '@/ui/hooks/use-pinned-item-drop';
import { useTabDragDrop } from '@/ui/hooks/use-tab-drag-drop';

export interface PinnedFolderRowProps {
  folder: PinnedFolder;
  spaceName: string;
  level: number;
  index: number;
}

export const PinnedFolderRow = memo(function PinnedFolderRow({
  folder,
  spaceName,
  level,
  index,
}: PinnedFolderRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { isDragging, handleDragStart, handleDragEnd } = useTabDragDrop('pinned');

  const { isOver, dropPosition, handleDragOver, handleDragLeave, handleDrop } = usePinnedItemDrop({
    item: folder,
    spaceName,
    index,
  });

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      {/* Visual Drop Indicators */}
      {isOver && dropPosition === 'top' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-10 pointer-events-none" />
      )}
      {isOver && dropPosition === 'bottom' && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-10 pointer-events-none" />
      )}

      <PinnedItemContextMenu item={folder}>
        <div
          className={`group relative flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 cursor-pointer text-slate-200 transition-colors ${
            isDragging ? 'opacity-50' : ''
          } ${isOver && dropPosition === 'inside' ? 'bg-blue-500/20 ring-1 ring-blue-500' : ''}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={toggleOpen}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setIsOpen((prev) => !prev);
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          draggable
          onDragStart={(e) => handleDragStart(e, folder)}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex-shrink-0 text-white/70 group-hover:text-white transition-colors">
            {isOpen ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
          </div>
          <span className="text-[13px] font-medium truncate select-none text-white/90">
            {folder.title}
          </span>
        </div>
      </PinnedItemContextMenu>

      {isOpen && (
        <NestedPinnedItemList items={folder.children} spaceName={spaceName} level={level + 1} />
      )}
    </div>
  );
});

export interface PinnedTabRowProps {
  tab: PinnedTab;
  spaceName: string;
  level: number;
  index: number;
}

export const PinnedTabRow = memo(function PinnedTabRow({
  tab,
  spaceName,
  level,
  index,
}: PinnedTabRowProps) {
  const { mutate: activateTab } = useActivateTab();
  const { mutate: openUrl } = useOpenUrlInTab();
  const { isDragging, handleDragStart, handleDragEnd } = useTabDragDrop('pinned');

  const { isOver, dropPosition, handleDragOver, handleDragLeave, handleDrop } = usePinnedItemDrop({
    item: tab,
    spaceName,
    index,
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tab.tabId) {
      activateTab(tab.tabId);
    } else {
      openUrl(tab.url);
    }
  };

  const hostname = getSafeHostname(tab.url);

  return (
    <div className="relative">
      {/* Drop Indicators */}
      {isOver && dropPosition === 'top' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-10 pointer-events-none" />
      )}
      {isOver && dropPosition === 'bottom' && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-10 pointer-events-none" />
      )}

      <PinnedItemContextMenu item={tab}>
        <div
          className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors ${
            isDragging ? 'opacity-50' : ''
          } ${tab.tabId ? 'text-white font-medium' : 'text-slate-300'} ${
            isOver && dropPosition === 'inside' ? 'bg-blue-500/20' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={handleClick}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (tab.tabId) {
                activateTab(tab.tabId);
              } else {
                openUrl(tab.url);
              }
            }
          }}
          role="button"
          tabIndex={0}
          draggable
          onDragStart={(e) => handleDragStart(e, tab)}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          title={tab.title}
          data-pinned-item-id={tab.id}
          data-pinned-item-title={tab.title}
          data-pinned-item-url={tab.url}
        >
          <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            {tab.favIconUrl ? (
              <img
                src={tab.favIconUrl}
                alt=""
                className="w-3.5 h-3.5 rounded-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-3.5 h-3.5 bg-slate-700 rounded-sm" />
            )}
          </div>
          <span className="text-[13px] truncate flex-1">{tab.title || hostname}</span>

          {/* Active Indicator if linked */}
          {tab.tabId && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"
              title="Tab is open"
            />
          )}
        </div>
      </PinnedItemContextMenu>
    </div>
  );
});

function getSafeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// Internal component for nested lists (non-virtualized for simplicity)
interface NestedPinnedItemListProps {
  items: PinnedItem[];
  spaceName: string;
  level: number;
}

function NestedPinnedItemList({ items, spaceName, level }: NestedPinnedItemListProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0.5">
      {items.map((item, index) => {
        if (item.type === 'folder') {
          return (
            <PinnedFolderRow
              key={item.id}
              folder={item}
              spaceName={spaceName}
              level={level}
              index={index}
            />
          );
        }
        return (
          <PinnedTabRow
            key={item.id}
            tab={item}
            spaceName={spaceName}
            level={level}
            index={index}
          />
        );
      })}
    </div>
  );
}
