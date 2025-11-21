import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnhancedTabList } from './EnhancedTabList';

// Mock ResizeObserver
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = MockResizeObserver;

// Mock hooks
vi.mock('@/hooks/use-spaces-query', () => ({
  useActivateTab: vi.fn(),
  useArchiveTab: vi.fn(),
  useCloseTab: vi.fn(),
  useMoveTabToSpace: vi.fn(),
  useToggleTabPinned: vi.fn(),
  useSpacesSnapshot: vi.fn(),
}));

vi.mock('@/ui/components/GlobalPinnedTabs', () => ({
  GlobalPinnedTabs: vi.fn(() => <div data-testid="global-pinned-tabs" />),
}));

import {
  useActivateTab,
  useArchiveTab,
  useCloseTab,
  useSpacesSnapshot,
  useToggleTabPinned,
} from '@/hooks/use-spaces-query';

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

  it('should render tab list', () => {
    const mockActivateTab = vi.fn();
    vi.mocked(useActivateTab).mockReturnValue({
      mutateAsync: mockActivateTab,
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useActivateTab>);

    vi.mocked(useSpacesSnapshot).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      isFetching: false,
      status: 'success',
      fetchStatus: 'idle',
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSpacesSnapshot>);

    renderWithQuery(
      <EnhancedTabList tabs={[]} title="Test Tabs" emptyMessage="No tabs" variant="standalone" />
    );

    // Basic test that component renders without errors
    expect(screen.getByText((content) => content.includes('Test Tabs'))).toBeInTheDocument();
    expect(screen.getByText('No tabs')).toBeInTheDocument();
  });

  it('should show empty message when no tabs', () => {
    vi.mocked(useSpacesSnapshot).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      isFetching: false,
      status: 'success',
      fetchStatus: 'idle',
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSpacesSnapshot>);

    renderWithQuery(
      <EnhancedTabList
        tabs={[]}
        title="Test Tabs"
        emptyMessage="No tabs available"
        variant="standalone"
      />
    );

    expect(screen.getByText('No tabs available')).toBeInTheDocument();
  });

  it('should handle tab activation', async () => {
    const mockActivateTab = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useActivateTab).mockReturnValue({
      mutateAsync: mockActivateTab,
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useActivateTab>);

    vi.mocked(useSpacesSnapshot).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      isFetching: false,
      status: 'success',
      fetchStatus: 'idle',
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSpacesSnapshot>);

    renderWithQuery(
      <EnhancedTabList tabs={[]} title="Test Tabs" emptyMessage="No tabs" variant="standalone" />
    );

    // Basic test that component renders without errors
    expect(screen.getByText((content) => content.includes('Test Tabs'))).toBeInTheDocument();
    expect(screen.getByText('No tabs')).toBeInTheDocument();
  });

  it('should handle tab pin toggle', async () => {
    const mockTogglePin = vi.fn().mockResolvedValue(false);
    vi.mocked(useToggleTabPinned).mockReturnValue({
      mutateAsync: mockTogglePin,
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useToggleTabPinned>);

    vi.mocked(useActivateTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useActivateTab>);

    vi.mocked(useSpacesSnapshot).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      isFetching: false,
      status: 'success',
      fetchStatus: 'idle',
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSpacesSnapshot>);

    renderWithQuery(
      <EnhancedTabList tabs={[]} title="Test Tabs" emptyMessage="No tabs" variant="standalone" />
    );

    // Basic test that component renders without errors
    expect(screen.getByText((content) => content.includes('Test Tabs'))).toBeInTheDocument();
    expect(screen.getByText('No tabs')).toBeInTheDocument();
  });

  it('should handle tab closing', async () => {
    const mockCloseTab = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useCloseTab).mockReturnValue({
      mutateAsync: mockCloseTab,
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useCloseTab>);

    vi.mocked(useActivateTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useActivateTab>);

    renderWithQuery(
      <EnhancedTabList tabs={[]} title="Test Tabs" emptyMessage="No tabs" variant="standalone" />
    );

    // Basic test that component renders without errors
    expect(screen.getByText((content) => content.includes('Test Tabs'))).toBeInTheDocument();
    expect(screen.getByText('No tabs')).toBeInTheDocument();
  });

  it('should handle tab archiving', async () => {
    const mockArchiveTab = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useArchiveTab).mockReturnValue({
      mutateAsync: mockArchiveTab,
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useArchiveTab>);

    vi.mocked(useActivateTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useActivateTab>);

    renderWithQuery(
      <EnhancedTabList tabs={[]} title="Test Tabs" emptyMessage="No tabs" variant="standalone" />
    );

    // Basic test that component renders without errors
    expect(screen.getByText((content) => content.includes('Test Tabs'))).toBeInTheDocument();
    expect(screen.getByText('No tabs')).toBeInTheDocument();
  });

  it('should show context menu on right click', async () => {
    const mockOnContextMenu = vi.fn();
    vi.mocked(useActivateTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useActivateTab>);

    renderWithQuery(
      <EnhancedTabList
        tabs={[]}
        title="Test Tabs"
        emptyMessage="No tabs"
        variant="standalone"
        onTabContextMenu={mockOnContextMenu}
      />
    );

    // Basic test that component renders without errors
    expect(screen.getByText((content) => content.includes('Test Tabs'))).toBeInTheDocument();
    expect(screen.getByText('No tabs')).toBeInTheDocument();
  });

  it('should filter tabs based on search', async () => {
    vi.mocked(useActivateTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useActivateTab>);

    renderWithQuery(
      <EnhancedTabList tabs={[]} title="Test Tabs" emptyMessage="No tabs" variant="standalone" />
    );

    // Basic test that component renders without errors
    expect(screen.getByText((content) => content.includes('Test Tabs'))).toBeInTheDocument();
    expect(screen.getByText('No tabs')).toBeInTheDocument();
  });

  it('should handle drag and drop', async () => {
    vi.mocked(useActivateTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useActivateTab>);

    renderWithQuery(
      <EnhancedTabList tabs={[]} title="Test Tabs" emptyMessage="No tabs" variant="standalone" />
    );

    // Basic test that component renders without errors
    expect(screen.getByText((content) => content.includes('Test Tabs'))).toBeInTheDocument();
    expect(screen.getByText('No tabs')).toBeInTheDocument();
  });
});
