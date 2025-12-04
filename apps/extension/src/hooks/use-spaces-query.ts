import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServiceWorkerBridge } from '@/hooks/use-service-worker-bridge';
import { queryKeys } from '@/lib/query-client';
import type { ArchivedTab, Settings, SpaceCreateRequest } from '@/shared/types';

// Query hooks
export function useSpacesSnapshot() {
  const bridge = useServiceWorkerBridge();

  return useQuery({
    queryKey: queryKeys.spacesSnapshot,
    queryFn: () => bridge?.getSpacesSnapshot(),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // 1 minute
    retry: 3, // タブ移動時の一時的な通信エラーに対応
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 3000),
  });
}

export function useSettings() {
  const bridge = useServiceWorkerBridge();

  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => bridge?.getSettings(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useArchivedTabs() {
  const bridge = useServiceWorkerBridge();

  return useQuery({
    queryKey: queryKeys.archivedTabs,
    queryFn: () => bridge?.getArchivedTabs(),
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useBookmarksForSpace(spaceId: number) {
  const bridge = useServiceWorkerBridge();

  return useQuery({
    queryKey: queryKeys.bookmarks(spaceId),
    queryFn: () => bridge?.getBookmarksForSpace(spaceId),
    enabled: !!spaceId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Mutation hooks
export function useToggleTabPinned() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, { tabId: number; pinned?: boolean }>({
    mutationFn: async ({ tabId, pinned }: { tabId: number; pinned?: boolean }) => {
      if (!bridge) throw new Error('Service Worker bridge not available');
      return await bridge.toggleTabPinned(tabId, pinned);
    },
    onSuccess: () => {
      // Invalidate spaces snapshot to refresh UI
      queryClient.invalidateQueries({ queryKey: queryKeys.spacesSnapshot });
    },
  });
}

export function useMoveTabToSpace() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();

  return useMutation<void, Error, { tabId: number; spaceId: number }>({
    mutationFn: async ({ tabId, spaceId }: { tabId: number; spaceId: number }) => {
      if (!bridge) throw new Error('Service Worker bridge not available');
      await bridge.moveTabToSpace(tabId, spaceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spacesSnapshot });
    },
  });
}

export function useCreateSpace() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();

  return useMutation<void, Error, SpaceCreateRequest>({
    mutationFn: async ({ name, color }: SpaceCreateRequest) => {
      if (!bridge) throw new Error('Service Worker bridge not available');
      await bridge.createSpace(name, color);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spacesSnapshot });
    },
  });
}

export function useRemoveSpace() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (spaceId: number) => {
      if (!bridge) throw new Error('Service Worker bridge not available');
      await bridge.removeSpace(spaceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spacesSnapshot });
    },
  });
}

export function useCloseTab() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (tabId: number) => {
      if (!bridge) throw new Error('Service Worker bridge not available');
      await bridge.closeTab(tabId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spacesSnapshot });
    },
  });
}

export function useActivateTab() {
  const bridge = useServiceWorkerBridge();

  return useMutation<void, Error, number>({
    mutationFn: async (tabId: number) => {
      const isAtlas = /\bAtlas\b/i.test(navigator.userAgent);
      console.log('[Arcline] 🎯 useActivateTab mutation called:', {
        tabId,
        isAtlas,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });

      if (!bridge) {
        console.error('[Arcline] ❌ Service Worker bridge not available:', {
          tabId,
          isAtlas,
        });
        throw new Error('Service Worker bridge not available');
      }

      try {
        console.log('[Arcline] 🔄 Calling bridge.activateTab...');
        await bridge.activateTab(tabId);
        console.log('[Arcline] ✅ useActivateTab completed successfully:', {
          tabId,
          isAtlas,
        });
      } catch (error) {
        console.error('[Arcline] ❌ useActivateTab failed:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack available',
          tabId,
          isAtlas,
        });
        throw error instanceof Error ? error : new Error(String(error));
      }
    },
    // Don't invalidate on activate as it doesn't change spaces data
  });
}

export function useArchiveTab() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (tabId: number) => {
      if (!bridge) throw new Error('Service Worker bridge not available');
      await bridge.archiveTab(tabId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spacesSnapshot });
      queryClient.invalidateQueries({ queryKey: queryKeys.archivedTabs });
    },
  });
}

export function useRestoreArchivedTab() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();

  return useMutation<void, Error, ArchivedTab>({
    mutationFn: async (archivedTab: ArchivedTab) => {
      if (!bridge) throw new Error('Service Worker bridge not available');
      await bridge.restoreArchivedTab(archivedTab);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spacesSnapshot });
      queryClient.invalidateQueries({ queryKey: queryKeys.archivedTabs });
    },
  });
}

export function useUpdateSettings() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();

  return useMutation<void, Error, Partial<Settings>>({
    mutationFn: async (settings: Partial<Settings>) => {
      if (!bridge) throw new Error('Service Worker bridge not available');
      await bridge.updateSettings(settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
}
