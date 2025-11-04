import { hasChromeRuntime } from './utils';

type GenericResponse<T = unknown> = ({ ok: true } & T) | { ok: false; error: string };

function sendMessage<T>(payload: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (!hasChromeRuntime()) {
      reject(new Error('Chrome runtime is not available'));
      return;
    }

    try {
      chrome.runtime.sendMessage(payload, (response: GenericResponse<T>) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response || response.ok === false) {
          const errorMsg = response && 'error' in response ? response.error : 'Unknown error';
          reject(new Error(errorMsg));
          return;
        }

        resolve(response as T);
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export async function toggleTabPinned(tabId: number, pinned?: boolean): Promise<boolean> {
  const result = await sendMessage<{ pinned: boolean }>({
    command: 'toggleTabPinned',
    tabId,
    pinned,
  });
  return result.pinned;
}

export async function moveTabToSpace(tabId: number, spaceId: number): Promise<number | null> {
  const result = await sendMessage<{ groupId: number | null }>({
    command: 'moveTabToSpace',
    tabId,
    spaceId,
  });
  return result.groupId;
}

export async function closeTab(tabId: number): Promise<void> {
  await sendMessage<{ command: 'closeTab'; tabId: number }>({ command: 'closeTab', tabId });
}

export async function activateTab(tabId: number): Promise<void> {
  await sendMessage<{ command: 'activateTab'; tabId: number }>({ command: 'activateTab', tabId });
}

export async function createSpace(
  name: string,
  color?: chrome.tabGroups.ColorEnum
): Promise<number> {
  const result = await sendMessage<{ groupId: number }>({ command: 'createSpace', name, color });
  return result.groupId;
}

export async function removeSpace(spaceId: number): Promise<void> {
  await sendMessage<{ command: 'removeSpace'; spaceId: number }>({ command: 'removeSpace', spaceId });
}
