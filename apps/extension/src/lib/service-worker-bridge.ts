/// <reference types="chrome" />

import type { QueryClient } from '@tanstack/react-query';
import type { OptionalTabGroupColor } from '@/shared/chrome-types';
import type { ArchivedTab, Settings, SpaceSnapshot, TabEntry } from '@/shared/types';
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

  constructor(private queryClient: QueryClient) { }

  // Send message to Service Worker and wait for response
  private async sendMessage(message: Omit<BridgeMessage, 'id'>): Promise<unknown> {
    if (!hasChromeRuntime()) {
      throw new Error('Chrome runtime not available');
    }

    const id = `bridge_${Date.now()}_${Math.random()}`;
    const fullMessage: BridgeMessage = { ...message, id };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        console.error('[Bridge] Request timeout:', message.method);
        reject(new Error(`Bridge request timeout: ${message.method}`));
      }, 5000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        chrome.runtime.sendMessage(
          fullMessage,
          (response?: BridgeResponse) => {
            clearTimeout(timeout);
            this.pendingRequests.delete(id);

            if (chrome.runtime.lastError) {
              console.error('[Bridge] Send error:', chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (!response) {
              reject(new Error('Empty bridge response'));
              return;
            }

            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.data);
            }
          },
        );
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        console.error('[Bridge] Send error:', error);
        reject(error as Error);
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
