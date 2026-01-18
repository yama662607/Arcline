import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TwoFingerMenu, type TwoFingerMenuContext } from './TwoFingerMenu';

// Mock ResizeObserver for Radix UI components
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.ResizeObserver = ResizeObserverMock;

// Mock hooks
vi.mock('@/hooks/use-spaces-query', () => ({
  useRemoveSpace: vi.fn(),
  useUpdateSpace: vi.fn(),
  useCreatePinnedFolder: vi.fn(),
}));

vi.mock('@/store', () => ({
  useSpacesStore: vi.fn(),
}));

import { useCreatePinnedFolder, useRemoveSpace, useUpdateSpace } from '@/hooks/use-spaces-query';
import { useSpacesStore } from '@/store';

describe('TwoFingerMenu', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(useRemoveSpace).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useRemoveSpace>);

    vi.mocked(useUpdateSpace).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useUpdateSpace>);

    vi.mocked(useCreatePinnedFolder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useCreatePinnedFolder>);

    vi.mocked(useSpacesStore).mockImplementation((selector) => {
      const state = {
        spaces: [
          {
            id: 1,
            name: 'Test Space',
            themeColor: 'blue',
            tabs: [],
            pinnedTabs: [],
            temporaryTabs: [],
            windowId: 1,
          },
          {
            id: 2,
            name: 'Other Space',
            themeColor: 'green',
            tabs: [],
            pinnedTabs: [],
            temporaryTabs: [],
            windowId: 1,
          },
        ],
        activeSpaceId: 1,
        setActiveSpace: vi.fn(),
      };
      return selector(state as unknown as Parameters<typeof selector>[0]);
    });
  });

  const renderWithQuery = (component: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  const mockSpaceContext: TwoFingerMenuContext = {
    type: 'space',
    space: {
      id: 1,
      name: 'Test Space',
      color: 'blue' as const,
      themeColor: 'blue',
      tabs: [],
      pinnedTabs: [],
      pinnedItems: [],
      temporaryTabs: [],
      windowId: 1,
      created_at: Date.now(),
      last_active_at: Date.now(),
    },
  };

  const mockTabContext: TwoFingerMenuContext = {
    type: 'tab',
    tab: {
      id: 1,
      title: 'Test Tab',
      url: 'https://example.com',
    },
  };

  describe('Space Context Menu', () => {
    it('should render space menu items when open', async () => {
      renderWithQuery(
        <TwoFingerMenu
          open={true}
          onOpenChange={vi.fn()}
          position={{ x: 100, y: 100 }}
          context={mockSpaceContext}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Rename Space...')).toBeInTheDocument();
      });
    });

    it('should show delete space option', async () => {
      renderWithQuery(
        <TwoFingerMenu
          open={true}
          onOpenChange={vi.fn()}
          position={{ x: 100, y: 100 }}
          context={mockSpaceContext}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Delete Space')).toBeInTheDocument();
      });
    });

    it('should show new folder option', async () => {
      renderWithQuery(
        <TwoFingerMenu
          open={true}
          onOpenChange={vi.fn()}
          position={{ x: 100, y: 100 }}
          context={mockSpaceContext}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('New Folder')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Context Menu', () => {
    it('should render tab menu items when open', async () => {
      renderWithQuery(
        <TwoFingerMenu
          open={true}
          onOpenChange={vi.fn()}
          position={{ x: 100, y: 100 }}
          context={mockTabContext}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Copy Link')).toBeInTheDocument();
      });
    });
  });

  describe('Empty Context Menu', () => {
    it('should render space menu for empty context', async () => {
      const emptyContext: TwoFingerMenuContext = {
        type: 'empty',
        space: {
          id: 1,
          name: 'Test Space',
          color: 'blue' as const,
          themeColor: 'blue',
          tabs: [],
          pinnedTabs: [],
          pinnedItems: [],
          temporaryTabs: [],
          windowId: 1,
          created_at: Date.now(),
          last_active_at: Date.now(),
        },
      };

      renderWithQuery(
        <TwoFingerMenu
          open={true}
          onOpenChange={vi.fn()}
          position={{ x: 100, y: 100 }}
          context={emptyContext}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Rename Space...')).toBeInTheDocument();
      });
    });
  });

  describe('Menu State', () => {
    it('should not render when open is false', () => {
      renderWithQuery(
        <TwoFingerMenu
          open={false}
          onOpenChange={vi.fn()}
          position={{ x: 100, y: 100 }}
          context={mockSpaceContext}
        />
      );

      expect(screen.queryByText('Rename Space...')).not.toBeInTheDocument();
    });
  });
});
