import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TabEntry } from '@/shared/types';
import { FavoritesBar } from './FavoritesBar';

// Mock hooks
vi.mock('@/hooks/use-spaces-query', () => ({
  useActivateTab: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
  useAddToFavorites: vi.fn(() => ({ mutate: vi.fn() })),
  useRemoveFromFavorites: vi.fn(() => ({ mutate: vi.fn() })),
  useToggleTabPinned: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn() })),
  useCloseTab: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useFavorites: vi.fn(() => ({ data: [] })),
  useToggleFavorite: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useMoveTabToSpace: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

// Mock Store
vi.mock('@/store', () => ({
  useSpacesStore: vi.fn((selector) => selector({ spaces: [] })),
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

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
};

describe('FavoritesBar', () => {
  const mockTabs = [
    createMockTab(1, 'https://example.com', 'Example'),
    createMockTab(2, 'https://github.com', 'GitHub'),
  ];

  it('should render empty state when no favorites', () => {
    renderWithQueryClient(<FavoritesBar pinnedTabs={[]} />);

    expect(screen.getByText('Favorites')).toBeInTheDocument();
    expect(screen.getByText('Drag to add Favorites')).toBeInTheDocument();
  });

  it('should render favorite tabs', () => {
    renderWithQueryClient(<FavoritesBar pinnedTabs={mockTabs} />);

    expect(screen.getByText('Favorites')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Check favicons (excluding remove buttons)
    const favicons = screen
      .getAllByRole('button')
      .filter((button) => !button.getAttribute('title')?.includes('お気に入りから削除'));
    expect(favicons).toHaveLength(2);
  });

  it('should show tab title on hover', () => {
    renderWithQueryClient(<FavoritesBar pinnedTabs={mockTabs} />);

    const favicons = screen
      .getAllByRole('button')
      .filter((button) => !button.getAttribute('title')?.includes('お気に入りから削除'));
    expect(favicons[0]).toHaveAttribute('title', 'Example\nhttps://example.com');
  });

  it('should handle remove button click', () => {
    renderWithQueryClient(<FavoritesBar pinnedTabs={mockTabs} />);

    // Hover to show remove button
    const favicons = screen.getAllByRole('button');
    const firstFavicon = favicons[0];
    if (!firstFavicon) return;
    fireEvent.mouseEnter(firstFavicon);

    // Find and click remove button (using Japanese title)
    // Note: In real interaction, hovering shows the button.
    // In JSDOM, we might need to rely on the fact it's in the DOM but opacity 0.
    const removeButtons = screen.getAllByTitle('お気に入りから削除');
    const firstRemoveButton = removeButtons[0];
    if (!firstRemoveButton) return;
    fireEvent.click(firstRemoveButton);
  });

  it('should handle drag and drop', async () => {
    renderWithQueryClient(<FavoritesBar pinnedTabs={mockTabs} />);

    const dropZone = screen.getByText('Favorites').parentElement;
    if (!dropZone) return;

    // Simulate drag over
    fireEvent.dragOver(dropZone);

    // Simulate drop
    const tabData = JSON.stringify(mockTabs[0]);
    fireEvent.drop(dropZone, {
      dataTransfer: {
        getData: vi.fn().mockReturnValue(tabData),
      },
    });

    // Should not show drag over state after drop
    expect(dropZone).not.toHaveClass('drag-over');
  });

  it('should handle keyboard navigation', () => {
    renderWithQueryClient(<FavoritesBar pinnedTabs={mockTabs} />);

    const favicons = screen.getAllByRole('button');
    const firstFavicon = favicons[0];
    if (!firstFavicon) return;

    // Enter key should activate tab
    fireEvent.keyDown(firstFavicon, { key: 'Enter' });

    // Space key should activate tab
    fireEvent.keyDown(firstFavicon, { key: ' ' });
  });
});
