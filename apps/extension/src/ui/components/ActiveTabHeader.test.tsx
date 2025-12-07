import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveTabHeader } from './ActiveTabHeader';

// Mock hooks
vi.mock('@/hooks/use-spaces-query', () => ({
  useActiveTab: vi.fn(),
  useReloadActiveTab: vi.fn(),
}));

import { useActiveTab, useReloadActiveTab } from '@/hooks/use-spaces-query';

describe('ActiveTabHeader', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  const renderWithQuery = (component: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  it('should render with active tab data', () => {
    const mockRefetch = vi.fn();
    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example Page',
        url: 'https://example.com/page',
        favIconUrl: 'https://example.com/favicon.ico',
        pinned: false,
        active: true,
        windowId: 1,
        groupId: -1,
      },
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    expect(screen.getByText('Current Tab')).toBeInTheDocument();
    expect(screen.getByText('Example Page')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload current tab' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy current tab URL' })).toBeInTheDocument();
  });

  it('should show no active tab message when no tab is active', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: undefined,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    expect(screen.getByText('No active tab detected')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('should show loading state when fetching', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example Page',
        url: 'https://example.com/page',
        favIconUrl: 'https://example.com/favicon.ico',
        pinned: false,
        active: true,
        windowId: 1,
        groupId: -1,
      },
      isFetching: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    expect(screen.getByText('Loading URL…')).toBeInTheDocument();
  });

  it('should handle copy URL button click', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });

    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example Page',
        url: 'https://example.com/page',
        favIconUrl: 'https://example.com/favicon.ico',
        pinned: false,
        active: true,
        windowId: 1,
        groupId: -1,
      },
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const copyButton = screen.getByRole('button', { name: 'Copy current tab URL' });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('https://example.com/page');
    });

    expect(screen.getByText('Copied')).toBeInTheDocument();

    // Wait for the copied state to reset
    await waitFor(
      () => {
        expect(screen.getByText('Copy URL')).toBeInTheDocument();
      },
      { timeout: 1500 }
    );
  });

  it('should handle copy URL failure gracefully', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockWriteText = vi.fn().mockRejectedValue(new Error('Clipboard error'));
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });

    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example Page',
        url: 'https://example.com/page',
        favIconUrl: 'https://example.com/favicon.ico',
        pinned: false,
        active: true,
        windowId: 1,
        groupId: -1,
      },
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const copyButton = screen.getByRole('button', { name: 'Copy current tab URL' });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('https://example.com/page');
    });

    expect(consoleWarn).toHaveBeenCalledWith(
      '[Arcline] Failed to copy URL',
      expect.any(Error)
    );

    consoleWarn.mockRestore();
  });

  it('should handle reload button click', async () => {
    const mockReload = vi.fn().mockResolvedValue(undefined);
    const mockRefetch = vi.fn();

    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example Page',
        url: 'https://example.com/page',
        favIconUrl: 'https://example.com/favicon.ico',
        pinned: false,
        active: true,
        windowId: 1,
        groupId: -1,
      },
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: mockReload,
      isPending: false,
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const reloadButton = screen.getByRole('button', { name: 'Reload current tab' });
    fireEvent.click(reloadButton);

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalledWith(1);
    });

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('should handle reload failure gracefully', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockReload = vi.fn().mockRejectedValue(new Error('Reload error'));
    const mockRefetch = vi.fn();

    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example Page',
        url: 'https://example.com/page',
        favIconUrl: 'https://example.com/favicon.ico',
        pinned: false,
        active: true,
        windowId: 1,
        groupId: -1,
      },
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: mockReload,
      isPending: false,
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const reloadButton = screen.getByRole('button', { name: 'Reload current tab' });
    fireEvent.click(reloadButton);

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalledWith(1);
    });

    expect(consoleWarn).toHaveBeenCalledWith(
      '[Arcline] Failed to reload tab',
      expect.any(Error)
    );

    consoleWarn.mockRestore();
  });

  it('should handle refresh button click', () => {
    const mockRefetch = vi.fn();

    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example Page',
        url: 'https://example.com/page',
        favIconUrl: 'https://example.com/favicon.ico',
        pinned: false,
        active: true,
        windowId: 1,
        groupId: -1,
      },
      isFetching: false,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const refreshButton = screen.getByRole('button', { name: 'Refresh' });
    fireEvent.click(refreshButton);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('should disable copy button when no URL available', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example Page',
        url: undefined,
        favIconUrl: 'https://example.com/favicon.ico',
        pinned: false,
        active: true,
        windowId: 1,
        groupId: -1,
      },
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const copyButton = screen.getByRole('button', { name: 'Copy current tab URL' });
    expect(copyButton).toBeDisabled();
  });

  it('should disable reload button when no tab ID available', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: undefined,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const reloadButton = screen.getByRole('button', { name: 'Reload current tab' });
    expect(reloadButton).toBeDisabled();
  });

  it('should disable reload button when reload is in progress', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example Page',
        url: 'https://example.com/page',
        favIconUrl: 'https://example.com/favicon.ico',
        pinned: false,
        active: true,
        windowId: 1,
        groupId: -1,
      },
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const reloadButton = screen.getByRole('button', { name: 'Reload current tab' });
    expect(reloadButton).toBeDisabled();
  });

  it('should format display URL correctly', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example Page',
        url: 'https://example.com/page/',
        favIconUrl: 'https://example.com/favicon.ico',
        pinned: false,
        active: true,
        windowId: 1,
        groupId: -1,
      },
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    // Should remove trailing slash
    expect(screen.getByText('https://example.com/page')).toBeInTheDocument();
  });

  it('should handle invalid URL gracefully', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example Page',
        url: 'not-a-valid-url',
        favIconUrl: 'https://example.com/favicon.ico',
        pinned: false,
        active: true,
        windowId: 1,
        groupId: -1,
      },
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    // Should display the invalid URL as-is
    expect(screen.getByText('not-a-valid-url')).toBeInTheDocument();
  });
});
