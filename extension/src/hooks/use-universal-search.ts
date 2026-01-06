import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useServiceWorkerBridge } from '@/hooks/use-service-worker-bridge';
import type { SearchResult } from '@/shared/types';

/**
 * Custom hook for universal search across tabs, bookmarks, and history.
 * Uses background service for search execution.
 */
export function useUniversalSearch(query: string, enabled: boolean) {
  const bridge = useServiceWorkerBridge();

  // 1. Local Tab/Space Search (via Background Service)
  const { data: localResults, isLoading: localLoading } = useQuery({
    queryKey: ['search', 'local', query],
    queryFn: () => bridge?.searchLocal(query) ?? Promise.resolve([]),
    enabled: enabled && !!query.trim() && !!bridge,
    staleTime: 0, // Always fetch fresh
  });

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
    const merged: SearchResult[] = localResults ? [...localResults] : [];

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
    isLoading: localLoading || historyLoading || bookmarksLoading,
  };
}
