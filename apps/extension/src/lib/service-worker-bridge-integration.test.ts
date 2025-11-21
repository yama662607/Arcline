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

describe('ServiceWorkerBridge Integration', () => {
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
        // Simulate async response
        setTimeout(() => {
          const response = { id: message.id, data: 123 };
          const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]?.[0];
          if (listener) {
            listener(response);
          }
        }, 10);
      }
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
        setTimeout(() => {
          const response = { id: message.id, error: 'Failed to create space' };
          const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]?.[0];
          if (listener) {
            listener(response);
          }
        }, 10);
      }
    });

    await expect(bridge.createSpace('', 'blue')).rejects.toThrow('Failed to create space');
  });

  it('should get spaces snapshot', async () => {
    const mockSpaces = [
      { id: 1, name: 'Space 1', color: 'blue', pinnedTabs: [], temporaryTabs: [] },
    ];

    mockChrome.runtime.sendMessage.mockImplementation((message) => {
      if (message.method === 'getSpacesSnapshot') {
        setTimeout(() => {
          const response = { id: message.id, data: mockSpaces };
          const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0]?.[0];
          if (listener) {
            listener(response);
          }
        }, 10);
      }
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
