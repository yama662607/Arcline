import { Command } from 'cmdk';
import { Bookmark, Globe, History, Layout, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useDebounce } from '@/hooks/use-debounce';
import { useServiceWorkerBridge } from '@/hooks/use-service-worker-bridge';
import { useUniversalSearch } from '@/hooks/use-universal-search';
import type { SearchResult } from '@/shared/types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 150);
  const { results, isLoading } = useUniversalSearch(debouncedQuery, isOpen);
  const bridge = useServiceWorkerBridge();

  // Reset query when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const handleSelect = useCallback(
    async (item: SearchResult) => {
      if (!bridge) return;
      onClose();

      try {
        if (item.type === 'tab') {
          // If ID is numeric strings
          const tabId = parseInt(item.id, 10);
          if (Number.isNaN(tabId)) {
            // Fallback for pinned items with URL ID? Pinned items should have tabId or openUrl
            if (item.url) await bridge.openUrlInTab(item.url);
          } else {
            await bridge.activateTab(tabId);
          }
        } else if (item.url) {
          await bridge.openUrlInTab(item.url);
        }
      } catch (error) {
        console.error('Failed to navigate:', error);
      }
    },
    [bridge, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[20vh] bg-black/40 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Menu"
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl ring-1 ring-white/10"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          e.stopPropagation(); // prevent bubbling to page
        }}
      >
        <Command label="Command Menu" shouldFilter={false}>
          <div className="flex items-center border-b border-white/10 px-4">
            <Search className="mr-2 h-5 w-5 text-slate-400" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search tabs, bookmarks, history..."
              className="flex-1 bg-transparent py-4 text-lg text-white placeholder:text-slate-500 outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose();
                }
              }}
            />
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            {isLoading && (
              <Command.Loading className="py-6 text-center text-sm text-slate-500">
                Searching...
              </Command.Loading>
            )}

            {!isLoading && results.length === 0 && query && (
              <div className="py-6 text-center text-sm text-slate-500">No results found.</div>
            )}

            {results.map((item) => (
              <Command.Item
                key={`${item.type}-${item.id}`}
                onSelect={() => handleSelect(item)}
                className="group flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-300 aria-selected:bg-white/10 aria-selected:text-white"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded bg-white/5 text-slate-400 group-aria-selected:bg-white/10 group-aria-selected:text-white">
                  {item.type === 'tab' && <Layout className="h-4 w-4" />}
                  {item.type === 'bookmark' && <Bookmark className="h-4 w-4" />}
                  {item.type === 'history' && <History className="h-4 w-4" />}
                  {item.type === 'space' && <Globe className="h-4 w-4" />}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate font-medium">{item.title}</span>
                  <span className="truncate text-xs text-slate-500 group-aria-selected:text-slate-400">
                    {item.description || item.url}
                  </span>
                </div>
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
