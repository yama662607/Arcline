import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpaceManager } from './SpaceManager';

// Mock hooks
vi.mock('@/hooks/use-spaces-query', () => ({
  useSpacesSnapshot: vi.fn(),
  useCreateSpace: vi.fn(),
  useRemoveSpace: vi.fn(),
}));

vi.mock('@/store', () => ({
  useSpacesStore: vi.fn(),
}));

vi.mock('@/ui/components/context-menu/SpaceContextMenu', () => ({
  SpaceContextMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="space-context-menu">{children}</div>
  ),
}));

import { useCreateSpace, useRemoveSpace, useSpacesSnapshot } from '@/hooks/use-spaces-query';
import { useSpacesStore } from '@/store';

describe('SpaceManager', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderWithQuery = (component: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  it('should render space list', async () => {
    const mockSpaces = [
      {
        id: 1,
        name: 'Work',
        color: 'blue' as const,
        tabs: [],
        pinnedTabs: [],
        temporaryTabs: [],
        windowId: 1,
        created_at: Date.now(),
        last_active_at: Date.now(),
      },
      {
        id: 2,
        name: 'Personal',
        color: 'green' as const,
        tabs: [],
        pinnedTabs: [],
        temporaryTabs: [],
        windowId: 1,
        created_at: Date.now(),
        last_active_at: Date.now(),
      },
    ];

    vi.mocked(useSpacesSnapshot).mockReturnValue({
      data: mockSpaces,
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

    vi.mocked(useSpacesStore).mockReturnValue({
      setActiveSpace: vi.fn(),
    });

    renderWithQuery(<SpaceManager />);

    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    vi.mocked(useSpacesSnapshot).mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
      isSuccess: false,
      isError: false,
      isPending: true,
      isFetching: true,
      status: 'pending',
      fetchStatus: 'fetching',
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useSpacesSnapshot>);

    renderWithQuery(<SpaceManager />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should handle space creation', async () => {
    const mockCreateSpace = vi.fn().mockResolvedValue({ id: 3 });
    vi.mocked(useCreateSpace).mockReturnValue({
      mutateAsync: mockCreateSpace,
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useCreateSpace>);

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

    vi.mocked(useSpacesStore).mockReturnValue({
      setActiveSpace: vi.fn(),
    });

    renderWithQuery(<SpaceManager />);

    const createButton = screen.getByText('Create Space');
    fireEvent.click(createButton);

    const nameInput = screen.getByPlaceholderText('Space name');
    fireEvent.change(nameInput, { target: { value: 'New Space' } });

    const submitButton = screen.getAllByRole('button', { name: /Create/i })[1];
    if (submitButton) {
      fireEvent.click(submitButton);
    }

    await waitFor(() => {
      expect(mockCreateSpace).toHaveBeenCalledWith({
        name: 'New Space',
        color: 'blue',
      });
    });
  });

  it('should handle space removal', async () => {
    const mockSpaces = [
      {
        id: 1,
        name: 'Work',
        color: 'blue' as const,
        tabs: [],
        pinnedTabs: [],
        temporaryTabs: [],
        windowId: 1,
        created_at: Date.now(),
        last_active_at: Date.now(),
      },
      {
        id: 2,
        name: 'Personal',
        color: 'green' as const,
        tabs: [],
        pinnedTabs: [],
        temporaryTabs: [],
        windowId: 1,
        created_at: Date.now(),
        last_active_at: Date.now(),
      },
    ];

    const mockRemoveSpace = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useRemoveSpace).mockReturnValue({
      mutateAsync: mockRemoveSpace,
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useRemoveSpace>);

    vi.mocked(useSpacesSnapshot).mockReturnValue({
      data: mockSpaces,
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

    const mockSetActiveSpace = vi.fn();
    vi.mocked(useSpacesStore).mockReturnValue({
      setActiveSpace: mockSetActiveSpace,
    });

    renderWithQuery(<SpaceManager />);

    const removeButton = screen.getAllByLabelText('Remove space')[0];
    if (removeButton) {
      fireEvent.click(removeButton);
    }

    await waitFor(() => {
      expect(mockRemoveSpace).toHaveBeenCalledWith(1);
    });
  });

  it('should not allow removing last space', () => {
    const mockSpaces = [
      {
        id: 1,
        name: 'Work',
        color: 'blue' as const,
        tabs: [],
        pinnedTabs: [],
        temporaryTabs: [],
        windowId: 1,
        created_at: Date.now(),
        last_active_at: Date.now(),
      },
    ];

    vi.mocked(useSpacesSnapshot).mockReturnValue({
      data: mockSpaces,
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

    renderWithQuery(<SpaceManager />);

    const removeButton = screen.queryByLabelText('Remove space');
    expect(removeButton).toBeNull();
  });
});
