import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useCallback, useMemo, useState } from 'react';

import {
  useAddToFavorites,
  useFavorites,
  useReorderTab,
  useToggleTabPinned,
} from '@/hooks/use-spaces-query';
import { getSpaceTheme } from '@/lib/space-theme';
import type { TabEntry } from '@/shared/types';
import { useSpacesStore } from '@/store';
import { ArchiveManager } from '@/ui/components/ArchiveManager';
import { EnhancedTabList } from '@/ui/components/EnhancedTabList';
import { FavoritesBar } from '@/ui/components/FavoritesBar';
import { NewTabButton } from '@/ui/components/NewTabButton';
import { SearchBar } from '@/ui/components/SearchBar';
import { SettingsPanel } from '@/ui/components/SettingsPanel';
import { SpaceManager } from '@/ui/components/SpaceManager';
import { SpaceSwitcher } from '@/ui/components/SpaceSwitcher';
import { TabRow } from '@/ui/components/TabRow';

interface SpacesWorkspaceProps {
  variant: 'sidepanel' | 'floating';
}

export function SpacesWorkspace({ variant }: SpacesWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'spaces' | 'archive' | 'settings'>('spaces');
  const [activeDragId, setActiveDragId] = useState<number | string | null>(null);

  const { mutate: reorderTab } = useReorderTab();
  const { mutate: toggleTabPinned } = useToggleTabPinned();
  const { mutate: addToFavorites } = useAddToFavorites();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
  );

  const visibleTemporaryTabs = useMemo(() => {
    if (!activeSpace) return [];
    const dedupe = new Map<number, TabEntry>();
    for (const tab of [...activeSpace.tabs, ...activeSpace.temporaryTabs]) {
      if (!tab.pinned) {
        dedupe.set(tab.id, tab);
      }
    }
    return Array.from(dedupe.values());
  }, [activeSpace]);

  const { data: favorites } = useFavorites();
  const favoriteTabs: TabEntry[] = useMemo(() => {
    if (!favorites) return [];
    return favorites.map((fav, index) => ({
      id: index,
      url: fav.url,
      title: fav.title,
      favIconUrl: fav.favIconUrl,
      pinned: false,
      active: false,
      windowId: 0,
      groupId: -1,
    }));
  }, [favorites]);

  const componentVariant = variant === 'floating' ? 'floating' : 'standalone';

  // Get theme colors for current space
  const spaceTheme = useMemo(
    () => getSpaceTheme(activeSpace?.themeColor),
    [activeSpace?.themeColor]
  );

  const handleOpenCommandPalette = useCallback(() => {
    // Command palette is handled by keyboard shortcut (Cmd+K)
    // This callback is passed to SearchBar for future integration
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    console.log('[SpacesWorkspace] DragStart active:', event.active.id);
    setActiveDragId(event.active.id);
  };

  const findTab = (id: number | string) => {
    const numId = Number(id);
    if (!activeSpace) return null;
    if (activeSpace.pinnedTabs.find((t) => t.id === numId))
      return { tab: activeSpace.pinnedTabs.find((t) => t.id === numId), type: 'pinned' as const };
    if (visibleTemporaryTabs.find((t) => t.id === numId))
      return {
        tab: visibleTemporaryTabs.find((t) => t.id === numId),
        type: 'temporary' as const,
      };
    return null;
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: drag-and-drop logic requires multiple conditions
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || !activeSpace) return;

    // Handle Drop to Favorites
    if (over.id === 'favorites-zone') {
      const source = findTab(active.id);
      if (source && source.tab) {
        addToFavorites(source.tab);
      }
      return;
    }

    if (active.id === over.id) return;

    const source = findTab(active.id);
    const target = findTab(over.id);

    if (!source || !target) return;

    if (source.type === target.type) {
      // Reorder within same list
      const list = source.type === 'pinned' ? activeSpace.pinnedTabs : visibleTemporaryTabs;
      const newIndex = list.findIndex((t) => t.id === target.tab?.id);
      if (newIndex !== -1) {
        reorderTab({
          tabId: Number(active.id),
          spaceId: activeSpace.id,
          newIndex,
          listType: source.type,
        });
      }
    } else {
      // Move between Pinned and Temporary
      const shouldPin = target.type === 'pinned';
      toggleTabPinned({ tabId: Number(active.id), pinned: shouldPin });
    }
  };

  // Helper to find the dragged tab for overlay
  const dragOverlayTab = useMemo(() => {
    if (!activeDragId || !activeSpace) return null;
    const allTabs = [...activeSpace.pinnedTabs, ...visibleTemporaryTabs];
    return allTabs.find((t) => t.id === activeDragId);
  }, [activeDragId, activeSpace, visibleTemporaryTabs]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex flex-col h-full min-h-0 transition-all duration-500"
        style={{
          background: spaceTheme.gradient,
        }}
      >
        {/* Search Bar - Always visible at top */}
        <div className="flex-shrink-0 px-3 pt-3">
          <SearchBar variant={componentVariant} onOpenCommandPalette={handleOpenCommandPalette} />
        </div>

        {/* Favorites Grid */}
        <div className="flex-shrink-0">
          <FavoritesBar pinnedTabs={favoriteTabs} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto px-3">
            {/* Tab Navigation */}
            <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-sm rounded-lg mb-3">
              <div className="flex">
                {(['spaces', 'archive', 'settings'] as const).map((tab) => (
                  <button
                    type="button"
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                      activeTab === tab
                        ? 'text-white bg-white/20'
                        : 'text-white/60 hover:text-white/80'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="space-y-4 pb-4">
              {activeTab === 'spaces' && (
                <>
                  {/* Space Header */}
                  <div className="flex items-center gap-2">
                    {activeSpace?.icon && <span className="text-2xl">{activeSpace.icon}</span>}
                    <SpaceManager variant={componentVariant} />
                  </div>

                  {activeSpace ? (
                    <div className="space-y-3">
                      <EnhancedTabList
                        tabs={activeSpace.pinnedTabs}
                        title="Pinned"
                        emptyMessage="No pinned tabs"
                        variant={componentVariant}
                        floatingContext={variant === 'floating' ? 'pinned' : undefined}
                      />
                      <EnhancedTabList
                        tabs={visibleTemporaryTabs}
                        title="Temporary"
                        emptyMessage="No temporary tabs"
                        variant={componentVariant}
                        floatingContext={variant === 'floating' ? 'temporary' : undefined}
                      />
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-xs text-white/50">
                      No spaces available. Create a space to get started.
                    </div>
                  )}
                </>
              )}

              {activeTab === 'archive' && <ArchiveManager variant={componentVariant} />}
              {activeTab === 'settings' && <SettingsPanel variant={componentVariant} />}
            </div>
          </div>
        </div>

        {/* Bottom Section - New Tab Button + Space Switcher */}
        <div className="flex-shrink-0 px-3 pb-3 space-y-2">
          <NewTabButton variant={componentVariant} />
          <SpaceSwitcher variant={componentVariant} />
        </div>

        <DragOverlay>
          {dragOverlayTab ? (
            <TabRow tab={dragOverlayTab} compact={false} variant={componentVariant} />
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
