import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock ResizeObserver for cmdk
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = ResizeObserverMock;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';

import { CommandPalette } from './CommandPalette';

// Mock dependencies
const mockBridge = {
  activateTab: vi.fn(),
  openUrlInTab: vi.fn(),
  searchHistory: vi.fn().mockResolvedValue([]),
  searchBookmarks: vi.fn().mockResolvedValue([]),
};

vi.mock('@/hooks/use-service-worker-bridge', () => ({
  useServiceWorkerBridge: () => mockBridge,
}));

vi.mock('@/hooks/use-universal-search', () => ({
  useUniversalSearch: vi.fn().mockReturnValue({
    results: [],
    isLoading: false,
  }),
}));

import { useUniversalSearch } from '@/hooks/use-universal-search';

describe('CommandPalette', () => {
  let queryClient: QueryClient;
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    (useUniversalSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      results: [],
      isLoading: false,
    });
  });

  const renderComponent = (isOpen: boolean) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CommandPalette isOpen={isOpen} onClose={onClose} />
      </QueryClientProvider>
    );
  };

  it('does not render content when isOpen is false', () => {
    renderComponent(false);
    expect(
      screen.queryByPlaceholderText(/Search tabs, bookmarks, history/i)
    ).not.toBeInTheDocument();
  });

  it('renders search input when isOpen is true', () => {
    renderComponent(true);
    expect(screen.getByPlaceholderText(/Search tabs, bookmarks, history/i)).toBeInTheDocument();
  });

  it('displays loading state', () => {
    (useUniversalSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      results: [],
      isLoading: true,
    });
    renderComponent(true);
    expect(screen.getByText(/Searching/i)).toBeInTheDocument();
  });

  it('displays search results', () => {
    (useUniversalSearch as ReturnType<typeof vi.fn>).mockReturnValue({
      results: [
        { id: '1', title: 'Test Tab', type: 'tab', url: 'http://test.com' },
        { id: '2', title: 'Test Bookmark', type: 'bookmark', url: 'http://bookmark.com' },
      ],
      isLoading: false,
    });
    renderComponent(true);

    expect(screen.getByText('Test Tab')).toBeInTheDocument();
    expect(screen.getByText('Test Bookmark')).toBeInTheDocument();
  });
});
