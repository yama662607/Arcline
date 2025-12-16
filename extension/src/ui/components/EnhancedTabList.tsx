import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import {
  useActivateTab,
  useArchiveTab,
  useCloseTab,
  useToggleTabPinned,
} from '@/hooks/use-spaces-query';
import type { TabEntry } from '@/shared/types';
import { TabContextMenu } from '@/ui/components/context-menu/TabContextMenu';
import { GlobalPinnedTabs } from '@/ui/components/GlobalPinnedTabs';
import { TabRow } from '@/ui/components/TabRow';
import { SortableTabRow } from './SortableTabRow';

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
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // const [draggedTab, setDraggedTab] = useState<TabEntry | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // const { data: spaces = [] } = useSpacesSnapshot();
  const togglePinMutation = useToggleTabPinned();
  // const moveTabMutation = useMoveTabToSpace();
  const closeTabMutation = useCloseTab();
  const activateTabMutation = useActivateTab();
  const archiveTabMutation = useArchiveTab();
  // const { mutate: removeFromFavorites } = useRemoveFromFavorites();

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

  if (isFloatingVariant) {
    const dropZoneAriaLabel =
      floatingContext === 'pinned' ? 'Pinned tabs drop zone' : 'Temporary tabs drop zone';

    return (
      <div
        className={`space-y-2 rounded-lg transition-colors`}
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
            <SortableContext items={tabs.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {tabs.map((tab) => (
                <SortableTabRow key={tab.id} id={tab.id}>
                  <TabContextMenu tab={tab}>
                    <TabRow
                      tab={tab}
                      compact={compact}
                      variant="floating"
                      showFavicons={showFavicons}
                      onTabSelect={handleTabClick}
                      onContextMenuCustom={onTabContextMenu}
                      onPinToggle={handlePinToggle}
                      onArchive={handleTabArchive}
                      onClose={handleTabClose}
                      isDragged={false}
                    />
                  </TabContextMenu>
                </SortableTabRow>
              ))}
            </SortableContext>
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
                  <SortableContext
                    items={regularTabs.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                      const currentTab = regularTabs[virtualItem.index];
                      if (!currentTab) {
                        return null;
                      }

                      return (
                        <SortableTabRow
                          key={currentTab.id}
                          id={currentTab.id}
                          className="absolute top-0 left-0 w-full"
                          style={{
                            height: `${virtualItem.size}px`,
                            transform: `translateY(${virtualItem.start}px)`,
                          }}
                        >
                          <TabContextMenu tab={currentTab}>
                            <TabRow
                              tab={currentTab}
                              compact={compact}
                              variant="standalone"
                              showFavicons={showFavicons}
                              onTabSelect={handleTabClick}
                              onContextMenuCustom={onTabContextMenu}
                              onPinToggle={handlePinToggle}
                              onArchive={handleTabArchive}
                              onClose={handleTabClose}
                              isDragged={false}
                            />
                          </TabContextMenu>
                        </SortableTabRow>
                      );
                    })}
                  </SortableContext>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Space drop zones for drag and drop - Removed pending dnd-kit integration */}
    </div>
  );
}
