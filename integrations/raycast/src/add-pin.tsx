import {
  Action,
  ActionPanel,
  Form,
  getPreferenceValues,
  popToRoot,
  showToast,
  Toast,
} from '@raycast/api';
import { useMemo, useState } from 'react';
import { addPinToSpaceBookmarks, loadArclineWorkspace, type RaycastPreferences } from './lib/arcline';

export default function AddPinCommand() {
  const prefs = getPreferenceValues<RaycastPreferences>();
  const workspace = useMemo(() => loadArclineWorkspace(prefs), [prefs]);

  const [spaceName, setSpaceName] = useState(workspace.spaces[0]?.name ?? 'Main');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [folderPath, setFolderPath] = useState('');

  const handleSubmit = async () => {
    try {
      addPinToSpaceBookmarks({ spaceName, url, title, folderPath }, prefs);
      await showToast({
        style: Toast.Style.Success,
        title: 'Pinned to Arcline',
        message: `${title.trim() || url.trim()} → ${spaceName}`,
      });
      await popToRoot();
    } catch (err) {
      await showToast({
        style: Toast.Style.Failure,
        title: 'Failed to save pin',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Pin to Space" onSubmit={() => void handleSubmit()} />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="spaceName" title="Space" value={spaceName} onChange={setSpaceName}>
        {workspace.spaces.map((sp) => (
          <Form.Dropdown.Item key={sp.name} value={sp.name} title={sp.name} />
        ))}
      </Form.Dropdown>
      <Form.TextField
        id="url"
        title="URL"
        placeholder="https://example.com"
        value={url}
        onChange={setUrl}
      />
      <Form.TextField
        id="title"
        title="Title (optional)"
        placeholder="Example Site"
        value={title}
        onChange={setTitle}
      />
      <Form.TextField
        id="folderPath"
        title="Folder Path (optional)"
        placeholder="Engineering/Docs"
        value={folderPath}
        onChange={setFolderPath}
      />
    </Form>
  );
}
