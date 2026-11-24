import { tabUrl } from './snapshot';
import type { ArchivedTab, AutoArchiveHours, TabBinding, TabInfo } from './types';

export const MAX_ARCHIVED_TABS = 200;

function isArchivableUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Pure selector returning temporary tabs eligible for auto-archiving.
 * Never archives active tabs, pinned tabs, bound pins/favorites, audible tabs, or internal pages.
 */
export function selectTabsToArchive(params: {
  tabs: TabInfo[];
  bindings: Record<number, TabBinding>;
  activity: Record<number, number>;
  nowMs: number;
  thresholdHours: AutoArchiveHours;
}): Array<TabInfo & { id: number; url: string }> {
  const { tabs, bindings, activity, nowMs, thresholdHours } = params;
  if (thresholdHours <= 0) return [];
  const cutoffMs = nowMs - thresholdHours * 60 * 60 * 1000;

  const eligible: Array<TabInfo & { id: number; url: string }> = [];
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    if (tab.active || tab.pinned || tab.audible) continue;
    if (bindings[tab.id]) continue;
    const url = tabUrl(tab);
    if (!url || !isArchivableUrl(url)) continue;
    const lastActive = activity[tab.id];
    if (lastActive === undefined || lastActive > cutoffMs) continue;
    eligible.push({ ...tab, id: tab.id, url });
  }
  return eligible;
}

/** Prepends new archived entries, deduplicates by URL, and caps list length. */
export function mergeArchive(
  existing: ArchivedTab[],
  incoming: ArchivedTab[],
  maxEntries = MAX_ARCHIVED_TABS,
): ArchivedTab[] {
  const seen = new Set<string>();
  const combined: ArchivedTab[] = [];
  for (const entry of [...incoming, ...existing]) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    combined.push(entry);
    if (combined.length >= maxEntries) break;
  }
  return combined;
}
