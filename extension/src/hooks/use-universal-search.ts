import { Index } from 'flexsearch';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import { useServiceWorkerBridge } from '@/hooks/use-service-worker-bridge';
import type { PinnedItem, SearchResult, SpaceSnapshot, TabEntry } from '@/shared/types';
import { useSpacesSnapshot } from './use-spaces-query';

/**
 * Custom hook for universal search across tabs, bookmarks, and history.
 * Uses FlexSearch for high-performance local search.
 */
export function useUniversalSearch(query: string, enabled: boolean) {
  const bridge = useServiceWorkerBridge();
  const { data: spaces } = useSpacesSnapshot();

  // Reuse FlexSearch index across renders (rebuild when spaces change)
  const indexRef = useRef<Index | null>(null);
  const tabsMapRef = useRef<Map<number, SearchResult>>(new Map());

  // 1. Local Tab/Space Search using FlexSearch
  const localResults = useMemo(() => {
    if (!spaces || !query.trim()) return [];

    // Build search data
    const tabsMap = new Map<number, SearchResult>();
    let idCounter = 0;

    spaces.forEach((space: SpaceSnapshot) => {
      // Pinned Tabs
      space.pinnedItems.forEach((item: PinnedItem) => {
        if (item.type === 'tab') {
          const id = idCounter++;
          tabsMap.set(id, {
            id: String(item.tabId || item.id),
            title: item.title,
            url: item.url,
            type: 'tab',
            favIconUrl: item.favIconUrl,
            description: `Pinned in ${space.name}`,
          });
        }
      });

      // Open Tabs
      space.tabs.forEach((tab: TabEntry) => {
        const id = idCounter++;
        tabsMap.set(id, {
          id: String(tab.id),
          title: tab.title,
          url: tab.url,
          type: 'tab',
          favIconUrl: tab.favIconUrl,
          description: space.name,
        });
      });

      // Temporary Tabs
      space.temporaryTabs.forEach((tab: TabEntry) => {
        const id = idCounter++;
        tabsMap.set(id, {
          id: String(tab.id),
          title: tab.title,
          url: tab.url,
          type: 'tab',
          favIconUrl: tab.favIconUrl,
          description: space.name,
        });
      });
    });

    tabsMapRef.current = tabsMap;

    // Build FlexSearch index
    const index = new Index({
      tokenize: 'forward',
      resolution: 9,
    });

    tabsMap.forEach((result, id) => {
      // Combine title and url for searching
      const content = [result.title, result.url].filter(Boolean).join(' ');
      index.add(id, content);
    });

    indexRef.current = index;

    // Perform search
    const matchedIds = index.search(query, 50) as number[];
    return matchedIds.map((id) => tabsMap.get(id)).filter(Boolean) as SearchResult[];
  }, [spaces, query]);

  // 2. Remote Search (History)
  const { data: historyResults, isLoading: historyLoading } = useQuery({
    queryKey: ['search', 'history', query],
    queryFn: () => bridge?.searchHistory(query),
    enabled: enabled && !!query.trim() && !!bridge,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // 3. Remote Search (Bookmarks)
  const { data: bookmarkResults, isLoading: bookmarksLoading } = useQuery({
    queryKey: ['search', 'bookmarks', query],
    queryFn: () => bridge?.searchBookmarks(query),
    enabled: enabled && !!query.trim() && !!bridge,
    staleTime: 1000 * 60 * 5,
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
