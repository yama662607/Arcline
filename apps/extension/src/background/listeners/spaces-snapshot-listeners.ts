export function registerSpacesSnapshotListeners(deps: {
  broadcastSpacesSnapshot: () => Promise<void>;
}): void {
  chrome.tabs.onCreated?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  chrome.tabs.onUpdated?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  chrome.tabs.onMoved?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  chrome.tabs.onDetached?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  chrome.tabs.onAttached?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  chrome.tabs.onRemoved?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  chrome.tabs.onActivated?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  chrome.windows.onFocusChanged?.addListener(() => {
    void deps.broadcastSpacesSnapshot();
  });

  if (typeof chrome.tabGroups !== 'undefined') {
    chrome.tabGroups.onCreated?.addListener(() => {
      void deps.broadcastSpacesSnapshot();
    });
    chrome.tabGroups.onUpdated?.addListener(() => {
      void deps.broadcastSpacesSnapshot();
    });
    chrome.tabGroups.onRemoved?.addListener(() => {
      void deps.broadcastSpacesSnapshot();
    });
  }
}
