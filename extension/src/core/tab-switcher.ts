export interface TabSwitcherItem {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
  spaceName?: string;
}

export interface TabSwitcherResponse {
  items: TabSwitcherItem[];
  selectedIndex: number;
  accentHex?: string;
}

/** Records a tab activation at the front (index 0) of the window's MRU list. */
export function recordMruTab(current: readonly number[], tabId: number, maxSize = 24): number[] {
  const next = [tabId, ...current.filter((id) => id !== tabId)];
  return next.slice(0, maxSize);
}

/** Removes a closed tab ID from the window's MRU list. */
export function removeMruTab(current: readonly number[], tabId: number): number[] {
  return current.filter((id) => id !== tabId);
}

/**
 * Orders open tabs in MRU order (most recently used first), appending any tabs not yet seen
 * in `mruIds` in their natural tab-strip order, capped at `limit`.
 */
export function orderTabsByMru<T extends { id?: number }>(
  tabs: readonly T[],
  mruIds: readonly number[],
  limit = 6,
): T[] {
  const byId = new Map<number, T>();
  for (const t of tabs) {
    if (t.id !== undefined) byId.set(t.id, t);
  }
  const ordered: T[] = [];
  const seen = new Set<number>();

  for (const id of mruIds) {
    const t = byId.get(id);
    if (t && !seen.has(id)) {
      ordered.push(t);
      seen.add(id);
    }
  }
  for (const t of tabs) {
    if (t.id !== undefined && !seen.has(t.id)) {
      ordered.push(t);
      seen.add(t.id);
    }
  }
  return ordered.slice(0, Math.max(0, limit));
}

/** Computes initial or stepped selection index with wrap-around. */
export function stepSwitcherIndex(current: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((current + delta) % count) + count) % count;
}
