export interface TabEntry {
  id: number;
  title: string;
  url?: string;
  pinned?: boolean;
}

export interface SpaceSnapshot {
  id: number;
  name: string;
  color: string;
  pinnedTabs: TabEntry[];
  temporaryTabs: TabEntry[];
}
