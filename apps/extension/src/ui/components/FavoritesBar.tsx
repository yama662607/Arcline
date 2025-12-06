import { Star, X } from 'lucide-react';
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useState } from 'react';

import { useActivateTab, useToggleTabPinned } from '@/hooks/use-spaces-query';
import type { TabEntry } from '@/shared/types';

interface FavoritesBarProps {
  pinnedTabs: TabEntry[];
  onTabContextMenu?: (tab: TabEntry, event: ReactMouseEvent<HTMLDivElement>) => void;
}

function FaviconItem({
  tab,
  onSelect,
  onRemove,
  onContextMenu,
}: {
  tab: TabEntry;
  onSelect: (tab: TabEntry) => void;
  onRemove: (tab: TabEntry, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onContextMenu?: (tab: TabEntry, event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      setIsDragging(true);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', tab.id.toString());
      e.dataTransfer.setData('application/x-arcline-tab', JSON.stringify(tab));
    },
    [tab]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      onContextMenu?.(tab, event);
    },
    [onContextMenu, tab]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(tab);
      }
    },
    [onSelect, tab]
  );

  return (
    <div
      className={`group relative flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 transition-all hover:bg-amber-500/20 hover:shadow-sm ${
        isDragging ? 'opacity-50' : ''
      }`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onSelect(tab)}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      title={`${tab.title}\n${tab.url}`}
      role="button"
      tabIndex={0}
    >
      {/* Favicon */}
      {tab.favIconUrl ? (
        <img
          src={tab.favIconUrl}
          alt=""
          className="h-5 w-5 rounded-sm"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      ) : (
        <Star className="h-4 w-4 text-amber-600" />
      )}

      {/* Remove button (visible on hover) */}
      <button
        type="button"
        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(tab, e);
        }}
        title="お気に入りから削除"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function Placeholder({ onClose }: { onClose?: () => void }) {
  return (
    <div className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-500/30 bg-amber-500/5 p-4 text-center">
      {onClose && (
        <button
          type="button"
          className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
          onClick={onClose}
          title="閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <Star className="mb-2 h-6 w-6 text-amber-400" />
      <div className="text-sm font-medium text-amber-300">Drag to add Favorites</div>
      <div className="mt-1 text-xs text-amber-400/70">
        Favorites keep your most used sites close across all spaces
      </div>
    </div>
  );
}

export function FavoritesBar({ pinnedTabs, onTabContextMenu }: FavoritesBarProps) {
  const { mutate: activateTab } = useActivateTab();
  const { mutate: toggleTabPinned } = useToggleTabPinned();
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);

  // Debug: Log pinned tabs
  console.log('[FavoritesBar] Pinned tabs:', pinnedTabs.length, pinnedTabs);

  const handleSelectTab = useCallback(
    (tab: TabEntry) => {
      activateTab(tab.id);
    },
    [activateTab]
  );

  const handleRemoveTab = useCallback(
    (tab: TabEntry, event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      toggleTabPinned({ tabId: tab.id, pinned: false });
    },
    [toggleTabPinned]
  );

  const handleDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      try {
        const tabData = e.dataTransfer.getData('application/x-arcline-tab');
        if (tabData) {
          const tab = JSON.parse(tabData) as TabEntry;
          if (!tab.pinned) {
            toggleTabPinned({ tabId: tab.id, pinned: true });
          }
        }
      } catch (error) {
        console.error('[FavoritesBar] Failed to parse dropped tab data:', error);
      }
    },
    [toggleTabPinned]
  );

  const handleClosePlaceholder = useCallback(() => {
    setShowPlaceholder(false);
  }, []);

  const showPlaceholderUI = pinnedTabs.length === 0 && showPlaceholder;

  return (
    <div className="border-b border-white/10 bg-surface px-3 py-2">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-400">
        <Star className="h-3 w-3" />
        <span>Favorites</span>
        {pinnedTabs.length > 0 && (
          <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
            {pinnedTabs.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div
        className={`min-h-[3rem] rounded-lg transition-colors ${
          isDragOver ? 'bg-amber-500/20 ring-2 ring-amber-500/50' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="region"
        aria-label="Favorites drop zone"
      >
        {showPlaceholderUI ? (
          <Placeholder onClose={handleClosePlaceholder} />
        ) : pinnedTabs.length === 0 ? (
          <div className="flex h-12 items-center justify-center text-xs text-slate-500">
            お気に入りはありません
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pinnedTabs.map((tab) => (
              <FaviconItem
                key={tab.id}
                tab={tab}
                onSelect={handleSelectTab}
                onRemove={handleRemoveTab}
                onContextMenu={onTabContextMenu}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
