import { CliError, portable, sanitizeUrl } from './common.mjs';

const objects = list => Array.isArray(list) ? list.filter(x => x && typeof x === 'object' && !Array.isArray(x)) : [];
const text = value => typeof value === 'string' ? value.trim() : '';

export function parseArcSidebar(document) {
  const containers = objects(document?.sidebar?.containers).filter(c => Array.isArray(c.spaces) && Array.isArray(c.items));
  if (!containers.length) throw new CliError('INVALID_ARC', 'Expected Arc StorableSidebar.json with sidebar.containers containing spaces and items.');
  const stats = { skippedUnsafe: 0, skippedBroken: 0, skippedSearches: 0,
    skippedEmptyFolders: 0, deduped: 0, skippedReferences: 0 };
  const spaces = [];
  const favorites = [];
  const favoriteUrls = new Set();
  for (const container of containers) {
    const itemList = objects(container.items);
    const items = new Map(itemList.filter(item => typeof item.id === 'string').map(item => [item.id, item]));
    function build(ids, visited, urls, depth = 0) {
      if (depth > 200) throw new CliError('INVALID_ARC', 'Arc folder nesting exceeds 200 levels.');
      const nodes = [];
      for (const id of Array.isArray(ids) ? ids : []) {
        const item = items.get(id);
        if (!item || visited.has(id)) { stats.skippedReferences++; continue; }
        visited.add(id);
        const tab = item.data?.tab;
        if (tab?.savedURL !== undefined) {
          let url;
          try { url = sanitizeUrl(tab.savedURL); } catch { stats.skippedUnsafe++; continue; }
          const parsed = new URL(url);
          if (url.startsWith('file:///private/var/mobile/')) { stats.skippedBroken++; continue; }
          if (['www.google.com', 'www.google.co.jp'].includes(parsed.hostname) && parsed.pathname === '/search') {
            stats.skippedSearches++; continue;
          }
          if (urls.has(url)) { stats.deduped++; continue; }
          urls.add(url);
          nodes.push({ kind: 'pin', title: text(item.title) || text(tab.savedTitle) || url, url });
        } else if (item.data && ('list' in item.data || 'itemContainer' in item.data)) {
          const children = build(item.childrenIds, visited, urls, depth + 1);
          if (!children.length) { stats.skippedEmptyFolders++; continue; }
          const title = text(item.title);
          if (title) nodes.push({ kind: 'folder', title, children });
          else nodes.push(...children);
        }
      }
      return nodes;
    }
    for (const space of objects(container.spaces)) {
      const ids = Array.isArray(space.containerIDs) ? space.containerIDs : [];
      const index = ids.indexOf('pinned');
      const rootId = index >= 0 ? ids[index + 1] : undefined;
      const root = items.get(rootId);
      const pinned = build(root?.childrenIds, new Set(rootId ? [rootId] : []), new Set());
      const iconInfo = space.customInfo?.iconType;
      const icon = text(iconInfo?.emoji) || text(iconInfo?.icon)
        || text(Object.entries(iconInfo ?? {}).find(([key]) => key.startsWith('emoji'))?.[1]);
      spaces.push({ name: text(space.title) || 'Space', ...(icon ? { icon } : {}), pinned });
    }
    const topIds = Array.isArray(container.topAppsContainerIDs) ? container.topAppsContainerIDs.filter(id => typeof id === 'string') : [];
    for (const id of topIds) {
      const root = items.get(id);
      const children = root?.childrenIds?.length ? root.childrenIds : itemList.filter(item => item.parentID === id).map(item => item.id);
      favorites.push(...build(children, new Set([id]), favoriteUrls));
    }
  }
  const workspace = portable(favorites, spaces);
  workspace.stats = { ...workspace.stats, ...stats };
  return workspace;
}
