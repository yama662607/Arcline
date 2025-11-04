import { useMemo, useState } from 'react';

import { useSpacesSync } from '@/lib/useSpacesSync';
import { SpaceList } from '@/ui/components/SpaceList';
import { TabList } from '@/ui/components/TabList';
import { TabContextMenu } from '@/ui/components/TabContextMenu';
import { useSpacesStore } from '@/store';
import type { TabEntry } from '@/shared/spaces';

interface FloatingAppProps {
  pinned: boolean;
  onTogglePinned: () => void;
  onRequestClose: () => void;
}

export default function FloatingApp({ pinned, onTogglePinned, onRequestClose }: FloatingAppProps) {
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
              pinned ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-slate-200 hover:bg-white/20'
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
            Close
          </button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-32 flex-shrink-0 border-r border-white/10 px-2 py-3">
          <SpaceList variant="floating" />
        </aside>
        <main className="flex flex-1 flex-col overflow-hidden px-3 py-3 text-sm">
          {activeSpace ? (
            <div className="flex h-full flex-col gap-3 overflow-hidden">
              <div className="flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/30 p-3">
                <TabList
                  title="Pinned"
                  tabs={activeSpace.pinnedTabs}
                  spaces={spaces}
                  activeSpaceId={activeSpaceId}
                  pinned
                  variant="floating"
                  onContextMenu={(tab, event) => {
                    setContextMenu({
                      tab,
                      x: Math.min(event.clientX, window.innerWidth - 220),
                      y: Math.min(event.clientY, window.innerHeight - 160)
                    });
                  }}
                />
              </div>
              <div className="flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/25 p-3">
                <TabList
                  title="Temporary"
                  tabs={activeSpace.temporaryTabs}
                  spaces={spaces}
                  activeSpaceId={activeSpaceId}
                  variant="floating"
                  onContextMenu={(tab, event) => {
                    setContextMenu({
                      tab,
                      x: Math.min(event.clientX, window.innerWidth - 220),
                      y: Math.min(event.clientY, window.innerHeight - 160)
                    });
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 text-xs text-slate-400">
              <p>No spaces available yet.</p>
              <p className="mt-1 text-[10px]">Use the popup UI to create your first space.</p>
            </div>
          )}
        </main>
      </div>
      <footer className="border-t border-white/10 px-4 py-2 text-[11px] text-slate-400">
        {pinned ? 'Floating UI is pinned. Click "Pinned" to return to auto-hide.' : 'Hover the left edge or open the popup on restricted pages.'}
      </footer>
      {contextMenu && activeSpace && (
        <TabContextMenu
          tab={contextMenu.tab}
          spaces={spaces}
          activeSpaceId={activeSpaceId}
          x={contextMenu.x}
          y={contextMenu.y}
          onRequestClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
