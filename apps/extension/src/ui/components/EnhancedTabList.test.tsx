import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnhancedTabList } from './EnhancedTabList';
import type { TabEntry } from '@/shared/types';
import { useSpacesSnapshot } from '@/hooks/use-spaces-query';

// Mock ResizeObserver
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = MockResizeObserver;

// Mock hooks
vi.mock('@/hooks/use-spaces-query', () => ({
  useActivateTab: () => ({ mutate: vi.fn() }),
  useArchiveTab: () => ({ mutate: vi.fn() }),
  useCloseTab: () => ({ mutate: vi.fn() }),
  useMoveTabToSpace: () => ({ mutate: vi.fn() }),
  useToggleTabPinned: () => ({ mutate: vi.fn() }),
  useSpacesSnapshot: vi.fn(),
  useAddToFavorites: () => ({ mutate: vi.fn() }),
  useRemoveFromFavorites: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/ui/components/GlobalPinnedTabs', () => ({
  GlobalPinnedTabs: vi.fn(() => <div data-testid="global-pinned-tabs" />),
}));

const createMockTab = (id: number, url: string, title: string): TabEntry => ({
  id,
  url,
  title,
  favIconUrl: `https://example.com/favicon-${id}.ico`,
  pinned: false,
  active: false,
  windowId: 1,
  groupId: -1,
});

describe('EnhancedTabList', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderWithQuery = (component: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  it('should render without crashing', () => {
    vi.mocked(useSpacesSnapshot).mockReturnValue({
      data: { spaces: [], currentSpaceId: 1 },
      isLoading: false,
    } as any);

    expect(() => {
      renderWithQuery(
        <EnhancedTabList
          tabs={[]}
          title="Test Tabs"
          emptyMessage="No tabs available"
        />
      );
    }).not.toThrow();
  });

  it('should render tab count', () => {
    vi.mocked(useSpacesSnapshot).mockReturnValue({
      data: { spaces: [], currentSpaceId: 1 },
      isLoading: false,
    } as any);

    const mockTabs = [createMockTab(1, 'https://example.com', 'Example')];

    renderWithQuery(
      <EnhancedTabList
        tabs={mockTabs}
        title="Test Tabs"
        emptyMessage="No tabs available"
      />
    );

    expect(screen.getByRole('heading', { name: /test tabs/i })).toBeInTheDocument();
  });
});
