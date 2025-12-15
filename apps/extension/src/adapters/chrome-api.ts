export type ChromeEvent<TArgs extends unknown[]> = {
  addListener: (listener: (...args: TArgs) => void) => void;
};

export type ChromeApi = {
  tabs: {
    onCreated?: ChromeEvent<[unknown]>;
    onUpdated?: ChromeEvent<[unknown, unknown, unknown]>;
    onMoved?: ChromeEvent<[unknown, unknown]>;
    onDetached?: ChromeEvent<[unknown, unknown]>;
    onAttached?: ChromeEvent<[unknown, unknown]>;
    onRemoved?: ChromeEvent<[unknown, unknown]>;
    onActivated?: ChromeEvent<[unknown]>;
  };
  windows: {
    onFocusChanged?: ChromeEvent<[unknown]>;
  };
  tabGroups?: {
    onCreated?: ChromeEvent<[unknown]>;
    onUpdated?: ChromeEvent<[unknown]>;
    onRemoved?: ChromeEvent<[unknown]>;
  };
};

export const chromeApi = globalThis.chrome as unknown as ChromeApi;
