import { chromeApi as defaultChromeApi, type ChromeApi } from '@/adapters/chrome-api';

export function registerSpacesSnapshotListeners(deps: {
  broadcastSpacesSnapshot: () => Promise<void>;
  chromeApi?: ChromeApi;
}): void {
  const chromeApi = deps.chromeApi ?? defaultChromeApi;

  chromeApi.tabs.onCreated?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  chromeApi.tabs.onUpdated?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  chromeApi.tabs.onMoved?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  chromeApi.tabs.onDetached?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  chromeApi.tabs.onAttached?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  chromeApi.tabs.onRemoved?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  chromeApi.tabs.onActivated?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  chromeApi.windows.onFocusChanged?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  if (typeof chromeApi.tabGroups !== 'undefined') {
    chromeApi.tabGroups.onCreated?.addListener(() => {
      void deps.broadcastSpacesSnapshot();
    });
    chromeApi.tabGroups.onUpdated?.addListener(() => {
      void deps.broadcastSpacesSnapshot();
    });
    chromeApi.tabGroups.onRemoved?.addListener(() => {
      void deps.broadcastSpacesSnapshot();
    });
  }
}
