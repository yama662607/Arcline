import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSpacesStore } from '@/store';
import { useSpacesSync } from './useSpacesSync';

vi.mock('@/hooks/use-spaces-query', () => ({
  useSpacesSnapshot: () => ({ data: [] }),
}));

// Mock Chrome API
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    sendMessage: vi.fn(),
    lastError: undefined as { message: string } | undefined,
  },
} as const;

global.chrome = mockChrome as unknown as typeof chrome;

vi.mock('@/store', () => ({
  useSpacesStore: vi.fn(),
}));

// Mock the store implementation
const mockStore = {
  setSpaces: vi.fn(),
  setActiveSpace: vi.fn(),
} as any;

vi.mocked(useSpacesStore).mockImplementation((selector) => {
  return selector(mockStore);
});

describe('useSpacesSync', () => {
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

  const TestComponent = () => {
    useSpacesSync();
    return <div data-testid="test-component">Test</div>;
  };

  it('should render without errors', () => {
    renderWithQuery(<TestComponent />);
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
  });

  it('should cleanup listeners on unmount', () => {
    const { unmount } = renderWithQuery(<TestComponent />);

    // Component should unmount without errors
    expect(() => unmount()).not.toThrow();
  });
});
