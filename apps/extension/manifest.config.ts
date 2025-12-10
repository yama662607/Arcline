import { defineManifest } from '@crxjs/vite-plugin';

const manifest = defineManifest(({ mode }) => {
  const isDev = mode === 'development';
  const isTest = mode === 'test' || process.env.NODE_ENV === 'test';

  const manifestBase = {
    manifest_version: 3,
    name: isDev ? 'Arcline (Dev)' : 'Arcline',
    description: 'Arc ブラウザ風の垂直タブ体験を Atlas / Arc / Chrome で提供する拡張機能',
    version: '0.0.1',
    action: {
      default_title: 'Arcline',
      default_icon: {
        '128': 'icons/icon-128.png',
      },
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
      // Temporarily disabled for testing
      // {
      //   matches: ['<all_urls>'],
      //   js: ['src/content-scripts/sidebar-manager.ts'],
      //   run_at: 'document_idle',
      // },
    ],
    // Temporarily disabled for testing
    // side_panel: {
    //   default_path: 'index.html',
    // },
    // options_page: 'options.html',
    permissions: [
      'tabs',
      'tabGroups',
      'bookmarks',
      'storage',
      'history',
      // 'sidePanel', // Temporarily disabled for testing
      'commands',
      'alarms',
      'contextMenus',
    ],
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
      toggleCommandPalette: {
        suggested_key: {
          default: 'Ctrl+Shift+K',
          mac: 'Command+Shift+K',
        },
        description: 'Toggle Command Palette',
      },
    },
    web_accessible_resources: [
      {
        resources: ['index.html', 'options.html', 'popup.html', 'assets/*', 'icons/*'],
        matches: ['<all_urls>'],
      },
    ],
  };

  if (isTest && process.env.ARCLINE_TEST_EXTENSION_KEY) {
    (manifestBase as { key?: string }).key = process.env.ARCLINE_TEST_EXTENSION_KEY;
  }

  return manifestBase;
});

export default manifest;
