import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { useState } from 'react';

import { useActivateTab, useOpenUrlInTab } from '@/hooks/use-spaces-query';
import type { PinnedFolder, PinnedItem, PinnedTab } from '@/shared/types';
import { PinnedItemContextMenu } from '@/ui/components/PinnedItemContextMenu';
import { usePinnedItemDrop } from '@/ui/hooks/use-pinned-item-drop';
import { useTabDragDrop } from '@/ui/hooks/use-tab-drag-drop';

interface PinnedItemsProps {
  items: PinnedItem[];
  spaceName: string;
  level?: number;
}

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

interface PinnedFolderRowProps {
  folder: PinnedFolder;
  spaceName: string;
  level: number;
  index: number;
}

function PinnedFolderRow({ folder, spaceName, level, index }: PinnedFolderRowProps) {
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
          className={`group relative flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-surface-light cursor-pointer text-slate-300 transition-colors ${
            isDragging ? 'opacity-50' : ''
          } ${isOver && dropPosition === 'inside' ? 'bg-blue-500/20 ring-1 ring-blue-500' : ''}`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
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
          <div className="flex-shrink-0 text-slate-500 group-hover:text-slate-200">
            {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </div>
          <div className="flex-shrink-0 text-slate-400 group-hover:text-yellow-400 transition-colors">
            {isOpen ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
          </div>
          <span className="text-xs font-medium truncate select-none">{folder.title}</span>
        </div>
      </PinnedItemContextMenu>

      {isOpen && <PinnedItemList items={folder.children} spaceName={spaceName} level={level + 1} />}
    </div>
  );
}

interface PinnedTabRowProps {
  tab: PinnedTab;
  spaceName: string;
  level: number;
  index: number;
}

function PinnedTabRow({ tab, spaceName, level, index }: PinnedTabRowProps) {
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
          className={`group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-light cursor-pointer transition-colors ${
            isDragging ? 'opacity-50' : ''
          } ${tab.tabId ? 'text-white' : 'text-slate-300'} ${
            isOver && dropPosition === 'inside' ? 'bg-blue-500/20' : '' // 'inside' shouldn't happen for tabs but safe fallback
          }`}
          style={{ paddingLeft: `${level * 12 + 20}px` }}
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
          <span className="text-xs truncate flex-1">{tab.title || hostname}</span>

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
}

function getSafeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
