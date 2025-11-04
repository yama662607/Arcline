import { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useToggleTabPinned, useMoveTabToSpace, useCloseTab, useActivateTab, useArchiveTab } from '@/hooks/use-spaces-query';
import { useSpacesSnapshot } from '@/hooks/use-spaces-query';
import type { TabEntry } from '@/shared/types';

interface EnhancedTabListProps {
  tabs: TabEntry[];
  title: string;
  emptyMessage: string;
  variant?: 'standalone' | 'floating';
  onTabContextMenu?: (tab: TabEntry, event: React.MouseEvent) => void;
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

  // Virtual scrolling for performance
  const virtualizer = useVirtualizer({
    count: tabs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => compact ? 32 : 40,
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

  const getTabFavicon = (tab: TabEntry) => {
    if (!showFavicons || !tab.favIconUrl) {
      return (
        <div className="w-4 h-4 bg-surface-light rounded flex items-center justify-center">
          <span className="text-xs text-slate-400">🌐</span>
        </div>
      );
    }

    return (
      <img
        src={tab.favIconUrl}
        alt=""
        className="w-4 h-4 rounded"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
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
          <div className="px-3 py-4 text-center text-xs text-slate-500">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-1">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                draggable
                onDragStart={(e) => handleDragStart(e, tab)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, tab)}
                onClick={() => handleTabClick(tab)}
                onContextMenu={(e) => onTabContextMenu?.(tab, e)}
                className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-surface-light cursor-pointer transition-colors group ${
                  tab.active ? 'bg-surface-light' : ''
                } ${draggedTab?.id === tab.id ? 'opacity-50' : ''}`}
              >
                <div className="relative">
                  {getTabFavicon(tab)}
                  <div className="hidden w-4 h-4 bg-surface-light rounded flex items-center justify-center">
                    <span className="text-xs text-slate-400">🌐</span>
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 truncate">
                    {tab.title}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {new URL(tab.url || '').hostname}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handlePinToggle(e, tab)}
                    className={`p-1 rounded text-xs ${
                      tab.pinned 
                        ? 'text-yellow-400 hover:text-yellow-300' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title={tab.pinned ? 'Unpin' : 'Pin'}
                  >
                    📌
                  </button>
                  
                  <button
                    onClick={(e) => handleTabClose(e, tab)}
                    className="p-1 rounded text-xs text-slate-500 hover:text-red-400"
                    title="Close"
                  >
                    ×
                  </button>
                </div>
              </div>
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
              onClick={() => tabs.forEach(tab => archiveTabMutation.mutate(tab.id))}
              className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
              title="Archive all tabs"
            >
              Archive All
            </button>
          </div>
        )}
      </div>

      {tabs.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div 
          ref={parentRef}
          className="border border-surface-light rounded-lg overflow-hidden"
          style={{ height: Math.min(tabs.length * (compact ? 32 : 40), 400) }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const tab = tabs[virtualItem.index];
              
              return (
                <div
                  key={virtualItem.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, tab)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, tab)}
                    onClick={() => handleTabClick(tab)}
                    onContextMenu={(e) => onTabContextMenu?.(tab, e)}
                    className={`flex items-center gap-3 px-4 py-2 hover:bg-surface-light cursor-pointer transition-colors group border-b border-surface-light/50 ${
                      tab.active ? 'bg-surface-light' : ''
                    } ${draggedTab?.id === tab.id ? 'opacity-50' : ''}`}
                  >
                    <div className="relative flex-shrink-0">
                      {getTabFavicon(tab)}
                      <div className="hidden w-4 h-4 bg-surface-light rounded flex items-center justify-center">
                        <span className="text-xs text-slate-400">🌐</span>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 truncate">
                        {tab.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {tab.url ? new URL(tab.url).hostname : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handlePinToggle(e, tab)}
                        className={`p-1 rounded text-sm ${
                          tab.pinned 
                            ? 'text-yellow-400 hover:text-yellow-300' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title={tab.pinned ? 'Unpin' : 'Pin'}
                      >
                        📌
                      </button>
                      
                      <button
                        onClick={(e) => handleTabArchive(e, tab)}
                        className="p-1 rounded text-sm text-slate-500 hover:text-blue-400"
                        title="Archive"
                      >
                        📦
                      </button>
                      
                      <button
                        onClick={(e) => handleTabClose(e, tab)}
                        className="p-1 rounded text-sm text-slate-500 hover:text-red-400"
                        title="Close"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Space drop zones for drag and drop */}
      {draggedTab && spaces.length > 1 && (
        <div className="border border-surface-light rounded-lg p-4">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Move to space:</h4>
          <div className="grid grid-cols-2 gap-2">
            {spaces.map((space) => (
              <div
                key={space.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnSpace(e, space.id)}
                className="p-2 border border-surface-light/50 rounded hover:bg-surface-light cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: space.color }}
                  />
                  <span className="text-sm text-slate-200">{space.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
