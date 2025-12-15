import { useQueryClient } from '@tanstack/react-query';
import { Star, X } from 'lucide-react';
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';

import {
  useAddToFavorites,
  useRemoveFromFavorites,
  useToggleTabPinned,
} from '@/hooks/use-spaces-query';
import { ServiceWorkerBridge } from '@/lib/service-worker-bridge';
import type { TabEntry } from '@/shared/types';
import { getDragData, setDragData } from '@/ui/hooks/use-tab-drag-drop';

/**
 * Calculate optimal icon size based on number of favorites
 * Max grid: 4 columns × 3 rows = 12 items
 * Inspired by Arcify's implementation
 */
function calculateIconSize(count: number): { size: number; cols: number; rows: number } {
  if (count === 0) return { size: 40, cols: 0, rows: 0 };
  if (count <= 4) return { size: 48, cols: count, rows: 1 }; // 1 row
  if (count <= 8) return { size: 44, cols: 4, rows: 2 }; // 2 rows
  return { size: 40, cols: 4, rows: 3 }; // 3 rows (max 12 items)
}

interface FavoritesBarProps {
  pinnedTabs: TabEntry[];
  onTabContextMenu?: (tab: TabEntry, event: ReactMouseEvent<HTMLDivElement>) => void;
}

function FaviconItem({
  tab,
  size,
  onSelect,
  onRemove,
  onContextMenu,
}: {
  tab: TabEntry;
  size: number;
  onSelect: (tab: TabEntry) => void;
  onRemove: (tab: TabEntry, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onContextMenu?: (tab: TabEntry, event: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      console.log('[FavoritesBar] DragStart from favorite:', tab.title);
      setIsDragging(true);
      setDragData(e, tab, 'favorite');
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

  const iconSize = Math.floor(size * 0.5); // Icon is 50% of container

  return (
    <div
      className={`group relative flex flex-shrink-0 cursor-pointer items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 transition-all hover:bg-amber-500/20 hover:shadow-sm ${
        isDragging ? 'opacity-50' : ''
      }`}
      style={{ width: `${size}px`, height: `${size}px` }}
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
          className="rounded-sm"
          style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      ) : (
        <Star
          style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
          className="text-amber-600"
        />
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
  const queryClient = useQueryClient();
  const bridge = useMemo(() => new ServiceWorkerBridge(queryClient), [queryClient]);
  const { mutate: addToFavorites } = useAddToFavorites();
  const { mutate: removeFromFavorites } = useRemoveFromFavorites();
  const { mutate: toggleTabPinned } = useToggleTabPinned();
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);

  // Calculate optimal icon size based on number of favorites
  const {
    size: iconSize,
    cols,
    rows,
  } = useMemo(() => calculateIconSize(pinnedTabs.length), [pinnedTabs.length]);

  const handleSelectTab = useCallback(
    async (tab: TabEntry) => {
      // For favorites, use Service Worker Bridge to open URL
      try {
        await bridge.openUrlInTab(tab.url);
      } catch (error) {
        console.error('[FavoritesBar] Failed to open favorite:', error);
      }
    },
    [bridge]
  );

  const handleRemoveTab = useCallback(
    (tab: TabEntry, event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      removeFromFavorites(tab.url);
    },
    [removeFromFavorites]
  );

  const handleDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
    console.log('[FavoritesBar] DragOver event triggered');
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      console.log('[FavoritesBar] Drop event triggered');
      console.log('[FavoritesBar] Available data types:', e.dataTransfer.types);

      const dragData = getDragData(e);
      if (!dragData) {
        console.warn('[FavoritesBar] No valid drag data found');
        return;
      }

      const { item, source } = dragData;
      console.log('[FavoritesBar] Drop from source:', source, 'tab:', item.title);

      // すでにFavoriteからのドラッグは無視（自分自身への移動）
      if (source === 'favorite') {
        console.log('[FavoritesBar] Ignoring drop from favorite (same source)');
        return;
      }

      // Favoriteに追加
      // Favorite requires title, url, favIconUrl. Safe to cast or pick.
      const tabLike = item as TabEntry;
      addToFavorites(tabLike);

      // 移動元から削除
      if (source === 'pinned') {
        // Pinnedからの移動: ピン留めを解除
        // If it's a PinnedItem with tabId, we can unpin it.
        if ('tabId' in item && typeof item.tabId === 'number') {
          console.log('[FavoritesBar] Unpinning tab:', item.tabId);
          toggleTabPinned({ tabId: item.tabId, pinned: false });
        }
      }
      // Temporaryからの移動は特に削除処理不要（Favoriteに追加されるだけ）
    },
    [addToFavorites, toggleTabPinned]
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
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${cols}, ${iconSize}px)`,
              gridTemplateRows: `repeat(${rows}, ${iconSize}px)`,
            }}
          >
            {pinnedTabs.map((tab) => (
              <FaviconItem
                key={tab.id}
                tab={tab}
                size={iconSize}
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
