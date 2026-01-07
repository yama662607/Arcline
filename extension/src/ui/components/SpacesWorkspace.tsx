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
import { Plus, X } from 'lucide-react';
import { useCallback, useMemo, useState, useEffect } from 'react';

import { useServiceWorkerBridge } from '@/hooks/use-service-worker-bridge';
import {
  useAddToFavorites,
  useFavorites,
  useReorderTab,
  useSettings,
  useToggleTabPinned,
} from '@/hooks/use-spaces-query';
import { getSpaceTheme } from '@/lib/space-theme';
import type { ImportedBookmark, ImportResult } from '@/lib/bookmark-import';
import type { SpaceSnapshot, TabEntry } from '@/shared/types';
import { useSpacesStore } from '@/store';
import { ArchiveManager } from '@/ui/components/ArchiveManager';
import { BookmarkImport } from '@/ui/components/BookmarkImport';
import { BookmarkImportPreview } from '@/ui/components/BookmarkImportPreview';
import { BottomSpaceBar } from '@/ui/components/BottomSpaceBar';
import { EnhancedTabList } from '@/ui/components/EnhancedTabList';
import { FavoritesBar } from '@/ui/components/FavoritesBar';

import { PinnedItemList } from '@/ui/components/PinnedItems';
import { SearchBar } from '@/ui/components/SearchBar';
import { SettingsPanel } from '@/ui/components/SettingsPanel';
import { SpaceContentView } from '@/ui/components/SpaceContentView';
import { SpaceManagementModal } from '@/ui/components/SpaceManagementModal';
import { TabRow } from '@/ui/components/TabRow';
import { usePortalContainer } from '@/ui/contexts/PortalContext';

interface SpacesWorkspaceProps {
  variant: 'sidepanel' | 'floating';
}

