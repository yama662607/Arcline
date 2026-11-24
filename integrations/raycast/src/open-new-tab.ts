import { closeMainWindow, getPreferenceValues, showToast, Toast } from '@raycast/api';
import { openNewTabInBrowser, type RaycastPreferences } from './lib/arcline';

export default async function OpenNewTabCommand() {
  const prefs = getPreferenceValues<RaycastPreferences>();
  try {
    await closeMainWindow();
    await openNewTabInBrowser(prefs.browser);
  } catch (err) {
    await showToast({
      style: Toast.Style.Failure,
      title: 'Could not open Arcline New Tab',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
