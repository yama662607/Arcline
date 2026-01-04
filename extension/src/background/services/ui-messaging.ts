import type { SpaceSnapshot, SpaceTransitionHandoff } from '@/shared/types';

export type SpaceTransitionOptions = {
  transition?: SpaceTransitionHandoff | null;
};

export async function openFloatingUiOnTab(
  tabId: number,
  spaces: SpaceSnapshot[],
  options?: SpaceTransitionOptions & { perfId?: string; t0?: number }
): Promise<void> {
  try {
    const transition = options?.transition;

    // Send a single unified message to update data and open UI instantly.
    chrome.tabs.sendMessage(
      tabId,
      {
        command: 'openFloatingUiWithData',
        spaces,
        transition,
        instant: true,
        perfId: options?.perfId,
        t0: options?.t0,
      },
      () => {
        if (chrome.runtime.lastError) {
          // Silent fail
        }
      }
    );
  } catch {
    // Silent fail
  }
}
