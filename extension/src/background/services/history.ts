import type { SearchResult } from '@/shared/types';

export async function searchHistory(query: string, maxResults = 20): Promise<SearchResult[]> {
  const items = await chrome.history.search({ text: query, maxResults });
  return items.map((item) => ({
    type: 'history',
    id: item.id,
    title: item.title || item.url || 'Unknown',
    url: item.url,
    lastVisitTime: item.lastVisitTime,
  }));
}