export function SpacesWorkspace({ variant }: SpacesWorkspaceProps) {
  const [activeDragId, setActiveDragId] = useState<number | string | null>(null);
  const [showManageSpaces, setShowManageSpaces] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showBookmarkImport, setShowBookmarkImport] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const { data: settings } = useSettings();
  const bridge = useServiceWorkerBridge();

  const setIsModalOpen = useSpacesStore((state) => state.setIsModalOpen);

  useEffect(() => {
    // Sync modal state to store
    setIsModalOpen(
      showManageSpaces || showSettings || showArchive || showBookmarkImport || !!importResult
    );
  }, [
    showManageSpaces,
    showSettings,
    showArchive,
    showBookmarkImport,
    importResult,
    setIsModalOpen,
  ]);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: recursive import logic
  const handleImportConfirm = async (selectedBookmarks: ImportedBookmark[]) => {
    if (!bridge) return;

    try {
      let importedCount = 0;

      const importBookmark = async (
        bookmark: ImportedBookmark,
        spaceName: string,
        parentId?: string
      ) => {
        if (bookmark.isFolder) {
          const folder = await bridge.createPinnedFolder(spaceName, bookmark.title, parentId);
          if (bookmark.children) {
            for (const child of bookmark.children) {
              await importBookmark(child, spaceName, folder.id);
            }
          }
        } else if (bookmark.url) {
          await bridge.createPinnedTab(
            spaceName,
            bookmark.title,
            bookmark.url,
            undefined,
            parentId
          );
          importedCount++;
        }
      };

      const defaultSpaceName = settings?.defaultSpaceName || 'Home';

      for (const bookmark of selectedBookmarks) {
        if (bookmark.isFolder) {
          const spaceName = bookmark.title || defaultSpaceName;
          if (bookmark.children) {
            for (const child of bookmark.children) {
              await importBookmark(child, spaceName);
            }
          }
        } else if (bookmark.url) {
          await bridge.createPinnedTab(defaultSpaceName, bookmark.title, bookmark.url);
          importedCount++;
        }
      }

      setImportResult(null);
      setImportSuccess(`Successfully imported ${importedCount} bookmarks into spaces!`);
    } catch (error) {
      console.error('Failed to import bookmarks:', error);
      setImportSuccess(null);
    }
  };

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

  const portalContainer = usePortalContainer();
  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const activeSpace = useMemo(() => {
    const space = spaces.find((space) => space.id === activeSpaceId) ?? null;
    console.log(
      `[Arcline] [UI] SpacesWorkspace Render: activeSpaceId=${activeSpaceId}, spacesCount=${spaces.length}`
    );
    if (space) {
      console.log(
        `[Arcline] [UI] ActiveSpace Found: "${space.name}" (id=${space.id}) -> pinnedItems=${space.pinnedItems?.length}, tabs=${space.tabs?.length}`
      );
    } else {
      console.log('[Arcline] [UI] ActiveSpace NOT FOUND in spaces list');
    }
    return space;
  }, [spaces, activeSpaceId]);

  const getSpaceById = useCallback(
    (spaceId: number | null): SpaceSnapshot | null =>
      spaces.find((space) => space.id === spaceId) ?? null,
    [spaces]
  );

  const buildTemporaryTabs = useCallback((space: SpaceSnapshot | null) => {
    if (!space) return [];
    const dedupe = new Map<number, TabEntry>();
    for (const tab of [...space.tabs, ...space.temporaryTabs]) {
      if (!tab.pinned && !tab.url?.includes('empty-space.html')) {
        dedupe.set(tab.id, tab);
      }
    }
    return Array.from(dedupe.values());
  }, []);

  const visibleTemporaryTabs = useMemo(() => {
    if (!activeSpace) return [];
    return buildTemporaryTabs(activeSpace);
  }, [activeSpace, buildTemporaryTabs]);

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

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: handleDragEnd is naturally complex due to multiple DND scenarios
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
        <div className="flex-shrink-0 px-2 pt-3">
          <SearchBar variant={componentVariant} onOpenCommandPalette={handleOpenCommandPalette} />
        </div>

        {/* Favorites Grid */}
        <div className="flex-shrink-0">
          <FavoritesBar pinnedTabs={favoriteTabs} />
        </div>

        {/* Space Name - Between Favorites and Pinned */}
        <div className="flex-shrink-0 px-4 py-2 flex items-center gap-2">
          {activeSpace?.icon && <span className="text-lg drop-shadow-md">{activeSpace.icon}</span>}
          <h2 className="text-sm font-bold text-white tracking-wide drop-shadow-md">
            {activeSpace?.name || 'Spaces'}
          </h2>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="flex h-full flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pointer-events-auto">
              <div className="min-h-full">
                {/* Content with slide animation */}
                <SpaceContentView
                  activeSpaceId={activeSpaceId}
                  renderContent={useCallback(
                    (spaceId: number | null, { isActive }: { isActive: boolean }) => {
                      const space = getSpaceById(spaceId);
                      const temporaryTabs = buildTemporaryTabs(space);
                      return space ? (
                        <div className="space-y-4 px-2 pb-4 pt-4">
                          {/* Space component - Simplified for Floating UI */}

                          {/* We don't need the Space Header here as FloatingApp has it.
                              However, MoreMenu provides space-specific actions.
                              Let's hide the header and just show lists. */}

                          {/* Pinned Items Section Header */}
                          {(space.pinnedItems?.length > 0 || space.pinnedTabs?.length > 0) && (
                            <div className="px-1 mt-2 mb-2 flex items-center justify-between">
                              <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider pl-2">
                                Pinned
                              </h3>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                {/* Keeps MoreMenu accessible if needed, or rely on FloatingApp header */}
                              </div>
                            </div>
                          )}

                          {/* Pinned Items from Bookmarks */}
                          {space.pinnedItems && space.pinnedItems.length > 0 && (
                            <PinnedItemList
                              items={space.pinnedItems}
                              spaceName={space.name}
                              level={0}
                            />
                          )}

                          {/* Chrome Pinned Tabs (only if no pinnedItems from bookmarks) */}
                          {(!space.pinnedItems || space.pinnedItems.length === 0) && (
                            <EnhancedTabList
                              tabs={space.pinnedTabs}
                              title=""
                              emptyMessage="No pinned tabs"
                              variant={componentVariant}
                              floatingContext={variant === 'floating' ? 'pinned' : undefined}
                              interactive={isActive}
                            />
                          )}

                          {/* Divider with Clear button */}
                          <div className="relative flex items-center gap-2 py-2">
                            <div className="flex-1 h-px bg-white/10" />
                            {temporaryTabs.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  // Close all temporary tabs
                                  const tabIds = temporaryTabs.map((t) => t.id);
                                  chrome.tabs.remove(tabIds);
                                }}
                                disabled={!isActive} // Disable interaction if not active to prevent accidental clicks
                                className="px-2 py-1 text-xs text-white/50 hover:text-white/80 transition-colors disabled:opacity-30 disabled:cursor-default"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          {/* New Tab button - now inside space content for swipe */}
                          <button
                            type="button"
                            data-testid="new-tab-button"
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('arcline-open-command-palette'));
                            }}
                            disabled={!isActive}
                            className="group flex items-center gap-3 w-full text-left text-white/60 hover:text-white transition-colors py-1 disabled:opacity-30 disabled:cursor-default"
                          >
                            <div className="flex h-4 w-4 items-center justify-center rounded bg-white/10 group-hover:bg-white/20 transition-colors">
                              <Plus className="h-3 w-3" />
                            </div>
                            <span className="text-[13px] font-medium">+ New Tab</span>
                          </button>

                          <EnhancedTabList
                            tabs={temporaryTabs}
                            title=""
                            emptyMessage="No temporary tabs"
                            variant={componentVariant}
                            floatingContext={variant === 'floating' ? 'temporary' : undefined}
                            interactive={isActive}
                          />
                        </div>
                      ) : (
                        <div className="px-4 py-8 text-center text-xs text-white/50">
                          No spaces available. Create a space to get started.
                        </div>
                      );
                    },
                    [componentVariant, getSpaceById, buildTemporaryTabs, variant]
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - Bottom Space Bar */}
        <div className="flex-shrink-0 px-3 pb-3">
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
        <Dialog.Portal container={portalContainer}>
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
        <Dialog.Portal container={portalContainer}>
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
        <Dialog.Portal container={portalContainer}>
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
              {importSuccess && (
                <div className="mb-4 rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400">
                  {importSuccess}
                </div>
              )}
              {importResult ? (
                <BookmarkImportPreview
                  result={importResult}
                  onConfirm={handleImportConfirm}
                  onCancel={() => setImportResult(null)}
                />
              ) : (
                <BookmarkImport
                  onImport={(result) => {
                    setImportResult(result);
                    setImportSuccess(null);
                  }}
                  onCancel={() => setShowBookmarkImport(false)}
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </DndContext>
  );
}
