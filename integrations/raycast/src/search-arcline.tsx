import {
  Action,
  ActionPanel,
  Color,
  getPreferenceValues,
  Icon,
  List,
  showToast,
  Toast,
} from '@raycast/api';
import { useEffect, useMemo, useState } from 'react';
import {
  buildWebSearchUrl,
  getBrowserAppName,
  type HistoryMatch,
  loadArclineWorkspace,
  matchSiteSearch,
  normalizeUrlInput,
  openUrlInBrowser,
  type RaycastPreferences,
  SEARCH_ENGINE_TEMPLATES,
  searchBrowserHistory,
} from './lib/arcline';

export default function SearchArclineCommand() {
  const prefs = getPreferenceValues<RaycastPreferences>();
  const [searchText, setSearchText] = useState('');
  const [historyItems, setHistoryItems] = useState<HistoryMatch[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const workspace = useMemo(() => loadArclineWorkspace(prefs), [prefs]);

  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    const timer = setTimeout(() => {
      void searchBrowserHistory(searchText, 25, prefs).then((rows) => {
        if (!cancelled) {
          setHistoryItems(rows);
          setLoadingHistory(false);
        }
      });
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchText, prefs]);

  const query = searchText.trim();
  const needle = query.toLowerCase();

  const matchingFavorites = useMemo(() => {
    const filtered = workspace.favorites.filter(
      (f) =>
        !needle ||
        f.title.toLowerCase().includes(needle) ||
        f.url.toLowerCase().includes(needle) ||
        (f.alias?.toLowerCase().includes(needle) ?? false),
    );
    if (!needle) return filtered;
    return [...filtered].sort((a, b) => {
      const aExact = a.alias?.toLowerCase() === needle ? 1 : 0;
      const bExact = b.alias?.toLowerCase() === needle ? 1 : 0;
      return bExact - aExact;
    });
  }, [workspace.favorites, needle]);

  const matchingPins = useMemo(() => {
    const allPins = workspace.spaces.flatMap((sp) => sp.items);
    return allPins
      .filter(
        (p) =>
          !needle ||
          p.title.toLowerCase().includes(needle) ||
          p.url.toLowerCase().includes(needle) ||
          (p.spaceName ?? '').toLowerCase().includes(needle) ||
          p.folderPath.some((f) => f.toLowerCase().includes(needle)),
      )
      .slice(0, 40);
  }, [workspace.spaces, needle]);

  const siteMatch = useMemo(
    () => matchSiteSearch(searchText, workspace.customSiteSearches),
    [searchText, workspace.customSiteSearches],
  );
  const directUrl = useMemo(() => (query ? normalizeUrlInput(query) : null), [query]);

  const openTarget = async (url: string) => {
    try {
      await openUrlInBrowser(url, prefs.browser);
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Failed to open URL',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <List
      isLoading={loadingHistory}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search Favorites, Space Pins, History — or type gh / yt / wiki / gpt ..."
      throttle
    >
      {siteMatch && (
        <List.Section title="Site Search">
          <List.Item
            icon={{ source: Icon.MagnifyingGlass, tintColor: Color.Blue }}
            title={`Search ${siteMatch.site.label} for "${siteMatch.term}"`}
            subtitle={siteMatch.site.prefix}
            accessories={[{ tag: { value: siteMatch.site.label, color: Color.Blue } }]}
            actions={
              <ActionPanel>
                <Action
                  title={`Search ${siteMatch.site.label}`}
                  onAction={() =>
                    void openTarget(
                      siteMatch.site.urlTemplate.replace('%s', encodeURIComponent(siteMatch.term)),
                    )
                  }
                />
              </ActionPanel>
            }
          />
        </List.Section>
      )}

      {directUrl && (
        <List.Section title="Go to URL">
          <List.Item
            icon={{ source: Icon.Globe, tintColor: Color.Green }}
            title={`Open ${directUrl}`}
            actions={
              <ActionPanel>
                <Action title="Open URL" onAction={() => void openTarget(directUrl)} />
                <Action.CopyToClipboard content={directUrl} />
              </ActionPanel>
            }
          />
        </List.Section>
      )}

      <List.Section title="Global Favorites" subtitle={String(matchingFavorites.length)}>
        {matchingFavorites.map((fav) => {
          const accessories: List.Item.Accessory[] = [];
          if (fav.alias) {
            accessories.push({ tag: { value: `@${fav.alias}`, color: Color.Blue } });
          }
          accessories.push({ tag: 'Favorite' });
          return (
            <List.Item
              key={`fav-${fav.id}`}
              icon={{ source: Icon.Star, tintColor: Color.Yellow }}
              title={fav.title}
              subtitle={fav.url}
              keywords={fav.alias ? [fav.alias] : undefined}
              accessories={accessories}
              actions={
                <ActionPanel>
                  <Action title="Open in Browser" onAction={() => void openTarget(fav.url)} />
                  <Action.CreateQuicklink
                    title="Create Quicklink (Assign Raycast Shortcut)"
                    quicklink={{
                      name: fav.title,
                      link: fav.url,
                      application: getBrowserAppName(prefs.browser),
                    }}
                  />
                  <Action.CopyToClipboard title="Copy URL" content={fav.url} />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>

      <List.Section title="Space Pinned Tabs" subtitle={String(matchingPins.length)}>
        {matchingPins.map((pin) => (
          <List.Item
            key={`pin-${pin.id}`}
            icon={{ source: Icon.Pin, tintColor: Color.Purple }}
            title={pin.title}
            subtitle={pin.folderPath.length > 0 ? pin.folderPath.join(' / ') : pin.url}
            accessories={pin.spaceName ? [{ tag: { value: pin.spaceName, color: Color.Purple } }] : []}
            actions={
              <ActionPanel>
                <Action title="Open in Browser" onAction={() => void openTarget(pin.url)} />
                <Action.CopyToClipboard title="Copy URL" content={pin.url} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      <List.Section title="Browser History" subtitle={String(historyItems.length)}>
        {historyItems.map((h) => (
          <List.Item
            key={`hist-${h.url}`}
            icon={{ source: Icon.Clock, tintColor: Color.SecondaryText }}
            title={h.title || h.url}
            subtitle={h.url}
            accessories={[{ text: `${h.visitCount} visits` }]}
            actions={
              <ActionPanel>
                <Action title="Open in Browser" onAction={() => void openTarget(h.url)} />
                <Action.CopyToClipboard title="Copy URL" content={h.url} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      {query && !siteMatch && (
        <List.Section title="Web Search">
          <List.Item
            icon={Icon.MagnifyingGlass}
            title={`Search ${SEARCH_ENGINE_TEMPLATES[prefs.searchEngine].label} for "${query}"`}
            actions={
              <ActionPanel>
                <Action
                  title="Search Web"
                  onAction={() => void openTarget(buildWebSearchUrl(prefs.searchEngine, query))}
                />
              </ActionPanel>
            }
          />
        </List.Section>
      )}
    </List>
  );
}
