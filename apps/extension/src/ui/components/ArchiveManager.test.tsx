import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useArchivedTabs, useRestoreArchivedTab } from '@/hooks/use-spaces-query';
import { ArchiveManager } from './ArchiveManager';

// Mock hooks
vi.mock('@/hooks/use-spaces-query', () => ({
  useArchivedTabs: vi.fn(),
  useRestoreArchivedTab: vi.fn(),
}));

const mockArchivedTabs = [
  {
    id: '1',
    title: 'Tab 1',
    url: 'https://example.com/1',
    spaceName: 'Space A',
    spaceId: 1,
    archivedAt: 1678886400000,
    originalTabId: 1,
  },
  {
    id: '2',
    title: 'Tab 2',
    url: 'https://example.com/2',
    spaceName: 'Space B',
    spaceId: 2,
    archivedAt: 1678800000000,
    originalTabId: 2,
  },
];

describe('ArchiveManager', () => {
  let queryClient: QueryClient;
  const mutateAsyncMock = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();

    vi.mocked(useArchivedTabs).mockReturnValue({
      data: mockArchivedTabs,
      isLoading: false,
    } as any);

    vi.mocked(useRestoreArchivedTab).mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as any);
  });

  const renderComponent = (variant: 'standalone' | 'floating' = 'standalone') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ArchiveManager variant={variant} />
      </QueryClientProvider>
    );
  };

  it('renders empty state when no tabs', () => {
    vi.mocked(useArchivedTabs).mockReturnValue({ data: [] } as any);
    renderComponent();
    expect(screen.getByText(/No archived tabs/)).toBeInTheDocument();
  });

  it('renders list of archived tabs (standalone)', () => {
    renderComponent();
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
    expect(screen.getByText('Archive (2)')).toBeInTheDocument();
  });

  it('filters tabs by search query', async () => {
    const user = userEvent.setup();
    renderComponent();

    const input = screen.getByPlaceholderText(/Search archived tabs/);
    await user.type(input, 'Tab 1');

    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.queryByText('Tab 2')).not.toBeInTheDocument();
  });

  it('triggers restore mutation', async () => {
    const user = userEvent.setup();
    renderComponent();

    const restoreButtons = screen.getAllByRole('button', { name: 'Restore' });
    expect(restoreButtons.length).toBeGreaterThan(0);
    const firstBtn = restoreButtons[0];
    if (firstBtn) {
      await user.click(firstBtn);
      expect(mutateAsyncMock).toHaveBeenCalledWith(mockArchivedTabs[0]);
    }
  });

  it('opens details modal and restores from there', async () => {
    const user = userEvent.setup();
    renderComponent();

    const detailsButtons = screen.getAllByRole('button', { name: 'Details' });
    expect(detailsButtons.length).toBeGreaterThan(0);
    const firstDetailsBtn = detailsButtons[0];
    if (firstDetailsBtn) {
      await user.click(firstDetailsBtn);
    }

    expect(screen.getByText('Archived Tab Details')).toBeInTheDocument();
    // Use regex for safer matching
    // Use simpler regex for matching domain/path part
    // Use getAllByText because the URL exists in the background list AND the modal
    expect(screen.getAllByText(/example\.com\/1/).length).toBeGreaterThan(0);

    // Click Restore in modal
    const modalRestoreBtn = screen.getByRole('button', { name: 'Restore Tab' });
    await user.click(modalRestoreBtn);

    // Use assertion that accounts for potentially undefined mock access (though we know it exists)
    const targetTab = mockArchivedTabs[0];
    if (targetTab) {
      expect(mutateAsyncMock).toHaveBeenCalledWith(targetTab);
    }
  });

  it('renders list of archived tabs (floating)', () => {
    renderComponent('floating');
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText(/Space A/)).toBeInTheDocument();
    // Date formatting varies by locale, so strict check is brittle
  });
});
