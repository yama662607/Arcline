/**
 * Serializes asynchronous tasks so Chrome/Brave tab/bookmark writes never race.
 */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task, task);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

const DRAG_LOCK_RE = /Tabs cannot be edited right now/i;

/**
 * Retries Chrome tab/group operations that fail transiently while the user drags a tab.
 */
export async function retry<T>(fn: () => Promise<T>, attempts = 6, baseDelayMs = 60): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      if (!DRAG_LOCK_RE.test(msg) || i === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (i + 1)));
    }
  }
  throw lastError;
}
