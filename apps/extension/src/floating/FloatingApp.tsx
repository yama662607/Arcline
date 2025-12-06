import { QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { queryClient } from '@/lib/query-client';
import { useSpacesSync } from '@/lib/useSpacesSync';
import type { TabEntry } from '@/shared/types';
import { useSpacesStore } from '@/store';
import { ArchiveManager } from '@/ui/components/ArchiveManager';
import { EnhancedTabList } from '@/ui/components/EnhancedTabList';
import { FavoritesBar } from '@/ui/components/FavoritesBar';
import { SettingsPanel } from '@/ui/components/SettingsPanel';
import { SpaceManager } from '@/ui/components/SpaceManager';
import { TabContextMenu } from '@/ui/components/TabContextMenu';

interface FloatingAppProps {
  pinned: boolean;
  onTogglePinned: () => void;
  onRequestClose: () => void;
}

function FloatingAppContent({ pinned, onTogglePinned, onRequestClose }: FloatingAppProps) {
  const [activeTab, setActiveTab] = useState<'spaces' | 'archive' | 'settings'>('spaces');
  useSpacesSync();

  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
  );
  const allPinnedTabs = useMemo(() => {
    const pinnedTabsMap = new Map<number, TabEntry>();
    for (const space of spaces) {
      for (const tab of space.pinnedTabs) {
        if (!pinnedTabsMap.has(tab.id)) {
          pinnedTabsMap.set(tab.id, tab);
        }
      }
    }
    return Array.from(pinnedTabsMap.values());
  }, [spaces]);
  const [contextMenu, setContextMenu] = useState<{
    tab: TabEntry;
    x: number;
    y: number;
  } | null>(null);

  return (
    <div className="flex h-full flex-col text-slate-100">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Arcline</p>
          <h1 className="text-sm font-semibold text-white">Spaces</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-xs font-medium transition ${
              pinned
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'bg-white/10 text-slate-200 hover:bg-white/20'
            }`}
            onClick={onTogglePinned}
          >
            {pinned ? 'Pinned' : 'Pin'}
          </button>
          <button
            type="button"
            className="rounded-md bg-white/10 px-2 py-1 text-xs text-slate-200 transition hover:bg-white/20"
            onClick={onRequestClose}
          >
            ×
          </button>
        </div>
      </header>

      <div className="flex border-b border-white/10">
        {(['spaces', 'archive', 'settings'] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab ? 'text-white bg-white/10' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'spaces' && (
          <div className="space-y-4">
            <FavoritesBar
              pinnedTabs={allPinnedTabs}
              onTabContextMenu={(tab, event) => {
                const rect = (event.target as HTMLElement).getBoundingClientRect();
                setContextMenu({
                  tab,
                  x: rect.left,
                  y: rect.top,
                });
              }}
            />
            <SpaceManager variant="floating" />

            {activeSpace && (
              <div className="space-y-3">
                <EnhancedTabList
                  tabs={activeSpace.pinnedTabs}
                  title="Pinned"
                  emptyMessage="No pinned tabs"
                  variant="floating"
                  onTabContextMenu={(tab, event) => {
                    const rect = (event.target as HTMLElement).getBoundingClientRect();
                    setContextMenu({
                      tab,
                      x: rect.left,
                      y: rect.top,
                    });
                  }}
                />
                <EnhancedTabList
                  tabs={activeSpace.temporaryTabs}
                  title="Temporary"
                  emptyMessage="No temporary tabs"
                  variant="floating"
                  onTabContextMenu={(tab, event) => {
                    const rect = (event.target as HTMLElement).getBoundingClientRect();
                    setContextMenu({
                      tab,
                      x: rect.left,
                      y: rect.top,
                    });
                  }}
                />
              </div>
            )}

            {!activeSpace && (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                No spaces available. Create a space to get started.
              </div>
            )}
          </div>
        )}

        {activeTab === 'archive' && <ArchiveManager variant="floating" />}

        {activeTab === 'settings' && <SettingsPanel variant="floating" />}
      </div>

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

export default function FloatingApp(props: FloatingAppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <FloatingAppContent {...props} />
    </QueryClientProvider>
  );
}
