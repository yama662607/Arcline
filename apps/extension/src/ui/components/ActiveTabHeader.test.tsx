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

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn(),
  },
  configurable: true,
});

describe('ActiveTabHeader', () => {
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

  it('should render active tab information', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example Site',
        url: 'https://example.com',
        pinned: false,
        active: true,
        favIconUrl: '',
      },
      isFetching: false,
      refetch: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      status: 'success',
      fetchStatus: 'idle',
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    expect(screen.getByText('Example Site')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('should show "No active tab detected" when no active tab', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: null,
      isFetching: false,
      refetch: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      status: 'success',
      fetchStatus: 'idle',
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    expect(screen.getByText('No active tab detected')).toBeInTheDocument();
  });

  it('should show loading state when fetching', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example',
        url: 'https://example.com',
        pinned: false,
        active: true,
        favIconUrl: '',
      },
      isFetching: true,
      refetch: vi.fn(),
      isLoading: true,
      error: null,
      isSuccess: false,
      isError: false,
      isPending: true,
      status: 'pending',
      fetchStatus: 'fetching',
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    expect(screen.getByText('Loading URL…')).toBeInTheDocument();
  });

  it('should copy URL to clipboard when copy button is clicked', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    navigator.clipboard.writeText = mockWriteText;

    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example',
        url: 'https://example.com',
        pinned: false,
        active: true,
        favIconUrl: '',
      },
      isFetching: false,
      refetch: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      status: 'success',
      fetchStatus: 'idle',
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const copyButton = screen.getByLabelText('Copy current tab URL');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('https://example.com');
    });

    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('should handle copy error gracefully', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockWriteText = vi.fn().mockRejectedValue(new Error('Copy failed'));
    navigator.clipboard.writeText = mockWriteText;

    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example',
        url: 'https://example.com',
        pinned: false,
        active: true,
        favIconUrl: '',
      },
      isFetching: false,
      refetch: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      status: 'success',
      fetchStatus: 'idle',
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const copyButton = screen.getByLabelText('Copy current tab URL');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Arcline] Failed to copy URL',
        expect.any(Error)
      );
    });

    consoleWarnSpy.mockRestore();
  });

  it('should reload tab when reload button is clicked', async () => {
    const mockReload = vi.fn().mockResolvedValue(undefined);
    const mockRefetch = vi.fn();

    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example',
        url: 'https://example.com',
        pinned: false,
        active: true,
        favIconUrl: '',
      },
      isFetching: false,
      refetch: mockRefetch,
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      status: 'success',
      fetchStatus: 'idle',
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: mockReload,
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const reloadButton = screen.getByLabelText('Reload current tab');
    fireEvent.click(reloadButton);

    await waitFor(() => {
      expect(mockReload).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('should handle reload error gracefully', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockReload = vi.fn().mockRejectedValue(new Error('Reload failed'));
    const mockRefetch = vi.fn();

    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example',
        url: 'https://example.com',
        pinned: false,
        active: true,
        favIconUrl: '',
      },
      isFetching: false,
      refetch: mockRefetch,
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      status: 'success',
      fetchStatus: 'idle',
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: mockReload,
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const reloadButton = screen.getByLabelText('Reload current tab');
    fireEvent.click(reloadButton);

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Arcline] Failed to reload tab',
        expect.any(Error)
      );
    });

    consoleWarnSpy.mockRestore();
  });

  it('should disable reload button when no active tab', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: null,
      isFetching: false,
      refetch: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      status: 'success',
      fetchStatus: 'idle',
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const reloadButton = screen.getByLabelText('Reload current tab');
    expect(reloadButton).toBeDisabled();
  });

  it('should disable reload button when reloading', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example',
        url: 'https://example.com',
        pinned: false,
        active: true,
        favIconUrl: '',
      },
      isFetching: false,
      refetch: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      status: 'success',
      fetchStatus: 'idle',
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
      isSuccess: false,
      isError: false,
      status: 'pending',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const reloadButton = screen.getByLabelText('Reload current tab');
    expect(reloadButton).toBeDisabled();
  });

  it('should disable copy button when no URL', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example',
        url: undefined,
        pinned: false,
        active: true,
        favIconUrl: '',
      },
      isFetching: false,
      refetch: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      status: 'success',
      fetchStatus: 'idle',
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const copyButton = screen.getByLabelText('Copy current tab URL');
    expect(copyButton).toBeDisabled();
  });

  it('should remove trailing slash from URL', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example',
        url: 'https://example.com/',
        pinned: false,
        active: true,
        favIconUrl: '',
      },
      isFetching: false,
      refetch: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      status: 'success',
      fetchStatus: 'idle',
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('should handle invalid URL gracefully', () => {
    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example',
        url: 'not-a-valid-url',
        pinned: false,
        active: true,
        favIconUrl: '',
      },
      isFetching: false,
      refetch: vi.fn(),
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      status: 'success',
      fetchStatus: 'idle',
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    expect(screen.getByText('not-a-valid-url')).toBeInTheDocument();
  });

  it('should call refetch when refresh button is clicked', () => {
    const mockRefetch = vi.fn();

    vi.mocked(useActiveTab).mockReturnValue({
      data: {
        id: 1,
        title: 'Example',
        url: 'https://example.com',
        pinned: false,
        active: true,
        favIconUrl: '',
      },
      isFetching: false,
      refetch: mockRefetch,
      isLoading: false,
      error: null,
      isSuccess: true,
      isError: false,
      isPending: false,
      status: 'success',
      fetchStatus: 'idle',
    } as unknown as ReturnType<typeof useActiveTab>);

    vi.mocked(useReloadActiveTab).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      status: 'idle',
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useReloadActiveTab>);

    renderWithQuery(<ActiveTabHeader />);

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    expect(mockRefetch).toHaveBeenCalled();
  });
});
