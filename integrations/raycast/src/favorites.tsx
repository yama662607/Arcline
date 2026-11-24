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
import { useMemo } from 'react';
import {
  getBrowserAppName,
  loadArclineWorkspace,
  openUrlInBrowser,
  type RaycastPreferences,
} from './lib/arcline';

export default function FavoritesCommand() {
  const prefs = getPreferenceValues<RaycastPreferences>();
  const workspace = useMemo(() => loadArclineWorkspace(prefs), [prefs]);
  const browserApp = getBrowserAppName(prefs.browser);

  const openTarget = async (url: string) => {
    try {
      await openUrlInBrowser(url, prefs.browser);
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Failed to open Favorite',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <List searchBarPlaceholder="Filter Arcline Favorites or create a Raycast Quicklink shortcut…">
      {workspace.favorites.length === 0 ? (
        <List.EmptyView
          icon={Icon.Star}
          title="No Arcline Favorites found"
          description="Add Favorites in Arcline's sidebar and they will appear here automatically."
        />
      ) : (
        <List.Section
          title="Arcline Favorites"
          subtitle={`${workspace.favorites.length} items — Create Quicklink to bind a Raycast Hotkey`}
        >
          {workspace.favorites.map((fav) => (
            <List.Item
              key={fav.id}
              icon={{ source: Icon.Star, tintColor: Color.Yellow }}
              title={fav.title}
              subtitle={fav.url}
              keywords={fav.alias ? [fav.alias] : undefined}
              accessories={[
                ...(fav.alias ? [{ tag: { value: `@${fav.alias}`, color: Color.Blue } }] : []),
                { text: browserApp },
              ]}
              actions={
                <ActionPanel>
                  <Action title={`Open in ${browserApp}`} onAction={() => void openTarget(fav.url)} />
                  <Action.CreateQuicklink
                    title="Create Quicklink (Assign Raycast Hotkey)"
                    shortcut={{ modifiers: ['cmd'], key: 'l' }}
                    quicklink={{
                      name: fav.title,
                      link: fav.url,
                      application: browserApp,
                    }}
                  />
                  <Action.CopyToClipboard title="Copy URL" content={fav.url} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}
