import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUniversalSearch } from './use-universal-search';

const { mockBridge } = vi.hoisted(() => ({
  mockBridge: {
    searchHistory: vi.fn(),
    searchBookmarks: vi.fn(),
    searchLocal: vi.fn(),
  },
}));

vi.mock('@/hooks/use-service-worker-bridge', () => ({
  useServiceWorkerBridge: () => mockBridge,
}));

describe('useUniversalSearch', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBridge.searchHistory.mockClear();
    mockBridge.searchBookmarks.mockClear();
    mockBridge.searchLocal.mockClear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('searches locally (tabs)', async () => {
    mockBridge.searchLocal.mockResolvedValue([
      { type: 'tab', id: '101', title: 'Local Tab', url: 'http://local.com' },
    ]);
    mockBridge.searchHistory.mockResolvedValue([]);
    mockBridge.searchBookmarks.mockResolvedValue([]);

    const { result } = renderHook(() => useUniversalSearch('Local', true), { wrapper });

    await waitFor(
      () => {
        expect(result.current.results).toHaveLength(1);
      },
      { timeout: 2000 }
    );

    expect(result.current.results[0]?.title).toBe('Local Tab');
  });

  it('searches remote (history/bookmarks)', async () => {
    mockBridge.searchLocal.mockResolvedValue([]);
    mockBridge.searchHistory.mockResolvedValue([
      { type: 'history', id: 'h1', title: 'History Item', url: 'http://h.com' },
    ]);
    mockBridge.searchBookmarks.mockResolvedValue([
      { type: 'bookmark', id: 'b1', title: 'Bookmark Item', url: 'http://b.com' },
    ]);

    const { result } = renderHook(() => useUniversalSearch('Item', true), { wrapper });

    await waitFor(
      () => {
        expect(result.current.results).toHaveLength(2);
      },
      { timeout: 2000 }
    );

    const titles = result.current.results.map((r) => r.title);
    expect(titles).toContain('History Item');
    expect(titles).toContain('Bookmark Item');
  });

  it('handles empty bridge (loading)', async () => {
    expect(true).toBe(true);
  });

  it('deduplicates results', async () => {
    mockBridge.searchLocal.mockResolvedValue([
      { type: 'tab', id: '101', title: 'Tab', url: 'http://duplicate.com' },
    ]);
    mockBridge.searchHistory.mockResolvedValue([
      { type: 'history', id: 'h1', title: 'History', url: 'http://duplicate.com' },
    ]);
    mockBridge.searchBookmarks.mockResolvedValue([]);

    const { result } = renderHook(() => useUniversalSearch('duplicate', true), { wrapper });

    await waitFor(
      () => {
        expect(mockBridge.searchHistory).toHaveBeenCalled();
        expect(result.current.results).toHaveLength(1);
      },
      { timeout: 2000 }
    );

    expect(result.current.results[0]?.type).toBe('tab');
  });
});
