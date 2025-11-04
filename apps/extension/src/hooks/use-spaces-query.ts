import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import { useServiceWorkerBridge } from './use-service-worker-bridge';
import type { SpaceSnapshot, TabEntry, SpaceCreateRequest, SpaceUpdateRequest, TabMoveRequest } from '@/shared/types';

// Query hooks
export function useSpacesSnapshot() {
  const bridge = useServiceWorkerBridge();
  
  return useQuery({
    queryKey: queryKeys.spacesSnapshot,
    queryFn: () => bridge!.getSpacesSnapshot(),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // 1 minute
  });
}

export function useSettings() {
  const bridge = useServiceWorkerBridge();
  
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => bridge!.getSettings(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useArchivedTabs() {
  const bridge = useServiceWorkerBridge();
  
  return useQuery({
    queryKey: queryKeys.archivedTabs,
    queryFn: () => bridge!.getArchivedTabs(),
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useBookmarksForSpace(spaceId: number) {
  const bridge = useServiceWorkerBridge();
  
  return useQuery({
    queryKey: queryKeys.bookmarks(spaceId),
    queryFn: () => bridge!.getBookmarksForSpace(spaceId),
    enabled: !!spaceId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Mutation hooks
export function useToggleTabPinned() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tabId, pinned }: { tabId: number; pinned?: boolean }) => 
      bridge!.toggleTabPinned(tabId, pinned),
    onSuccess: () => {
      // Invalidate spaces snapshot to refresh UI
      queryClient.invalidateQueries({ queryKey: queryKeys.spacesSnapshot });
    },
  });
}

export function useMoveTabToSpace() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tabId, spaceId, index }: TabMoveRequest) => 
      bridge!.moveTabToSpace(tabId, spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spacesSnapshot });
    },
  });
}

export function useCreateSpace() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ name, color }: SpaceCreateRequest) => 
      bridge!.createSpace(name, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spacesSnapshot });
    },
  });
}

export function useRemoveSpace() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (spaceId: number) => bridge!.removeSpace(spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spacesSnapshot });
    },
  });
}

export function useCloseTab() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (tabId: number) => bridge!.closeTab(tabId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spacesSnapshot });
    },
  });
}

export function useActivateTab() {
  const bridge = useServiceWorkerBridge();
  
  return useMutation({
    mutationFn: (tabId: number) => bridge!.activateTab(tabId),
    // Don't invalidate on activate as it doesn't change spaces data
  });
}

export function useArchiveTab() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (tabId: number) => bridge!.archiveTab(tabId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spacesSnapshot });
      queryClient.invalidateQueries({ queryKey: queryKeys.archivedTabs });
    },
  });
}

export function useRestoreArchivedTab() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (archivedTab: any) => bridge!.restoreArchivedTab(archivedTab),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spacesSnapshot });
      queryClient.invalidateQueries({ queryKey: queryKeys.archivedTabs });
    },
  });
}

export function useUpdateSettings() {
  const bridge = useServiceWorkerBridge();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (settings: Partial<any>) => bridge!.updateSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
}
