/// <reference types="chrome" />

import type { QueryClient } from '@tanstack/react-query';
import type { FavoriteTab } from '@/background/services/favorites';
import type { OptionalTabGroupColor } from '@/shared/chrome-types';
import type {
  ArchivedTab,
  PinnedFolder,
  PinnedTab,
  SearchResult,
  Settings,
  SpaceSnapshot,
  TabEntry,
} from '@/shared/types';
import { queryKeys } from './query-client';
import { hasChromeRuntime } from './utils';

// Message types for Service Worker communication
export interface BridgeMessage {
  type: 'query' | 'mutation';
  method: string;
  params?: Record<string, unknown>;
  id: string;
}

export interface BridgeResponse {
  id: string;
  data?: unknown;
  error?: string;
}

// Service Worker bridge for React Query
export class ServiceWorkerBridge {
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(private queryClient: QueryClient) {}

  // Send message to Service Worker and wait for response
  private async sendMessage(message: Omit<BridgeMessage, 'id'>): Promise<unknown> {
    const isAtlas = /\bAtlas\b/i.test(navigator.userAgent);

    if (!hasChromeRuntime()) {
      console.error('[Arcline] ❌ Chrome runtime not available:', {
        isAtlas,
        userAgent: navigator.userAgent,
        message,
      });
      throw new Error('Chrome runtime not available');
    }

    const id = `bridge_${Date.now()}_${Math.random()}`;
    const fullMessage: BridgeMessage = { ...message, id };

    console.log('[Arcline] 📤 Sending bridge message:', {
      id,
      type: message.type,
      method: message.method,
      params: message.params,
      isAtlas,
      timestamp: new Date().toISOString(),
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        console.error('[Arcline] ⏰ Bridge request timeout:', {
          method: message.method,
          id,
          isAtlas,
          timeoutMs: 5000,
        });
        reject(new Error(`Bridge request timeout: ${message.method}`));
      }, 5000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        chrome.runtime.sendMessage(fullMessage, (response?: BridgeResponse) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);

          console.log('[Arcline] 📥 Bridge response received:', {
            id,
            method: message.method,
            hasResponse: !!response,
            hasError: !!response?.error,
            hasData: !!response?.data,
            isAtlas,
            timestamp: new Date().toISOString(),
          });

          if (chrome.runtime.lastError) {
            console.error('[Arcline] ❌ Bridge send error:', {
              error: chrome.runtime.lastError.message,
              method: message.method,
              id,
              isAtlas,
            });
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response) {
            console.error('[Arcline] ❌ Empty bridge response:', {
              method: message.method,
              id,
              isAtlas,
            });
            reject(new Error('Empty bridge response'));
            return;
          }

          if (response.error) {
            console.error('[Arcline] ❌ Bridge response error:', {
              error: response.error,
              method: message.method,
              id,
              isAtlas,
            });
            reject(new Error(response.error));
          } else {
            console.log('[Arcline] ✅ Bridge response success:', {
              method: message.method,
              id,
              isAtlas,
            });
            resolve(response.data);
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        console.error('[Arcline] ❌ Bridge send exception:', {
          error: error instanceof Error ? error.message : String(error),
          method: message.method,
          id,
          isAtlas,
        });
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  // Query methods for React Query
  async getSpacesSnapshot(): Promise<SpaceSnapshot[]> {
    return this.sendMessage({
      type: 'query',
      method: 'getSpacesSnapshot',
    }) as Promise<SpaceSnapshot[]>;
  }

  async getSettings(): Promise<Settings> {
    return this.sendMessage({
      type: 'query',
      method: 'getSettings',
    }) as Promise<Settings>;
  }

  async getArchivedTabs(): Promise<ArchivedTab[]> {
    return this.sendMessage({
      type: 'query',
      method: 'getArchivedTabs',
    }) as Promise<ArchivedTab[]>;
  }

  async getBookmarksForSpace(spaceId: number): Promise<TabEntry[]> {
    return this.sendMessage({
      type: 'query',
      method: 'getBookmarksForSpace',
      params: { spaceId },
    }) as Promise<TabEntry[]>;
  }

  async getFavorites(): Promise<FavoriteTab[]> {
    return this.sendMessage({
      type: 'query',
      method: 'getFavorites',
    }) as Promise<FavoriteTab[]>;
  }

  async getActiveTab(): Promise<TabEntry | null> {
    return this.sendMessage({
      type: 'query',
      method: 'getActiveTab',
    }) as Promise<TabEntry | null>;
  }

  // Mutation methods
  async toggleTabPinned(tabId: number, pinned?: boolean): Promise<boolean> {
    return this.sendMessage({
      type: 'mutation',
      method: 'toggleTabPinned',
      params: { tabId, pinned },
    }) as Promise<boolean>;
  }

  async moveTabToSpace(tabId: number, spaceId: number): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'moveTabToSpace',
      params: { tabId, spaceId },
    }) as Promise<void>;
  }

