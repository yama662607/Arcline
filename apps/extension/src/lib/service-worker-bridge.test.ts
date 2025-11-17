import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceSnapshot } from '@/shared/types';
import { chromeMock } from '@/test/chrome-mock';
import { queryKeys } from './query-client';
import { type BridgeResponse, ServiceWorkerBridge } from './service-worker-bridge';

describe('ServiceWorkerBridge', () => {
  let queryClient: QueryClient;
  let bridge: ServiceWorkerBridge;

  const getListener = () =>
    chromeMock.runtime.onMessage.addListener.mock.calls.slice(-1)[0]?.[0] as
      | ((message: BridgeResponse) => void)
      | undefined;

  beforeEach(() => {
    queryClient = new QueryClient();
    bridge = new ServiceWorkerBridge(queryClient);
    chromeMock.runtime.lastError = undefined;
  });

  afterEach(() => {
    bridge.destroy();
    queryClient.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('resolves pending requests when the runtime responds', async () => {
    const promise = bridge.getSpacesSnapshot();

    const sent = chromeMock.runtime.sendMessage.mock.calls.slice(-1)[0]?.[0] as {
      id: string;
    };
    expect(sent).toBeDefined();

    const listener = getListener();
    expect(listener).toBeDefined();

    const spaces: SpaceSnapshot[] = [
      {
        id: 1,
        name: 'Work',
        tabs: [],
        pinnedTabs: [],
        temporaryTabs: [],
        color: 'blue',
        windowId: 1,
        created_at: Date.now(),
        last_active_at: Date.now(),
      },
    ];

    listener?.({ id: sent?.id, data: spaces });

    await expect(promise).resolves.toEqual(spaces);
  });

  it('rejects when the runtime throws during sendMessage', async () => {
    chromeMock.runtime.sendMessage.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await expect(bridge.getSettings()).rejects.toThrow('boom');
  });

  it('times out if the runtime never responds', async () => {
    vi.useFakeTimers();

    const promise = bridge.getArchivedTabs();
    vi.advanceTimersByTime(5000);

    await expect(promise).rejects.toThrow(/timeout/i);
  });

  it('prefetches key queries via setupQueries', () => {
    const bridge = new ServiceWorkerBridge(queryClient);

    // Spy on prefetchQuery
    const prefetchSpy = vi.spyOn(queryClient, 'prefetchQuery');

    bridge.setupQueries();

    // Check that prefetchQuery was called for each query
    expect(prefetchSpy).toHaveBeenCalledTimes(3);
    expect(prefetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.spacesSnapshot,
        queryFn: expect.any(Function),
      })
    );
    expect(prefetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.settings,
        queryFn: expect.any(Function),
      })
    );
    expect(prefetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.archivedTabs,
        queryFn: expect.any(Function),
      })
    );
  });

  it('sends mutation payloads for toggleTabPinned', async () => {
    const togglePromise = bridge.toggleTabPinned(42, true);

    const sent = chromeMock.runtime.sendMessage.mock.calls.slice(-1)[0]?.[0] as {
      id: string;
      type: string;
      method: string;
      params?: Record<string, unknown>;
    };

    expect(sent).toMatchObject({
      type: 'mutation',
      method: 'toggleTabPinned',
      params: { tabId: 42, pinned: true },
    });

    const listener = getListener();
    listener?.({ id: sent.id, data: true });

    await expect(togglePromise).resolves.toBe(true);
  });

  it('requests bookmarks with parameters via bridge', async () => {
    const bookmarksPromise = bridge.getBookmarksForSpace(7);

    const sent = chromeMock.runtime.sendMessage.mock.calls.slice(-1)[0]?.[0] as {
      id: string;
      type: string;
      method: string;
      params?: Record<string, unknown>;
    };

    expect(sent).toMatchObject({
      type: 'query',
      method: 'getBookmarksForSpace',
      params: { spaceId: 7 },
    });

    const listener = getListener();
    listener?.({ id: sent.id, data: [] });

    await expect(bookmarksPromise).resolves.toEqual([]);
  });

  // Additional integration tests for createSpace/removeSpace
  it('sends createSpace mutation with name and color', async () => {
    const createPromise = bridge.createSpace('Test Space', 'red');

    const sent = chromeMock.runtime.sendMessage.mock.calls.slice(-1)[0]?.[0] as {
      id: string;
      type: string;
      method: string;
      params?: Record<string, unknown>;
    };

    expect(sent).toMatchObject({
      type: 'mutation',
      method: 'createSpace',
      params: { name: 'Test Space', color: 'red' },
    });

    const listener = getListener();
    listener?.({ id: sent.id, data: 123 });

    await expect(createPromise).resolves.toBe(123);
  });

  it('sends removeSpace mutation with spaceId', async () => {
    const removePromise = bridge.removeSpace(456);

    const sent = chromeMock.runtime.sendMessage.mock.calls.slice(-1)[0]?.[0] as {
      id: string;
      type: string;
      method: string;
      params?: Record<string, unknown>;
    };

    expect(sent).toMatchObject({
      type: 'mutation',
      method: 'removeSpace',
      params: { spaceId: 456 },
    });

    const listener = getListener();
    listener?.({ id: sent.id, data: undefined });

    await expect(removePromise).resolves.toBeUndefined();
  });

  it('rejects on bridge error response for mutations', async () => {
    const badPromise = bridge.toggleTabPinned(999, false);

    const sent = chromeMock.runtime.sendMessage.mock.calls.slice(-1)[0]?.[0] as { id: string };
    const listener = getListener();

    listener?.({ id: sent.id, error: 'tab not found' });

    await expect(badPromise).rejects.toThrow('tab not found');
  });
});
