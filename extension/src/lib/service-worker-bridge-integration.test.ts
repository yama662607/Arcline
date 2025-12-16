import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceWorkerBridge } from './service-worker-bridge';

// Mock Chrome runtime
const mockChrome = {
  runtime: {
    lastError: undefined,
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
    mockChrome.runtime.lastError = undefined;
  });

  it('should create space successfully', async () => {
    // Mock successful response
    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.method === 'createSpace') {
        const response = { id: message.id, data: 123 };
        // Determine if callback is the second argument (standard)
        if (typeof callback === 'function') {
          callback(response);
        }
      }
    });

    const result = await bridge.createSpace('Test Space', 'blue');

    expect(result).toBe(123);
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'mutation',
        method: 'createSpace',
        params: { name: 'Test Space', color: 'blue' },
      }),
      expect.any(Function)
    );
  });

  it('should handle create space error', async () => {
    // Mock error response
    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.method === 'createSpace') {
        const response = { id: message.id, error: 'Failed to create space' };
        if (typeof callback === 'function') {
          callback(response);
        }
      }
    });

    await expect(bridge.createSpace('', 'blue')).rejects.toThrow('Failed to create space');
  });

  it('should get spaces snapshot', async () => {
    const mockSpaces = [
      { id: 1, name: 'Space 1', color: 'blue', pinnedTabs: [], temporaryTabs: [] },
    ];

    mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.method === 'getSpacesSnapshot') {
        const response = { id: message.id, data: mockSpaces };
        if (typeof callback === 'function') {
          callback(response);
        }
      }
    });

    const result = await bridge.getSpacesSnapshot();

    expect(result).toEqual(mockSpaces);
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'query',
        method: 'getSpacesSnapshot',
      }),
      expect.any(Function)
    );
  });
});
