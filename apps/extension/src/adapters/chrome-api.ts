export type ChromeEvent<TArgs extends unknown[]> = {
  addListener: (listener: (...args: TArgs) => void) => void;
};

export type ChromeApi = {
  storage: {
    local: {
      get: (keys: unknown) => Promise<Record<string, unknown>>;
    };
  };
  tabs: {
    onCreated?: ChromeEvent<[unknown]>;
    onUpdated?: ChromeEvent<[unknown, unknown, unknown]>;
    onMoved?: ChromeEvent<[unknown, unknown]>;
    onDetached?: ChromeEvent<[unknown, unknown]>;
    onAttached?: ChromeEvent<[unknown, unknown]>;
    onRemoved?: ChromeEvent<[unknown, unknown]>;
    onActivated?: ChromeEvent<[unknown]>;

    query: (queryInfo: unknown) => Promise<unknown[]>;
    update: (tabId: number, updateProperties: unknown) => Promise<unknown>;
    create: (createProperties: unknown) => Promise<unknown>;
    getZoom: (tabId: number) => Promise<number>;
  };
  windows: {
    onFocusChanged?: ChromeEvent<[unknown]>;

    update: (windowId: number, updateInfo: unknown) => Promise<unknown>;
  };
  tabGroups?: {
    onCreated?: ChromeEvent<[unknown]>;
    onUpdated?: ChromeEvent<[unknown]>;
    onRemoved?: ChromeEvent<[unknown]>;
  };
};

export const chromeApi = globalThis.chrome as unknown as ChromeApi;
