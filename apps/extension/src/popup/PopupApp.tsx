import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useSpacesSync } from '@/lib/useSpacesSync';
import { SpaceManager } from '@/ui/components/SpaceManager';
import { EnhancedTabList } from '@/ui/components/EnhancedTabList';
import { ArchiveManager } from '@/ui/components/ArchiveManager';
import { SettingsPanel } from '@/ui/components/SettingsPanel';
import { TabContextMenu } from '@/ui/components/TabContextMenu';
import { useSpacesStore } from '@/store';
import type { TabEntry } from '@/shared/types';
import { queryClient } from '@/lib/query-client';

export default function PopupApp() {
  const [activeTab, setActiveTab] = useState<'spaces' | 'archive' | 'settings'>('spaces');
  useSpacesSync();

  const spaces = useSpacesStore((state) => state.spaces);
  const activeSpaceId = useSpacesStore((state) => state.activeSpaceId);
  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
  );
  const [contextMenu, setContextMenu] = useState<{
    tab: TabEntry;
    x: number;
    y: number;
  } | null>(null);

  return (
    <QueryClientProvider client={queryClient}>
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
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-2 py-1 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'text-white bg-white/10'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'spaces' && (
            <div className="space-y-3">
              <SpaceManager variant="floating" />
              
              {activeSpace && (
                <div className="space-y-2">
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
                        y: rect.top 
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
                        y: rect.top 
                      });
                    }}
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

          {activeTab === 'archive' && (
            <ArchiveManager variant="floating" />
          )}

          {activeTab === 'settings' && (
            <SettingsPanel variant="floating" />
          )}
        </div>

        <footer className="border-t border-white/10 px-3 py-1 text-[10px] text-slate-400 text-center">
          Popup UI • Click outside to close
        </footer>

        {contextMenu && (
          <TabContextMenu
            tab={contextMenu.tab}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </QueryClientProvider>
  );
}
