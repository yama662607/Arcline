import { useVirtualizer } from '@tanstack/react-virtual';
import type {
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import { useCallback, useRef, useState } from 'react';

import {
  useActivateTab,
  useArchiveTab,
  useCloseTab,
  useMoveTabToSpace,
  useSpacesSnapshot,
  useToggleTabPinned,
} from '@/hooks/use-spaces-query';
import type { TabEntry } from '@/shared/types';
import { GlobalPinnedTabs } from '@/ui/components/GlobalPinnedTabs';

interface TabRowProps {
  tab: TabEntry;
  compact: boolean;
  variant: 'standalone' | 'floating';
  isDragged: boolean;
  showFavicons: boolean;
  onSelect: (tab: TabEntry) => void;
  onContextMenu?: (tab: TabEntry, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onPinToggle: (event: ReactMouseEvent<HTMLButtonElement>, tab: TabEntry) => void;
  onArchive: (event: ReactMouseEvent<HTMLButtonElement>, tab: TabEntry) => void;
  onClose: (event: ReactMouseEvent<HTMLButtonElement>, tab: TabEntry) => void;
  onDragStart?: (event: ReactDragEvent<HTMLElement>, tab: TabEntry) => void;
  onDragOver?: (event: ReactDragEvent<HTMLElement>) => void;
  onDrop?: (event: ReactDragEvent<HTMLElement>, tab: TabEntry) => void;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function useTabRowHandlers(
  tab: TabEntry,
  onSelect: (tab: TabEntry) => void,
  onContextMenu?: (tab: TabEntry, event: ReactMouseEvent<HTMLButtonElement>) => void,
  onDragStart?: (event: ReactDragEvent<HTMLButtonElement>, tab: TabEntry) => void,
  onDragOver?: (event: ReactDragEvent<HTMLButtonElement>) => void,
  onDrop?: (event: ReactDragEvent<HTMLButtonElement>, targetTab: TabEntry) => void
) {
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        onSelect(tab);
      }
    },
    [onSelect, tab]
  );

  const handleContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onContextMenu?.(tab, event);
    },
    [onContextMenu, tab]
  );

  const handleDragStart = useCallback(
    (event: ReactDragEvent<HTMLButtonElement>) => {
      onDragStart?.(event, tab);
    },
    [onDragStart, tab]
  );

  const handleDragOver = useCallback(
    (event: ReactDragEvent<HTMLButtonElement>) => {
      onDragOver?.(event);
    },
    [onDragOver]
  );

  const handleDrop = useCallback(
    (event: ReactDragEvent<HTMLButtonElement>) => {
      onDrop?.(event, tab);
    },
    [onDrop, tab]
  );

  return {
    handleKeyDown,
    handleContextMenu,
    handleDragStart,
    handleDragOver,
    handleDrop,
  };
}

