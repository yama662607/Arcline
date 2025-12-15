import { useQuery } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import { useMemo } from 'react';
import { useServiceWorkerBridge } from '@/hooks/use-service-worker-bridge';
import type { PinnedItem, SearchResult, SpaceSnapshot, TabEntry } from '@/shared/types';
import { useSpacesSnapshot } from './use-spaces-query';

export function useUniversalSearch(query: string, enabled: boolean) {
  const bridge = useServiceWorkerBridge();
  const { data: spaces } = useSpacesSnapshot();

  // 1. Local Tab/Space Search using Fuse.js
  const localResults = useMemo(() => {
    if (!spaces || !query.trim()) return [];

    const tabs: SearchResult[] = [];

    // Normalize Tabs
    spaces.forEach((space: SpaceSnapshot) => {
      // Pinned Tabs
      space.pinnedItems.forEach((item: PinnedItem) => {
        if (item.type === 'tab') {
          tabs.push({
            id: String(item.tabId || item.id),
            title: item.title,
            url: item.url,
            type: 'tab',
            favIconUrl: item.favIconUrl,
            description: `Pinned in ${space.name}`,
          } as SearchResult);
        }
      });

      // Open Tabs
      space.tabs.forEach((tab: TabEntry) => {
        tabs.push({
          id: String(tab.id),
          title: tab.title,
          url: tab.url,
          type: 'tab',
          favIconUrl: tab.favIconUrl,
          description: space.name,
        } as SearchResult);
      });

      // Temporary Tabs
      space.temporaryTabs.forEach((tab: TabEntry) => {
        tabs.push({
          id: String(tab.id),
          title: tab.title,
          url: tab.url,
          type: 'tab',
          favIconUrl: tab.favIconUrl,
          description: space.name,
        } as SearchResult);
      });
    });

    const fuse = new Fuse(tabs, {
      keys: ['title', 'url'],
      threshold: 0.4,
    });

    return fuse.search(query).map((res) => res.item);
  }, [spaces, query]);

  // 2. Remote Search (History)
  const { data: historyResults, isLoading: historyLoading } = useQuery({
    queryKey: ['search', 'history', query],
    queryFn: () => bridge?.searchHistory(query),
    enabled: enabled && !!query.trim() && !!bridge,
    staleTime: 1000 * 60 * 5, // 5 minutes
    initialData: [],
  });

  // 3. Remote Search (Bookmarks)
  const { data: bookmarkResults, isLoading: bookmarksLoading } = useQuery({
    queryKey: ['search', 'bookmarks', query],
    queryFn: () => bridge?.searchBookmarks(query),
    enabled: enabled && !!query.trim() && !!bridge,
    staleTime: 1000 * 60 * 5,
    initialData: [],
  });

  // Merge results
  const results = useMemo(() => {
    const merged: SearchResult[] = [...localResults];

    const seenIds = new Set(merged.map((r) => r.url)); // simple dedup by URL

    if (bookmarkResults) {
      bookmarkResults.forEach((bm: SearchResult) => {
        if (bm.url && !seenIds.has(bm.url)) {
          merged.push(bm);
          seenIds.add(bm.url);
        }
      });
    }

    if (historyResults) {
      historyResults.forEach((h: SearchResult) => {
        if (h.url && !seenIds.has(h.url)) {
          merged.push(h);
          seenIds.add(h.url);
        }
      });
    }

    return merged;
  }, [localResults, historyResults, bookmarkResults]);

  return {
    results,
    isLoading: historyLoading || bookmarksLoading,
  };
}
