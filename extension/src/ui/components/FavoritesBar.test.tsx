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

    expect(screen.getByText('Drag frequently used tabs here')).toBeInTheDocument();
  });

  it('should render favorite tabs', () => {
    renderWithQueryClient(<FavoritesBar pinnedTabs={mockTabs} />);

    // Check favicons (excluding remove buttons)
    const favicons = screen
      .getAllByRole('button')
      .filter((button) => !button.getAttribute('title')?.includes('Remove from favorites'));
    expect(favicons).toHaveLength(2);
  });

  it('should show tab title on hover', () => {
    renderWithQueryClient(<FavoritesBar pinnedTabs={mockTabs} />);

    const favicons = screen
      .getAllByRole('button')
      .filter((button) => !button.getAttribute('title')?.includes('Remove from favorites'));
    expect(favicons[0]).toHaveAttribute('title', 'Example\nhttps://example.com');
  });

  it('should handle remove button click', () => {
    renderWithQueryClient(<FavoritesBar pinnedTabs={mockTabs} />);

    // Note: In real interaction, hovering shows the button.
    const removeButtons = screen.getAllByTitle('Remove from favorites');
    const firstRemoveButton = removeButtons[0];
    if (!firstRemoveButton) return;
    fireEvent.click(firstRemoveButton);
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
