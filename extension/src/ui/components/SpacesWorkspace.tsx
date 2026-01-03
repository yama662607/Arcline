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
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
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
import { BookmarkImport } from '@/ui/components/BookmarkImport';
import { BottomSpaceBar } from '@/ui/components/BottomSpaceBar';
import { EnhancedTabList } from '@/ui/components/EnhancedTabList';
import { FavoritesBar } from '@/ui/components/FavoritesBar';
import { MoreMenu } from '@/ui/components/MoreMenu';
import { NewTabButton } from '@/ui/components/NewTabButton';
import { SearchBar } from '@/ui/components/SearchBar';
import { SettingsPanel } from '@/ui/components/SettingsPanel';
import { SpaceContentView } from '@/ui/components/SpaceContentView';
import { SpaceManagementModal } from '@/ui/components/SpaceManagementModal';
import { TabRow } from '@/ui/components/TabRow';

interface SpacesWorkspaceProps {
  variant: 'sidepanel' | 'floating';
}

export function SpacesWorkspace({ variant }: SpacesWorkspaceProps) {
  const [activeDragId, setActiveDragId] = useState<number | string | null>(null);
  const [showManageSpaces, setShowManageSpaces] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showBookmarkImport, setShowBookmarkImport] = useState(false);

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
      if (source?.tab) {
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
          // Floating UI applies gradient at FloatingApp level, sidepanel applies here
          background: variant === 'floating' ? 'transparent' : spaceTheme.gradient,
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
            <div className="space-y-4 pb-4">
              {/* Content with slide animation */}
              <SpaceContentView activeSpaceId={activeSpaceId}>
                {activeSpace ? (
                  <div className="space-y-3">
                    {/* Space Header */}
                    <div className="flex items-center gap-2">
                      {activeSpace.icon && <span className="text-xl">{activeSpace.icon}</span>}
                      <h2 className="text-sm font-medium text-white/70">
                        {activeSpace.name || 'No Space'}
                      </h2>
                      <div className="ml-auto">
                        <MoreMenu
                          variant={componentVariant}
                          onOpenSettings={() => setShowSettings(true)}
                          onOpenArchive={() => setShowArchive(true)}
                          onOpenBookmarkImport={() => setShowBookmarkImport(true)}
                        />
                      </div>
                    </div>

                    <EnhancedTabList
                      tabs={activeSpace.pinnedTabs}
                      title=""
                      emptyMessage="No pinned tabs"
                      variant={componentVariant}
                      floatingContext={variant === 'floating' ? 'pinned' : undefined}
                    />

                    {/* Divider with Clear button */}
                    <div className="relative flex items-center gap-2 py-2">
                      <div className="flex-1 h-px bg-white/10" />
                      {visibleTemporaryTabs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            // Close all temporary tabs
                            const tabIds = visibleTemporaryTabs.map((t) => t.id);
                            chrome.tabs.remove(tabIds);
                          }}
                          className="px-2 py-1 text-xs text-white/50 hover:text-white/80 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <EnhancedTabList
                      tabs={visibleTemporaryTabs}
                      title=""
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
              </SpaceContentView>
            </div>
          </div>
        </div>

        {/* Bottom Section - New Tab Button + Bottom Space Bar */}
        <div className="flex-shrink-0 px-3 pb-3 space-y-2">
          <NewTabButton variant={componentVariant} />
          <BottomSpaceBar
            variant={componentVariant}
            onManageSpaces={() => setShowManageSpaces(true)}
          />
        </div>

        <DragOverlay>
          {dragOverlayTab ? (
            <TabRow tab={dragOverlayTab} compact={false} variant={componentVariant} />
          ) : null}
        </DragOverlay>
      </div>

      {/* Space Management Modal */}
      <SpaceManagementModal isOpen={showManageSpaces} onClose={() => setShowManageSpaces(false)} />

      {/* Settings Modal */}
      <Dialog.Root open={showSettings} onOpenChange={setShowSettings}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-lg border border-white/10 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-white/10 z-10">
              <Dialog.Title className="text-lg font-medium text-white">Settings</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
            <div className="px-6 py-4">
              <SettingsPanel variant={componentVariant} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Archive Modal */}
      <Dialog.Root open={showArchive} onOpenChange={setShowArchive}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-lg border border-white/10 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-white/10 z-10">
              <Dialog.Title className="text-lg font-medium text-white">Archive</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
            <div className="px-6 py-4">
              <ArchiveManager variant={componentVariant} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Bookmark Import Modal */}
      <Dialog.Root open={showBookmarkImport} onOpenChange={setShowBookmarkImport}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-lg border border-white/10 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-white/10 z-10">
              <Dialog.Title className="text-lg font-medium text-white">
                Import Bookmarks
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
            <div className="px-6 py-4">
              <BookmarkImport
                onImport={() => {
                  // Import logic is handled by SettingsPanel
                  // This is a simplified version for the modal
                }}
                onCancel={() => setShowBookmarkImport(false)}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </DndContext>
  );
}
