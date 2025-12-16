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
import { useMemo, useState } from 'react';

import { useFavorites, useReorderTab, useToggleTabPinned } from '@/hooks/use-spaces-query';
import type { UiMode } from '@/lib/ui-mode';
import type { TabEntry } from '@/shared/types';
import { useSpacesStore } from '@/store';
import { ActiveTabHeader } from '@/ui/components/ActiveTabHeader';
import { ArchiveManager } from '@/ui/components/ArchiveManager';
import { EnhancedTabList } from '@/ui/components/EnhancedTabList';
import { FavoritesBar } from '@/ui/components/FavoritesBar';
import { SettingsPanel } from '@/ui/components/SettingsPanel';
import { SpaceManager } from '@/ui/components/SpaceManager';
import { TabRow } from '@/ui/components/TabRow';

interface SpacesWorkspaceProps {
  variant: 'sidepanel' | 'floating';
  uiMode?: UiMode;
}

export function SpacesWorkspace({ variant, uiMode }: SpacesWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'spaces' | 'archive' | 'settings'>('spaces');
  const [activeDragId, setActiveDragId] = useState<number | string | null>(null);

  const { mutate: reorderTab } = useReorderTab();
  const { mutate: toggleTabPinned } = useToggleTabPinned();

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || !activeSpace || active.id === over.id) return;

    const findTab = (id: number | string) => {
      const numId = Number(id);
      if (activeSpace.pinnedTabs.find((t) => t.id === numId))
        return { tab: activeSpace.pinnedTabs.find((t) => t.id === numId), type: 'pinned' as const };
      if (visibleTemporaryTabs.find((t) => t.id === numId))
        return {
          tab: visibleTemporaryTabs.find((t) => t.id === numId),
          type: 'temporary' as const,
        };
      return null;
    };

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
      <div className="space-y-6">
        <ActiveTabHeader />

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-medium text-white">Arcline</h2>
            <div className="text-sm text-slate-400">
              UI Mode:{' '}
              <span className="font-mono">
                {uiMode ?? (variant === 'floating' ? 'floating' : 'side-panel')}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-surface-light">
            <div className="flex border-b border-surface-light">
              {(['spaces', 'archive', 'settings'] as const).map((tab) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'text-white bg-surface-light'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="p-4">
              {activeTab === 'spaces' && (
                <div className="space-y-4">
                  <FavoritesBar pinnedTabs={favoriteTabs} />
                  <SpaceManager variant={componentVariant} />

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
                    <div className="px-4 py-8 text-center text-xs text-slate-500">
                      No spaces available. Create a space to get started.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'archive' && <ArchiveManager variant={componentVariant} />}
              {activeTab === 'settings' && <SettingsPanel variant={componentVariant} />}
            </div>
          </div>
        </section>

        <DragOverlay>
          {dragOverlayTab ? (
            <TabRow tab={dragOverlayTab} compact={false} variant={componentVariant} />
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