  async reorderTab(
    tabId: number,
    spaceId: number,
    newIndex: number,
    listType: 'pinned' | 'temporary'
  ): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'reorderTab',
      params: { tabId, spaceId, newIndex, listType },
    }) as Promise<void>;
  }

  async createSpace(name: string, color?: OptionalTabGroupColor): Promise<number> {
    return this.sendMessage({
      type: 'mutation',
      method: 'createSpace',
      params: { name, color },
    }) as Promise<number>;
  }

  async removeSpace(spaceId: number): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'removeSpace',
      params: { spaceId },
    }) as Promise<void>;
  }

  async closeTab(tabId: number): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'closeTab',
      params: { tabId },
    }) as Promise<void>;
  }

  async activateTab(tabId: number): Promise<void> {
    const isAtlas = /\bAtlas\b/i.test(navigator.userAgent);
    console.log('[Arcline] 🌉 Bridge activateTab called:', {
      tabId,
      isAtlas,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    return this.sendMessage({
      type: 'mutation',
      method: 'activateTab',
      params: { tabId },
    }) as Promise<void>;
  }

  async archiveTab(tabId: number): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'archiveTab',
      params: { tabId },
    }) as Promise<void>;
  }

  async reloadTab(tabId?: number): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'reloadTab',
      params: { tabId },
    }) as Promise<void>;
  }

  async restoreArchivedTab(archivedTab: ArchivedTab): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'restoreArchivedTab',
      params: { archivedTab },
    }) as Promise<void>;
  }

  async updateSettings(settings: Partial<Settings>): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'updateSettings',
      params: { settings },
    }) as Promise<void>;
  }

  async openUrlInTab(url: string): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'openUrlInTab',
      params: { url },
    }) as Promise<void>;
  }

  async addToFavorites(tab: TabEntry): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'addToFavorites',
      params: { tab },
    }) as Promise<void>;
  }

  async removeFromFavorites(url: string): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'removeFromFavorites',
      params: { url },
    }) as Promise<void>;
  }

  async toggleFavorite(tab: TabEntry): Promise<boolean> {
    return this.sendMessage({
      type: 'mutation',
      method: 'toggleFavorite',
      params: { tab },
    }) as Promise<boolean>;
  }

  async reorderFavorites(favorites: FavoriteTab[]): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'reorderFavorites',
      params: { favorites },
    }) as Promise<void>;
  }

  // Pinned Items management
  async createPinnedFolder(
    spaceName: string,
    title: string,
    parentId?: string
  ): Promise<PinnedFolder> {
    return this.sendMessage({
      type: 'mutation',
      method: 'createPinnedFolder',
      params: { spaceName, title, parentId },
    }) as Promise<PinnedFolder>;
  }

  async createPinnedTab(
    spaceName: string,
    title: string,
    url: string,
    favIconUrl?: string,
    parentId?: string,
    index?: number
  ): Promise<PinnedTab> {
    return this.sendMessage({
      type: 'mutation',
      method: 'createPinnedTab',
      params: { spaceName, title, url, favIconUrl, parentId, index },
    }) as Promise<PinnedTab>;
  }

  async movePinnedItem(
    id: string,
    destination: { parentId?: string; index?: number; spaceName?: string }
  ): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'movePinnedItem',
      params: { id, ...destination },
    }) as Promise<void>;
  }

  async removePinnedItem(id: string): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'removePinnedItem',
      params: { id },
    }) as Promise<void>;
  }

  async updatePinnedItem(id: string, changes: { title?: string; url?: string }): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'updatePinnedItem',
      params: { id, changes },
    }) as Promise<void>;
  }

  async exportSpaceBookmarks(spaceName: string): Promise<string> {
    return this.sendMessage({
      type: 'query',
      method: 'exportSpaceBookmarks',
      params: { spaceName },
    }) as Promise<string>;
  }

  async importSpaceBookmarks(
    spaceName: string,
    htmlContent: string,
    parentId?: string
  ): Promise<void> {
    return this.sendMessage({
      type: 'mutation',
      method: 'importSpaceBookmarks',
      params: { spaceName, htmlContent, parentId },
    }) as Promise<void>;
  }

  async searchHistory(query: string, maxResults?: number): Promise<SearchResult[]> {
    return this.sendMessage({
      type: 'query',
      method: 'searchHistory',
      params: { query, maxResults },
    }) as Promise<SearchResult[]>;
  }

  async searchBookmarks(query: string, maxResults?: number): Promise<SearchResult[]> {
    return this.sendMessage({
      type: 'query',
      method: 'searchBookmarks',
      params: { query, maxResults },
    }) as Promise<SearchResult[]>;
  }

  // Setup React Query queries
  setupQueries() {
    // Spaces snapshot query
    this.queryClient.prefetchQuery({
      queryKey: queryKeys.spacesSnapshot,
      queryFn: () => this.getSpacesSnapshot(),
    });

    // Settings query
    this.queryClient.prefetchQuery({
      queryKey: queryKeys.settings,
      queryFn: () => this.getSettings(),
    });

    // Archived tabs query
    this.queryClient.prefetchQuery({
      queryKey: queryKeys.archivedTabs,
      queryFn: () => this.getArchivedTabs(),
    });

    // Listen for spacesSnapshot broadcasts from Service Worker
    if (hasChromeRuntime()) {
      chrome.runtime.onMessage.addListener((message: unknown) => {
        if (
          typeof message === 'object' &&
          message !== null &&
          'command' in message &&
          (message as { command?: string }).command === 'spacesSnapshot' &&
          'spaces' in message
        ) {
          const { spaces } = message as { spaces: SpaceSnapshot[] };
          this.updateSpacesCache(spaces);
        }
      });
    }
  }

  // Update spaces cache directly (used when receiving broadcast from Service Worker)
  updateSpacesCache(spaces: SpaceSnapshot[]) {
    this.queryClient.setQueryData(queryKeys.spacesSnapshot, spaces);
  }

  // Cleanup method
  destroy() {
    // Clear any pending requests
    for (const { timeout } of this.pendingRequests.values()) {
      clearTimeout(timeout);
    }
    this.pendingRequests.clear();
  }
}
