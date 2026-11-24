import { Action, ActionPanel, Color, getPreferenceValues, Icon, List, showToast, Toast } from '@raycast/api';
import { useMemo } from 'react';
import {
  type ArclineSpaceSummary,
  loadArclineWorkspace,
  openUrlInBrowser,
  type RaycastPreferences,
} from './lib/arcline';

function SpaceDetailList({ space, prefs }: { space: ArclineSpaceSummary; prefs: RaycastPreferences }) {
  const openUrl = async (url: string) => {
    try {
      await openUrlInBrowser(url, prefs.browser);
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Failed to open link',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <List navigationTitle={space.name} searchBarPlaceholder={`Search pins in ${space.name}...`}>
      {space.items.map((item) => (
        <List.Item
          key={item.id}
          icon={Icon.Bookmark}
          title={item.title}
          subtitle={item.folderPath.length > 0 ? `${item.folderPath.join(' / ')} — ${item.url}` : item.url}
          actions={
            <ActionPanel>
              <Action title="Open in Browser" onAction={() => void openUrl(item.url)} />
              <Action.CopyToClipboard title="Copy URL" content={item.url} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

export default function BrowseSpacesCommand() {
  const prefs = getPreferenceValues<RaycastPreferences>();
  const workspace = useMemo(() => loadArclineWorkspace(prefs), [prefs]);

  return (
    <List searchBarPlaceholder="Filter Arcline Spaces...">
      <List.Section title="Spaces" subtitle={String(workspace.spaces.length)}>
        {workspace.spaces.map((space) => (
          <List.Item
            key={space.name}
            icon={{ source: Icon.AppWindowSidebarLeft, tintColor: Color.Blue }}
            title={space.name}
            accessories={[
              { tag: `${space.pinCount} pins` },
              ...(space.folderCount > 0 ? [{ tag: `${space.folderCount} folders` }] : []),
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Browse Space Pins"
                  target={<SpaceDetailList space={space} prefs={prefs} />}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>

      {workspace.favorites.length > 0 && (
        <List.Section title="Global Favorites" subtitle={String(workspace.favorites.length)}>
          {workspace.favorites.map((fav) => (
            <List.Item
              key={fav.id}
              icon={{ source: Icon.Star, tintColor: Color.Yellow }}
              title={fav.title}
              subtitle={fav.url}
              actions={
                <ActionPanel>
                  <Action
                    title="Open in Browser"
                    onAction={() => void openUrlInBrowser(fav.url, prefs.browser)}
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
