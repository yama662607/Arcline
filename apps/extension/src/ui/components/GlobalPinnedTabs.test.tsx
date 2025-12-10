import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useActivateTab,
  useRemoveFromFavorites,
  useToggleTabPinned,
} from '@/hooks/use-spaces-query';
import { getDragData } from '@/ui/hooks/use-tab-drag-drop';
import { GlobalPinnedTabs } from './GlobalPinnedTabs';

// Mock Hooks
vi.mock('@/hooks/use-spaces-query', () => ({
  useActivateTab: vi.fn(),
  useRemoveFromFavorites: vi.fn(),
  useToggleTabPinned: vi.fn(),
}));

// Mock Drag Drop Helper
vi.mock('@/ui/hooks/use-tab-drag-drop', () => ({
  getDragData: vi.fn(),
  setDragData: vi.fn(),
}));

const mockTabs = [
  {
    id: 1,
    title: 'Pinned Tab 1',
    url: 'https://example.com/1',
    pinned: true,
    active: false,
    windowId: 1,
    groupId: -1,
    favIconUrl: '',
  },
];

describe('GlobalPinnedTabs', () => {
  const activateTabMock = vi.fn();
  const togglePinMock = vi.fn();
  const removeFromFavoritesMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useActivateTab).mockReturnValue({ mutate: activateTabMock } as any);
    vi.mocked(useToggleTabPinned).mockReturnValue({ mutate: togglePinMock } as any);
    vi.mocked(useRemoveFromFavorites).mockReturnValue({ mutate: removeFromFavoritesMock } as any);
  });

  const renderComponent = (props: any = {}) => {
    return render(
      <GlobalPinnedTabs
        tabs={mockTabs}
        compact={false}
        showFavicons={true}
        variant="standalone"
        {...props}
      />
    );
  };

  it('renders list of pinned tabs', () => {
    renderComponent();
    expect(screen.getByText('Pinned Tab 1')).toBeInTheDocument();
    expect(screen.getByText('グローバルピン留めタブ')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    renderComponent({ tabs: [] });
    expect(screen.getByText(/ドラッグしてピン留め/)).toBeInTheDocument();
  });

  it('activates tab on click', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByText('Pinned Tab 1'));
    expect(activateTabMock).toHaveBeenCalledWith(1);
  });

  it('unpins tab on button click', async () => {
    const user = userEvent.setup();
    renderComponent();

    // PinOff icon button usually has title 'ピン留めを解除'
    const unpinButton = screen.getByTitle('ピン留めを解除');
    await user.click(unpinButton);

    expect(togglePinMock).toHaveBeenCalledWith({ tabId: 1, pinned: false });
  });

  it('handles drop to pin tab', () => {
    renderComponent();
    const dropZone = screen.getByRole('region', { name: /Pinned tabs drop zone/ });

    // Mock drag data
    vi.mocked(getDragData).mockReturnValue({
      item: { id: 99, title: 'New Tab', url: 'http://new.com', pinned: false } as any,
      source: 'temporary',
    });

    const dropEvent = createEvent.drop(dropZone);
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { dropEffect: 'move' },
    });

    fireEvent(dropZone, dropEvent);

    expect(togglePinMock).toHaveBeenCalledWith({ tabId: 99, pinned: true });
  });

  it('handles drop from favorites (removes from favs + pins)', () => {
    renderComponent();
    const dropZone = screen.getByRole('region', { name: /Pinned tabs drop zone/ });

    vi.mocked(getDragData).mockReturnValue({
      item: { id: 88, title: 'Fav Tab', url: 'http://fav.com', pinned: false } as any,
      source: 'favorite',
    });

    const dropEvent = createEvent.drop(dropZone);
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { dropEffect: 'move' },
    });

    fireEvent(dropZone, dropEvent);

    expect(togglePinMock).toHaveBeenCalledWith({ tabId: 88, pinned: true }); // Pin
    expect(removeFromFavoritesMock).toHaveBeenCalledWith('http://fav.com'); // Remove from Fav
  });

  it('ignores drop from pinned (same source)', () => {
    renderComponent();
    const dropZone = screen.getByRole('region', { name: /Pinned tabs drop zone/ });

    vi.mocked(getDragData).mockReturnValue({
      item: { id: 1, pinned: true } as any,
      source: 'pinned',
    });

    fireEvent.drop(dropZone);

    expect(togglePinMock).not.toHaveBeenCalled();
  });
});
