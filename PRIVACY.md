# Privacy Policy for Arcline

**Last Updated**: 2026-11-24  
*[日本語での概要は下部に記載しています / Japanese summary below](#privacy-ja)*

Arcline is a local-only, open-source browser extension for Chrome and Brave. We believe your tabs, bookmarks, and browsing history belong strictly on your device.

## 1. Data Collection

**Arcline does not collect, store on remote servers, transmit, or sell any personal data, browsing history, usage telemetry, or analytics.**

- **Zero external servers**: Arcline makes zero outbound network requests (`fetch`, `XMLHttpRequest`, `WebSocket`, or tracking beacons).
- **Zero third-party analytics**: Arcline does not use Google Analytics, Sentry, or third-party SDKs.
- **Minimal local-only edge-hover script**: Arcline runs a lightweight (~4.5 kB gzip) Vanilla JS script (`overlay.js`) on `http://*/*` and `https://*/*` pages solely to detect when your cursor hovers near the left edge of the window and display the local sidebar overlay. It never reads, scrapes, modifies, or transmits webpage contents, form inputs, passwords, or cookies. Left-edge hover can be disabled at any time in Settings.

## 2. How Data Is Stored Locally

All data remains strictly inside your browser profile on your local device:

- **Browser Bookmarks (`chrome.bookmarks`)**: Your Global Favorites, Spaces, pinned tabs, and nested folders are saved under `Other Bookmarks / Arcline`.
- **Browser History (`chrome.history`, Read-Only On-Demand)**: Queried locally inside your browser when you open or type in Arcline's Command Bar / New Tab page to merge recent and matching previously visited pages alongside open tabs, Favorites, and pinned items. History records never leave your browser and are not copied to external servers.
- **Local Extension Storage (`chrome.storage.local`)**: Stores preferences (theme, language, search engine, hover sensitivity, two-finger swipe toggle, onboarding completion flag), Space color themes/icons, open folder IDs, and locally auto-archived tab entries. Arcline does **not** use `chrome.storage.sync`.
- **Session Storage (`chrome.storage.session`)**: Holds ephemeral in-memory mappings between live tab IDs, Tab Group IDs, and bookmarked pins during the active browser session.

## 3. Permissions Used & Justifications

| Permission | Purpose |
| --- | --- |
| `sidePanel` | Displays the Arcline sidebar inside Chrome/Brave's native Side Panel on internal pages (`chrome://`, `brave://`) or via keyboard shortcut / toolbar icon. |
| `tabs` | Lists open tabs across windows, displays titles/URLs/audio states, focuses/switches tabs, mutes audio, and opens/closes tabs within Spaces. |
| `tabGroups` | Maps each Space to a native browser Tab Group so tabs remain organized per Space. |
| `bookmarks` | Persists Global Favorites, Spaces, pinned tabs, and nested folders under `Other Bookmarks / Arcline`. |
| `history` | Queries local browser history read-only inside the unified Command Bar New Tab page so users can jump back to past pages from one search box. Never transmitted off-device. |
| `storage` | Stores preferences, themes, open folder states, archive history (`chrome.storage.local`), and session tab bindings (`chrome.storage.session`) locally. |
| `alarms` | Runs periodic background checks every 30 minutes to auto-archive inactive temporary tabs without keeping a background page running. |
| `favicon` | Displays cached site favicons locally via the browser's built-in `_favicon` endpoint without contacting third-party servers. |
| `http://*/*`, `https://*/*` | Mounts the local left-edge hover trigger (`overlay.js`) and extension-origin sidebar overlay (`sidepanel.html`) when hovered. Never inspects page data. |

## 4. Arc Import, Export, CLI & Raycast Integrations

Importing Arc's `StorableSidebar.json`, exporting backups, using the optional local `arcline` CLI, or using the optional local Raycast Extension operates 100% locally on your machine's browser profile files with zero network telemetry.

## 5. Contact

Questions or privacy inquiries: https://github.com/yama662607/Arcline/issues

---

<a id="privacy-ja"></a>
## プライバシーポリシー概要（日本語）

- **データ収集・外部送信ゼロ**: Arcline は外部サーバーへの通信、アクセス解析、トラッキング、データ販売を一切行いません。
- **履歴権限（`history`）の用途**: 新規タブの統合コマンドバーで過去の閲覧履歴をその場で絞り込み検索するためだけにブラウザ内部で読み取り専用参照し、外部へ送信・保存することはありません。
- **ブックマーク・ローカル保存**: Favorites・Spaces・ピン留め・テーマ設定・自動アーカイブはすべてお使いの端末内の `chrome.bookmarks` および `chrome.storage.local` / `session` に保存されます。
- **お問い合わせ**: https://github.com/yama662607/Arcline/issues
