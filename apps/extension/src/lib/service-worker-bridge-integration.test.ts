import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceWorkerBridge } from './service-worker-bridge';

// Mock Chrome runtime
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
    },
  },
};

global.chrome = mockChrome as unknown as typeof chrome;

describe.skip('ServiceWorkerBridge Integration', () => {
  let bridge: ServiceWorkerBridge;
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    bridge = new ServiceWorkerBridge(queryClient);
    vi.clearAllMocks();
  });

  it('should create space successfully', async () => {
    // Mock successful response
    mockChrome.runtime.sendMessage.mockImplementation((message) => {
      if (message.method === 'createSpace') {
        // Return a promise that resolves with the response
        return Promise.resolve({ id: message.id, data: 123 });
      }
      return undefined;
    });

    const result = await bridge.createSpace('Test Space', 'blue');

    expect(result).toBe(123);
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'mutation',
      method: 'createSpace',
      params: { name: 'Test Space', color: 'blue' },
      id: expect.any(String),
    });
  });

  it('should handle create space error', async () => {
    // Mock error response
    mockChrome.runtime.sendMessage.mockImplementation((message) => {
      if (message.method === 'createSpace') {
        return Promise.resolve({ id: message.id, error: 'Failed to create space' });
      }
      return undefined;
    });

    await expect(bridge.createSpace('', 'blue')).rejects.toThrow('Failed to create space');
  });

  it('should get spaces snapshot', async () => {
    const mockSpaces = [
      { id: 1, name: 'Space 1', color: 'blue', pinnedTabs: [], temporaryTabs: [] },
    ];

    mockChrome.runtime.sendMessage.mockImplementation((message) => {
      if (message.method === 'getSpacesSnapshot') {
        return Promise.resolve({ id: message.id, data: mockSpaces });
      }
      return undefined;
    });

    const result = await bridge.getSpacesSnapshot();

    expect(result).toEqual(mockSpaces);
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'query',
      method: 'getSpacesSnapshot',
      id: expect.any(String),
    });
  });
});
