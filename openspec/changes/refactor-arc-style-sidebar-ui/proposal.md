## Why

現状の Arcline UI には `Spaces / Archive / Settings` のタブ切り替えが存在し、Arc 本家の「スペース中心で常時表示されるワークスペース」体験に対して、

- アーカイブや設定への到達が「別タブ」に分断される
- 最近追加した機能（Bookmark Import 等）への導線が分かりづらい
- スペース間整理のための「Move to」導線が pinned item（ピン留めタブ/フォルダ）に不足している

という課題がある。

本変更では、Arc らしい導線（More/コンテキストメニュー起点）と、ウィンドウ（モーダル）表示の補助サーフェスで、UI を統一する。

## What Changes

- pinned item（Pinned Tab / Pinned Folder）のコンテキストメニューに `Move to Space >` を追加する
  - 移動先は **選択したスペースの pinned items ルート**（A 案）とする
  - 対象: pinned tab / pinned folder
- `Spaces / Archive / Settings` のタブ UI を廃止し、Arc 風のナビゲーションへ再構成する（**BREAKING**）
  - 通常状態では常に Spaces（タブ管理サーフェス）を表示する
  - `…`（More）メニューから `Settings / Archive / Bookmark Import` へ到達できる
  - 同等の導線を Space のコンテキストメニューからも提供する
- `Settings / Archive / Bookmark Import` を「ページ/タブ」ではなく **ウィンドウ（モーダル）** として表示する
  - sidepanel / floating の両 UI モードに適用する

## Impact

- Affected specs:

  - `context-menu`（pinned item の Move to、Space menu からの導線）
  - `navigation`（タブ UI 廃止、More + モーダルウィンドウ導線）

- Affected code (予定):
  - `extension/src/ui/components/SpacesWorkspace.tsx`（タブ UI 廃止、More メニュー、ウィンドウ表示の統合）
  - `extension/src/ui/components/SearchBar.tsx`（`…` メニュー導線の追加）
  - `extension/src/ui/components/PinnedItemContextMenu.tsx`（Move to Space の追加、必要なら Radix 化）
  - `extension/src/ui/components/context-menu/SpaceContextMenu.tsx`（Settings/Archive/Import への導線追加）
  - `extension/src/ui/components/SettingsPanel.tsx`（ウィンドウ表示・Import 直行などの調整）
  - `extension/src/ui/components/ArchiveManager.tsx`（ウィンドウ表示の調整）
  - `extension/playwright/e2e/*`（ナビゲーション変更に伴う導線更新）

## Open Questions

- `Bookmark Import` は「Settings ウィンドウ内の Import タブ」へ直接遷移する形にするか、独立したウィンドウにするか？
- `…` メニューの配置（SearchBar 右端 / Workspace ヘッダー等）をどこに固定するか？（実装で統一する）
