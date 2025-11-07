// Chrome API type utilities to work around @types/chrome limitations

// Since @types/chrome@0.1.27 doesn't export ColorEnum, use TabGroup's color property type
export type TabGroupColor = chrome.tabGroups.TabGroup['color'];

// Helper type for optional color parameters
export type OptionalTabGroupColor = TabGroupColor | undefined;
