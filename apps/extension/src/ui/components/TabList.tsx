import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import type { SpaceSnapshot, TabEntry } from '@/shared/spaces';
import { activateTab, closeTab, moveTabToSpace, toggleTabPinned } from '@/lib/tabs';

interface TabListProps {
  tabs: TabEntry[];
  spaces: SpaceSnapshot[];
  activeSpaceId: number | null;
  pinned?: boolean;
  title: string;
}

export function TabList({ tabs, spaces, activeSpaceId, pinned = false, title }: TabListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => tabs, [tabs]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 4
  });

  const spaceOptions = useMemo(() => spaces.filter((space) => space.id !== activeSpaceId), [spaces, activeSpaceId]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-200">{title}</h3>
        <span className="text-xs text-slate-400">{tabs.length}</span>
      </div>
      <div ref={parentRef} className="max-h-72 overflow-y-auto">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const tab = items[virtualRow.index];
            if (!tab) return null;

            return (
              <div
                key={tab.id}
                className="absolute left-0 right-0 px-1"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 shadow-sm">
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => activateTab(tab.id).catch((error) => console.warn(error))}
                  >
                    <div className="font-medium leading-tight line-clamp-1">{tab.title}</div>
                    {tab.url && (
                      <div className="text-[11px] text-slate-400 line-clamp-1">{tab.url}</div>
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`rounded px-2 py-1 text-xs ${
                        tab.pinned ? 'bg-amber-500/20 text-amber-200' : 'bg-slate-500/20 text-slate-200'
                      }`}
                      onClick={() => toggleTabPinned(tab.id).catch((error) => console.warn(error))}
                    >
                      {tab.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    {spaceOptions.length > 0 && (
                      <select
                        className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200"
                        defaultValue=""
                        onChange={(event) => {
                          const targetId = Number.parseInt(event.target.value, 10);
                          if (Number.isNaN(targetId)) return;
                          moveTabToSpace(tab.id, targetId).catch((error) => console.warn(error));
                          event.target.value = '';
                        }}
                      >
                        <option value="" disabled>
                          Move
                        </option>
                        {spaceOptions.map((space) => (
                          <option key={space.id} value={space.id}>
                            {space.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-200"
                      onClick={() => closeTab(tab.id).catch((error) => console.warn(error))}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {tabs.length === 0 && <p className="text-xs text-slate-400">No tabs in this section.</p>}
    </div>
  );
}
