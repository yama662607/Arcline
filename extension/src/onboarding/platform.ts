export const ONBOARDING_COMPLETED_KEY = 'arcline:onboardingCompleted';

export type HostPlatform = 'mac' | 'windows' | 'linux';
export type ArcPathOs = 'mac' | 'windows';

export const ARC_SIDEBAR_PATHS: Record<ArcPathOs, string> = {
  mac: '~/Library/Application Support/Arc/StorableSidebar.json',
  windows:
    '%LOCALAPPDATA%\\Packages\\TheBrowserCompany.Arc_ttt1ap7aakyb4\\LocalCache\\Local\\Arc\\StorableSidebar.json',
};

export const ARC_SIDEBAR_PATH = ARC_SIDEBAR_PATHS.mac;

export const SHORTCUTS_URL = 'chrome://extensions/shortcuts';

interface BraveNavigator extends Navigator {
  brave?: { isBrave?: () => Promise<boolean> };
}

export function detectPlatform(): HostPlatform {
  const ua = `${navigator.userAgent} ${navigator.platform}`;
  if (/Macintosh|Mac OS X|MacIntel/i.test(ua)) return 'mac';
  if (/Win32|Win64|Windows|WOW64/i.test(ua)) return 'windows';
  return 'linux';
}

export function isMacPlatform(): boolean {
  return detectPlatform() === 'mac';
}

export function defaultArcPathOs(): ArcPathOs {
  return detectPlatform() === 'windows' ? 'windows' : 'mac';
}

/** Key caps for opening a new tab (Command Bar trigger). */
export function newTabKeys(mac: boolean): string[] {
  return mac ? ['⌘', 'T'] : ['Ctrl', 'T'];
}

/** Key caps for the Command Bar hotkey (manifest: Alt+Shift+K, macOS: Command+Shift+K). */
export function commandBarKeys(mac: boolean): string[] {
  return mac ? ['⌘', '⇧', 'K'] : ['Alt', 'Shift', 'K'];
}

/** Key caps for the sidebar toggle (manifest: Alt+Shift+B, macOS: Control+B — avoids Brave Cmd+B Leo AI). */
export function toggleSidebarKeys(mac: boolean): string[] {
  return mac ? ['⌃', 'B'] : ['Alt', 'Shift', 'B'];
}

export async function detectBrave(): Promise<boolean> {
  try {
    const result = await (navigator as BraveNavigator).brave?.isBrave?.();
    return result === true;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens a browser-internal page (brave://, chrome://). Anchors can't link to these from an
 * extension page, so use chrome.tabs. Returns false when the tab could not be created.
 */
export async function openBrowserPage(url: string): Promise<boolean> {
  try {
    await chrome.tabs.create({ url });
    return true;
  } catch {
    return false;
  }
}

export async function openNewTab(): Promise<void> {
  try {
    await chrome.tabs.create({});
  } catch {
    /* nothing else to try; the user can open a tab manually */
  }
}

/** Marks the guide as completed, then closes this tab. */
export async function finishOnboarding(): Promise<void> {
  try {
    await chrome.storage.local.set({ [ONBOARDING_COMPLETED_KEY]: true });
  } catch {
    /* closing still makes sense even if storage failed */
  }
  try {
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id !== undefined) {
      await chrome.tabs.remove(tab.id);
      return;
    }
  } catch {
    /* fall through to window.close */
  }
  window.close();
}
