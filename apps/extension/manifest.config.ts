import { defineManifest } from '@crxjs/vite-plugin';

const manifest = defineManifest(({ mode }) => {
  const isDev = mode === 'development';

  return {
    manifest_version: 3,
    name: isDev ? 'Arcline (Dev)' : 'Arcline',
    description: 'Arc ブラウザ風の垂直タブ体験を Atlas / Arc / Chrome で提供する拡張機能',
    version: '0.0.1',
    action: {
      default_title: 'Arcline',
      default_icon: {
        '128': 'icons/icon-128.png',
      },
      default_popup: 'popup.html',
    },
    icons: {
      '16': 'icons/icon-128.png',
      '48': 'icons/icon-128.png',
      '128': 'icons/icon-128.png',
    },
    background: {
      service_worker: 'src/background/index.ts',
      type: 'module',
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['src/content-scripts/floating-ui.ts'],
        run_at: 'document_idle',
      },
      {
        matches: ['<all_urls>'],
        js: ['src/content-scripts/sidebar-manager.ts'],
        run_at: 'document_idle',
      },
    ],
    side_panel: {
      default_path: 'index.html',
    },
    options_page: 'options.html',
    permissions: ['tabs', 'tabGroups', 'bookmarks', 'storage', 'sidePanel', 'commands'],
    host_permissions: ['<all_urls>'],
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Ctrl+E',
          mac: 'Command+E',
        },
        description: 'Open Arcline side panel',
      },
      quickPinToggle: {
        suggested_key: {
          default: 'Ctrl+D',
          mac: 'Command+D',
        },
        description: 'Quick pin or unpin the active tab',
      },
    },
    web_accessible_resources: [
      {
        resources: ['index.html', 'popup.html', 'options.html', 'assets/*', 'icons/*'],
        matches: ['<all_urls>'],
      },
    ],
  };
});

export default manifest;
