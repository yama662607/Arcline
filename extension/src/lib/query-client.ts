import { QueryClient } from '@tanstack/react-query';

// Lightweight query client configuration optimized for Chrome extension
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Chrome extension runs in isolated environment, use conservative defaults
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 5, // 5 minutes (formerly cacheTime in v4)
      retry: (failureCount, error) => {
        // Don't retry on Chrome extension errors
        if (error instanceof Error && error.message.includes('Extension')) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // Extension windows don't typically gain focus
      refetchOnReconnect: false, // Extension doesn't have network events like web pages
    },
    mutations: {
      retry: false, // Mutations should be immediate in extension context
    },
  },
});

// React Query keys for type safety
export const queryKeys = {
  spaces: ['spaces'] as const,
  spacesSnapshot: ['spaces', 'snapshot'] as const,
  settings: ['settings'] as const,
  archivedTabs: ['archivedTabs'] as const,
  bookmarks: (spaceId: number) => ['bookmarks', spaceId] as const,
  tabActivity: () => ['tabActivity'] as const,
  favorites: ['favorites'] as const,
  activeTab: ['activeTab'] as const,
} as const;
