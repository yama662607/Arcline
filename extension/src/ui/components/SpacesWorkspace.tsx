import { useMemo, useState } from 'react';

import { useFavorites } from '@/hooks/use-spaces-query';
import type { UiMode } from '@/lib/ui-mode';
import type { TabEntry } from '@/shared/types';
import { useSpacesStore } from '@/store';
import { ActiveTabHeader } from '@/ui/components/ActiveTabHeader';
import { ArchiveManager } from '@/ui/components/ArchiveManager';
import { EnhancedTabList } from '@/ui/components/EnhancedTabList';
import { FavoritesBar } from '@/ui/components/FavoritesBar';
import { SettingsPanel } from '@/ui/components/SettingsPanel';
import { SpaceManager } from '@/ui/components/SpaceManager';
import { TabContextMenu } from '@/ui/components/TabContextMenu';

interface SpacesWorkspaceProps {
  variant: 'sidepanel' | 'floating';
  uiMode?: UiMode;
}

export function SpacesWorkspace({ variant, uiMode }: SpacesWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'spaces' | 'archive' | 'settings'>('spaces');
  const [contextMenu, setContextMenu] = useState<{
    tab: TabEntry;
    x: number;
    y: number;
  } | null>(null);

  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
  );

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

  const handleContextMenu = (tab: TabEntry, event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (variant === 'floating') {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setContextMenu({
        tab,
        x: rect.left,
        y: rect.top,
      });
      return;
    }

    const x = Math.min(event.clientX, window.innerWidth - 220);
    const y = Math.min(event.clientY, window.innerHeight - 160);
    setContextMenu({ tab, x, y });
  };

  return (
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
                <FavoritesBar pinnedTabs={favoriteTabs} onTabContextMenu={handleContextMenu} />
                <SpaceManager variant={componentVariant} />

                {activeSpace ? (
                  <div className="space-y-3">
                    <EnhancedTabList
                      tabs={activeSpace.pinnedTabs}
                      title="Pinned"
                      emptyMessage="No pinned tabs"
                      variant={componentVariant}
                      floatingContext={variant === 'floating' ? 'pinned' : undefined}
                      onTabContextMenu={handleContextMenu}
                    />
                    <EnhancedTabList
                      tabs={activeSpace.temporaryTabs}
                      title="Temporary"
                      emptyMessage="No temporary tabs"
                      variant={componentVariant}
                      floatingContext={variant === 'floating' ? 'temporary' : undefined}
                      onTabContextMenu={handleContextMenu}
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

      {contextMenu && (
        <TabContextMenu
          tab={contextMenu.tab}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