function TabRow({
  tab,
  compact,
  variant,
  isDragged,
  showFavicons,
  onSelect,
  onContextMenu,
  onPinToggle,
  onArchive,
  onClose,
  onDragStart,
  onDragOver,
  onDrop,
}: TabRowProps) {
  const { handleKeyDown, handleContextMenu, handleDragStart, handleDragOver, handleDrop } =
    useTabRowHandlers(tab, onSelect, onContextMenu, onDragStart, onDragOver, onDrop);

  const containerClasses = [
    variant === 'floating'
      ? `group flex items-center gap-2 px-3 ${compact ? 'py-1.5' : 'py-2'} rounded hover:bg-surface-light transition-colors overflow-x-hidden`
      : `group flex items-center gap-3 px-4 ${compact ? 'py-1.5' : 'py-2'} hover:bg-surface-light transition-colors border-b border-surface-light/50 overflow-x-hidden`,
    tab.active ? 'bg-surface-light' : '',
    isDragged ? 'opacity-50' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const actionButtonTextClass = variant === 'floating' ? 'text-xs' : 'text-sm';

  return (
    <div className={containerClasses}>
      <button
        type="button"
        className="flex flex-1 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        onClick={() => onSelect(tab)}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        draggable={Boolean(onDragStart)}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex-shrink-0">
          {showFavicons && tab.favIconUrl ? (
            <img
              src={tab.favIconUrl}
              alt=""
              className="w-4 h-4 rounded"
              onError={(event) => {
                const target = event.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-4 h-4 bg-surface-light rounded flex items-center justify-center">
              <span className="text-xs text-slate-400">🌐</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="text-sm text-slate-200 truncate" title={tab.title}>
            {tab.title}
          </div>
          <div
            className="text-xs text-slate-500 truncate"
            title={tab.url ? safeHostname(tab.url) : ''}
          >
            {tab.url ? safeHostname(tab.url) : ''}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={(event) => onPinToggle(event, tab)}
          className={`p-1 rounded ${actionButtonTextClass} ${
            tab.pinned
              ? 'text-yellow-400 hover:text-yellow-300'
              : 'text-slate-500 hover:text-slate-300'
          }`}
          title={tab.pinned ? 'Unpin' : 'Pin'}
        >
          📌
        </button>

        <button
          type="button"
          onClick={(event) => onArchive(event, tab)}
          className={`p-1 rounded ${actionButtonTextClass} text-slate-500 hover:text-blue-400`}
          title="Archive"
        >
          📦
        </button>

        <button
          type="button"
          onClick={(event) => onClose(event, tab)}
          className={`p-1 rounded ${actionButtonTextClass} text-slate-500 hover:text-red-400`}
          title="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

interface EnhancedTabListProps {
  tabs: TabEntry[];
  title: string;
  emptyMessage: string;
  variant?: 'standalone' | 'floating';
  onTabContextMenu?: (tab: TabEntry, event: React.MouseEvent<HTMLButtonElement>) => void;
  showFavicons?: boolean;
  compact?: boolean;
}

export function EnhancedTabList({
  tabs,
  title,
  emptyMessage,
  variant = 'standalone',
  onTabContextMenu,
  showFavicons = true,
  compact = false,
}: EnhancedTabListProps) {
  const [draggedTab, setDraggedTab] = useState<TabEntry | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const { data: spaces = [] } = useSpacesSnapshot();
  const togglePinMutation = useToggleTabPinned();
  const moveTabMutation = useMoveTabToSpace();
  const closeTabMutation = useCloseTab();
  const activateTabMutation = useActivateTab();
  const archiveTabMutation = useArchiveTab();

  // Separate pinned tabs from regular tabs
  const pinnedTabs = tabs.filter((tab) => tab.pinned);
  const regularTabs = tabs.filter((tab) => !tab.pinned);

  const virtualizer = useVirtualizer({
    count: regularTabs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (compact ? 32 : 40),
    overscan: 5,
  });

  const handleTabClick = (tab: TabEntry) => {
    activateTabMutation.mutate(tab.id);
  };

  const handlePinToggle = (e: React.MouseEvent, tab: TabEntry) => {
    e.stopPropagation();
    togglePinMutation.mutate({ tabId: tab.id, pinned: !tab.pinned });
  };

  const handleTabClose = (e: React.MouseEvent, tab: TabEntry) => {
    e.stopPropagation();
    closeTabMutation.mutate(tab.id);
  };

  const handleTabArchive = (e: React.MouseEvent, tab: TabEntry) => {
    e.stopPropagation();
    archiveTabMutation.mutate(tab.id);
  };

  const handleDragStart = (e: React.DragEvent, tab: TabEntry) => {
    setDraggedTab(tab);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tab.id.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetTab: TabEntry) => {
    e.preventDefault();
    if (!draggedTab || draggedTab.id === targetTab.id) return;

    // Move tab to position of target tab
    // This would require additional API support for reordering within a space
    setDraggedTab(null);
  };

  const handleDropOnSpace = (e: React.DragEvent, spaceId: number) => {
    e.preventDefault();
    if (!draggedTab) return;

    moveTabMutation.mutate({ tabId: draggedTab.id, spaceId });
    setDraggedTab(null);
  };

  if (variant === 'floating') {
    return (
      <div className="space-y-2">
        <div className="px-3 py-2">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {title} ({tabs.length})
          </h3>
        </div>

        {tabs.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-slate-500">{emptyMessage}</div>
        ) : (
          <div className="space-y-1 overflow-x-hidden">
            {tabs.map((tab) => (
              <TabRow
                key={tab.id}
                tab={tab}
                compact={compact}
                variant="floating"
                isDragged={draggedTab?.id === tab.id}
                showFavicons={showFavicons}
                onSelect={handleTabClick}
                onContextMenu={onTabContextMenu}
                onPinToggle={handlePinToggle}
                onArchive={handleTabArchive}
                onClose={handleTabClose}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">
          {title} ({tabs.length})
        </h3>

        {tabs.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                for (const tab of tabs) {
                  archiveTabMutation.mutate(tab.id);
                }
              }}
              className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
              title="Archive all tabs"
            >
              Archive All
            </button>
          </div>
        )}
      </div>

      {tabs.length === 0 ? (
        <div className="text-center py-8 text-slate-500">{emptyMessage}</div>
      ) : (
        <div className="space-y-4">
          {/* Global Pinned Tabs Section */}
          <GlobalPinnedTabs
            tabs={pinnedTabs}
            compact={compact}
            showFavicons={showFavicons}
            variant={variant}
            onTabContextMenu={onTabContextMenu}
          />

          {/* Regular Tabs Section */}
          {regularTabs.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-400 border-b border-surface-light">
                <span>通常のタブ</span>
                <span className="text-xs text-slate-500 bg-surface-light/50 px-2 py-0.5 rounded-full">
                  {regularTabs.length}
                </span>
              </div>
              <div
                ref={parentRef}
                className="border border-surface-light rounded-lg overflow-hidden overflow-x-hidden"
                style={{ height: Math.min(regularTabs.length * (compact ? 32 : 40), 400) }}
              >
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualItem) => {
                    const currentTab = regularTabs[virtualItem.index];
                    if (!currentTab) {
                      return null;
                    }

                    return (
                      <div
                        key={currentTab.id}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualItem.size}px`,
                          transform: `translateY(${virtualItem.start}px)`,
                        }}
                      >
                        <TabRow
                          tab={currentTab}
                          compact={compact}
                          variant="standalone"
                          isDragged={draggedTab?.id === currentTab.id}
                          showFavicons={showFavicons}
                          onSelect={handleTabClick}
                          onContextMenu={onTabContextMenu}
                          onPinToggle={handlePinToggle}
                          onArchive={handleTabArchive}
                          onClose={handleTabClose}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDrop={handleDrop}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Space drop zones for drag and drop */}
      {draggedTab && spaces.length > 1 && (
        <div className="border border-surface-light rounded-lg p-4">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Move to space:</h4>
          <div className="grid grid-cols-2 gap-2">
            {spaces.map((space) => (
              <button
                key={space.id}
                type="button"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnSpace(e, space.id)}
                className="p-2 border border-surface-light/50 rounded hover:bg-surface-light text-left transition-colors"
                onKeyDown={(event) => {
                  if (!draggedTab) {
                    return;
                  }

                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    moveTabMutation.mutate({ tabId: draggedTab.id, spaceId: space.id });
                    setDraggedTab(null);
                  }
                }}
                onClick={() => {
                  if (!draggedTab) {
                    return;
                  }

                  moveTabMutation.mutate({ tabId: draggedTab.id, spaceId: space.id });
                  setDraggedTab(null);
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: space.color }} />
                  <span className="text-sm text-slate-200">{space.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
