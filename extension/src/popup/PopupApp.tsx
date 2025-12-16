import { QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useFavorites } from '@/hooks/use-spaces-query';
import { queryClient } from '@/lib/query-client';
import { useSpacesSync } from '@/lib/useSpacesSync';
import type { TabEntry } from '@/shared/types';
import { useSpacesStore } from '@/store';
import { ArchiveManager } from '@/ui/components/ArchiveManager';
import { EnhancedTabList } from '@/ui/components/EnhancedTabList';
import { FavoritesBar } from '@/ui/components/FavoritesBar';
import { SettingsPanel } from '@/ui/components/SettingsPanel';
import { SpaceManager } from '@/ui/components/SpaceManager';

function PopupAppContent() {
  const [activeTab, setActiveTab] = useState<'spaces' | 'archive' | 'settings'>('spaces');
  useSpacesSync();

  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
  );

  // Fetch favorites from storage
  const { data: favorites } = useFavorites();

  // Convert FavoriteTab[] to TabEntry[] for FavoritesBar
  const favoriteTabs: TabEntry[] = useMemo(() => {
    if (!favorites) return [];
    return favorites.map((fav, index) => ({
      id: index, // Use index as temporary ID since favorites don't have persistent tab IDs
      url: fav.url,
      title: fav.title,
      favIconUrl: fav.favIconUrl,
      pinned: false,
      active: false,
      windowId: 0,
      groupId: -1,
    }));
  }, [favorites]);
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // const [contextMenu, setContextMenu] = useState<{
  //   tab: TabEntry;
  //   x: number;
  //   y: number;
  // } | null>(null);

  return (
    <div className="w-80 h-96 flex flex-col text-slate-100 bg-surface">
      <header className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Arcline</p>
          <h1 className="text-sm font-semibold text-white">Spaces</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md bg-white/10 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/20"
            onClick={() => window.close()}
          >
            ×
          </button>
        </div>
      </header>

      <div className="flex border-b border-white/10">
        {(['spaces', 'archive', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
              activeTab === tab ? 'text-white bg-white/10' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'spaces' && (
          <div className="space-y-3">
            <FavoritesBar pinnedTabs={favoriteTabs} />
            <SpaceManager variant="floating" />

            {activeSpace && (
              <div className="space-y-2">
                <EnhancedTabList
                  tabs={activeSpace.pinnedTabs}
                  title="Pinned"
                  emptyMessage="No pinned tabs"
                  variant="floating"
                />
                <EnhancedTabList
                  tabs={activeSpace.temporaryTabs}
                  title="Temporary"
                  emptyMessage="No temporary tabs"
                  variant="floating"
                />
              </div>
            )}

            {!activeSpace && (
              <div className="px-3 py-6 text-center text-xs text-slate-500">
                No spaces available. Create a space to get started.
              </div>
            )}
          </div>
        )}

        {activeTab === 'archive' && <ArchiveManager variant="floating" />}

        {activeTab === 'settings' && <SettingsPanel variant="floating" />}
      </div>

      <footer className="border-t border-white/10 px-3 py-1 text-[10px] text-slate-400 text-center">
        <a
          href="https://www.gnu.org/licenses/gpl-3.0.html"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white underline"
        >
          GPL-3.0
        </a>
        {' • '}
        <a
          href="https://github.com/anthropics/arcline"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white underline"
        >
          Source
        </a>
      </footer>
    </div>
  );
}

export default function PopupApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <PopupAppContent />
    </QueryClientProvider>
  );
}
