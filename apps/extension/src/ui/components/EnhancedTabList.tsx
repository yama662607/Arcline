import { useVirtualizer } from '@tanstack/react-virtual';
import type { DragEvent as ReactDragEvent } from 'react';
import { useRef, useState } from 'react';

import {
  useActivateTab,
  useArchiveTab,
  useCloseTab,
  useMoveTabToSpace,
  useRemoveFromFavorites,
  useSpacesSnapshot,
  useToggleTabPinned,
} from '@/hooks/use-spaces-query';
import type { TabEntry } from '@/shared/types';
import { GlobalPinnedTabs } from '@/ui/components/GlobalPinnedTabs';
import { TabRow } from '@/ui/components/TabRow';
import type { DragData, TabSource } from '@/ui/hooks/use-tab-drag-drop';
import { getDragData, setDragData } from '@/ui/hooks/use-tab-drag-drop';

export type FloatingListContext = 'pinned' | 'temporary';

interface EnhancedTabListProps {
  tabs: TabEntry[];
  title: string;
  emptyMessage: string;
  variant?: 'standalone' | 'floating';
  onTabContextMenu?: (tab: TabEntry, event: React.MouseEvent<HTMLDivElement>) => void;
  showFavicons?: boolean;
  compact?: boolean;
  floatingContext?: FloatingListContext;
}

export function EnhancedTabList({
  tabs,
  title,
  emptyMessage,
  variant = 'standalone',
  onTabContextMenu,
  showFavicons = true,
  compact = false,
  floatingContext,
}: EnhancedTabListProps) {
  const [draggedTab, setDraggedTab] = useState<TabEntry | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);

  const { data: spaces = [] } = useSpacesSnapshot();
  const togglePinMutation = useToggleTabPinned();
  const moveTabMutation = useMoveTabToSpace();
  const closeTabMutation = useCloseTab();
  const activateTabMutation = useActivateTab();
  const archiveTabMutation = useArchiveTab();
  const { mutate: removeFromFavorites } = useRemoveFromFavorites();

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

  const isFloatingVariant = variant === 'floating';
  const floatingTarget: FloatingListContext = floatingContext ?? 'temporary';
  const dragSource: TabSource = isFloatingVariant ? floatingTarget : 'temporary';

  const applyTemporaryDropEffects = (source: TabSource, tab: TabEntry) => {
    if (source === 'temporary') {
      console.log('[EnhancedTabList] Ignoring drop from temporary (same source)');
      return;
    }

    if (source === 'pinned') {
      console.log('[EnhancedTabList] Unpinning tab:', tab.id);
      togglePinMutation.mutate({ tabId: tab.id, pinned: false });
      return;
    }

    console.log('[EnhancedTabList] Removing from favorites:', tab.url);
    removeFromFavorites(tab.url);
  };

  const applyPinnedDropEffects = (source: TabSource, tab: TabEntry) => {
    if (source === 'pinned') {
      console.log('[EnhancedTabList] Ignoring drop from pinned (same source)');
      return;
    }

    console.log('[EnhancedTabList] Pinning tab via floating drop zone:', tab.id);
    togglePinMutation.mutate({ tabId: tab.id, pinned: true });

    if (source === 'favorite') {
      console.log('[EnhancedTabList] Removing from favorites after pin:', tab.url);
      removeFromFavorites(tab.url);
    }
  };

  const handleFloatingDrop = (dragData: DragData) => {
    const { item, source } = dragData;
    console.log(
      '[EnhancedTabList] Drop from source:',
      source,
      'tab:',
      'title' in item ? item.title : 'unknown'
    );

    if (typeof item.id !== 'number') {
      console.log('[EnhancedTabList] Ignoring non-TabEntry item');
      // TODO: Handle PinnedItem drop (e.g. create new tab)
      return;
    }
    const tab = item as TabEntry;

    if (floatingTarget === 'temporary') {
      applyTemporaryDropEffects(source, tab);
      return;
    }

    applyPinnedDropEffects(source, tab);
  };

  const handleDragStart = (e: React.DragEvent, tab: TabEntry) => {
    console.log(`[EnhancedTabList] DragStart from ${dragSource}:`, tab.title);
    setDraggedTab(tab);
    setDragData(e as ReactDragEvent<HTMLDivElement>, tab, dragSource);
  };

  const handleDragEnd = () => {
    setDraggedTab(null);
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

  // ドロップゾーン用のハンドラー（Temporary領域へのドロップ）
  const handleZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleZoneDragLeave = () => {
    setIsDragOver(false);
  };

  const handleZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const dragData = getDragData(e as ReactDragEvent<HTMLDivElement>);
    if (!dragData) {
      console.warn('[EnhancedTabList] No valid drag data found');
      return;
    }

    if (!isFloatingVariant) {
      return;
    }

    handleFloatingDrop(dragData);
    setDraggedTab(null);
  };

  if (isFloatingVariant) {
    const dropZoneAriaLabel =
      floatingTarget === 'pinned' ? 'Pinned tabs drop zone' : 'Temporary tabs drop zone';

    return (
      <div
        className={`space-y-2 rounded-lg transition-colors ${
          isDragOver ? 'bg-slate-500/20 ring-2 ring-slate-500/50' : ''
        }`}
        onDragOver={handleZoneDragOver}
        onDragLeave={handleZoneDragLeave}
        onDrop={handleZoneDrop}
        role="region"
        aria-label={dropZoneAriaLabel}
      >
        <div className="px-3 py-2">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {title} ({tabs.length})
          </h3>
        </div>

        {tabs.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-slate-500 border-2 border-dashed border-slate-600 rounded-lg">
            {emptyMessage}
          </div>
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
                onDragEnd={handleDragEnd}
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
