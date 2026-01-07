import type { SpaceSnapshot, SpaceTransitionHandoff } from '@/shared/types';

export type SpaceTransitionOptions = {
  transition?: SpaceTransitionHandoff | null;
};

export async function openFloatingUiOnTab(
  tabId: number,
  spaces: SpaceSnapshot[],
  activeSpaceId: number,
  options?: SpaceTransitionOptions & { perfId?: string; t0?: number }
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const transition = options?.transition;

      // Send a single unified message to update data and open UI instantly.
      chrome.tabs.sendMessage(
        tabId,
        {
          command: 'openFloatingUiWithData',
          spaces,
          activeSpaceId,
          transition,
          instant: true,
          perfId: options?.perfId,
          t0: options?.t0,
        },
        () => {
          if (chrome.runtime.lastError) {
            console.warn(
              '[Arcline] ❌ openFloatingUiOnTab failed:',
              chrome.runtime.lastError.message
            );
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            console.log('[Arcline] ✅ openFloatingUiOnTab message sent successfully');
            resolve();
          }
        }
      );
    } catch (error) {
      console.warn('[Arcline] Failed to request floating UI open', error);
      reject(error);
    }
  });
}
