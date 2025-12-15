import { Pin, PinOff } from 'lucide-react';
import type {
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import { useCallback, useMemo, useState } from 'react';

import {
  useActivateTab,
  useRemoveFromFavorites,
  useToggleTabPinned,
} from '@/hooks/use-spaces-query';
import type { TabEntry } from '@/shared/types';
import { getDragData, setDragData } from '@/ui/hooks/use-tab-drag-drop';

interface GlobalPinnedTabsProps {
  tabs: TabEntry[];
  compact: boolean;
  showFavicons: boolean;
  variant: 'standalone' | 'floating';
  onTabContextMenu?: (tab: TabEntry, event: ReactMouseEvent<HTMLDivElement>) => void;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function PinnedTabRow({
  tab,
  compact,
  variant,
  showFavicons,
  onSelect,
  onContextMenu,
  onPinToggle,
}: {
  tab: TabEntry;
  compact: boolean;
  variant: 'standalone' | 'floating';
  showFavicons: boolean;
  onSelect: (tab: TabEntry) => void;
  onContextMenu?: (tab: TabEntry, event: ReactMouseEvent<HTMLDivElement>) => void;
  onPinToggle: (event: ReactMouseEvent<HTMLButtonElement>, tab: TabEntry) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const hostname = useMemo(() => safeHostname(tab.url), [tab.url]);

  const handleContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      onContextMenu?.(tab, event);
    },
    [onContextMenu, tab]
  );

  const handlePinToggle = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      onPinToggle(event, tab);
    },
    [onPinToggle, tab]
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(tab);
      }
    },
    [onSelect, tab]
  );

  const handleDragStart = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      console.log('[GlobalPinnedTabs] DragStart from pinned:', tab.title);
      setIsDragging(true);
      setDragData(e, tab, 'pinned');
    },
    [tab]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/50 p-2 transition-all hover:bg-blue-100/50 hover:shadow-sm w-full text-left overflow-x-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        variant === 'floating' ? 'mb-1' : 'mb-2'
      } ${isDragging ? 'opacity-50' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onSelect(tab)}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
    >
      {/* Pin icon indicator */}
      <div className="flex items-center justify-center">
        <Pin className="h-3 w-3 text-blue-600" />
      </div>

      {/* Favicon */}
      {showFavicons && tab.favIconUrl && (
        <img
          src={tab.favIconUrl}
          alt=""
          className="h-4 w-4 flex-shrink-0 rounded-sm"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      )}

      {/* Tab content */}
      <div className="min-w-0 flex-1 max-w-0">
        <span
          className="truncate text-sm font-medium text-gray-900"
          title={compact ? hostname : tab.title}
        >
          {compact ? hostname : tab.title}
        </span>
        {!compact && (
          <div className="truncate text-xs text-gray-500" title={hostname}>
            {hostname}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
          onClick={handlePinToggle}
          title="ピン留めを解除"
        >
          <PinOff className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function GlobalPinnedTabs({
  tabs,
  compact,
  showFavicons,
  variant,
  onTabContextMenu,
}: GlobalPinnedTabsProps) {
  const { mutate: activateTab } = useActivateTab();
  const { mutate: toggleTabPinned } = useToggleTabPinned();
  const { mutate: removeFromFavorites } = useRemoveFromFavorites();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleSelectTab = useCallback(
    (tab: TabEntry) => {
      activateTab(tab.id);
    },
    [activateTab]
  );

  const handlePinToggle = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, tab: TabEntry) => {
      event.stopPropagation();
      toggleTabPinned({ tabId: tab.id, pinned: !tab.pinned });
    },
    [toggleTabPinned]
  );

  const handleDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const dragData = getDragData(e);
      if (!dragData) {
        console.warn('[GlobalPinnedTabs] No valid drag data found');
        return;
      }

      const { item, source } = dragData;
      console.log(
        '[GlobalPinnedTabs] Drop from source:',
        source,
        'tab:',
        'title' in item ? item.title : 'unknown'
      );

      // Check if item is TabEntry (has numeric id)
      if (typeof item.id !== 'number') {
        console.log('[GlobalPinnedTabs] Ignoring non-TabEntry item');
        return;
      }
      const tab = item as TabEntry;

      // すでにPinnedからのドラッグは無視（自分自身への移動）
      if (source === 'pinned') {
        console.log('[GlobalPinnedTabs] Ignoring drop from pinned (same source)');
        return;
      }

      // Pinnedに追加（ピン留め）
      toggleTabPinned({ tabId: tab.id, pinned: true });

      // 移動元から削除
      if (source === 'favorite') {
        // Favoriteからの移動: お気に入りから削除
        console.log('[GlobalPinnedTabs] Removing from favorites:', tab.url);
        removeFromFavorites(tab.url);
      }
      // Temporaryからの移動は特に削除処理不要（ピン留めされるだけ）
    },
    [toggleTabPinned, removeFromFavorites]
  );

  return (
    <div
      className={`space-y-1 overflow-x-hidden rounded-lg transition-colors ${
        isDragOver ? 'bg-blue-500/20 ring-2 ring-blue-500/50' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="region"
      aria-label="Pinned tabs drop zone"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-blue-700 border-b border-blue-200">
        <Pin className="h-3 w-3" />
        <span>グローバルピン留めタブ</span>
        <span className="ml-auto text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
          {tabs.length}
        </span>
      </div>

      {/* Tabs */}
      {tabs.length === 0 ? (
        <div className="text-center py-4 text-sm text-gray-500 border-2 border-dashed border-blue-200 rounded-lg">
          ドラッグしてピン留め
        </div>
      ) : (
        <div className="space-y-1">
          {tabs.map((tab) => (
            <PinnedTabRow
              key={tab.id}
              tab={tab}
              compact={compact}
              variant={variant}
              showFavicons={showFavicons}
              onSelect={handleSelectTab}
              onContextMenu={onTabContextMenu}
              onPinToggle={handlePinToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
