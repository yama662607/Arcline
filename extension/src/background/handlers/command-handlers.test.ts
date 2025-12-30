import { describe, expect, it, vi } from 'vitest';
import { createCommandHandlers, type CommandHandlersDeps } from './command-handlers';

describe('command-handlers', () => {
  it('should handle navigateSpace command', async () => {
    const mockNavigateSpace = vi.fn().mockResolvedValue(true);
    const mockDeps = {
      navigateSpace: mockNavigateSpace,
      // Minimal mocks for other deps to satisfy typing if strictly needed,
      // but createCommandHandlers takes deps and returns a map.
      // We only access one handler, so other deps are likely not accessed in this test case.
      // However, if createCommandHandlers DESTRUCTURES deps immediately, we might need them.
      // Checking source: `const chromeApi = deps.chromeApi ?? defaultChromeApi;`
      // So we might need to mock unknown ones if we passed `{} as ...`.
      // But let's use a cast for simplicity.
      chromeApi: { storage: { local: { get: vi.fn() } } },
    } as unknown as CommandHandlersDeps;

    const handlers = createCommandHandlers(mockDeps);
    const handler = handlers.navigateSpace;

    expect(handler).toBeDefined();
    if (!handler) {
      throw new Error('navigateSpace handler was not registered');
    }

    const sendResponse = vi.fn();

    // 1. Valid Left Request
    // The handler is async but returns boolean immediately (usually).
    // Our respondAsync helper calls the async function.
    // We need to wait for microtasks.
    handler({ direction: 'left' }, sendResponse);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockNavigateSpace).toHaveBeenCalledWith('left');
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: true });

    // 2. Valid Right Request
    mockNavigateSpace.mockClear();
    sendResponse.mockClear();
    handler({ direction: 'right' }, sendResponse);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockNavigateSpace).toHaveBeenCalledWith('right');
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: true });

    // 3. Error Handling
    mockNavigateSpace.mockClear();
    sendResponse.mockClear();
    mockNavigateSpace.mockRejectedValue(new Error('Navigation failed'));

    handler({ direction: 'left' }, sendResponse);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockNavigateSpace).toHaveBeenCalledWith('left');
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'Error: Navigation failed' });

    // 4. Invalid Params
    sendResponse.mockClear();
    mockNavigateSpace.mockClear();
    handler({ direction: 'up' }, sendResponse);
    // Should return false synchronously and call sendResponse with error

    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
    expect(mockNavigateSpace).not.toHaveBeenCalled();
  });
});
