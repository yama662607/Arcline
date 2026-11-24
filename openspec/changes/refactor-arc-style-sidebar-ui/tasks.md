## 1. Implementation

1.1 pinned item のコンテキストメニューに `Move to Space >` を追加する

- 1.1.1 `PinnedItemContextMenu` へ `Move to Space` サブメニューを追加する（Pinned Tab / Pinned Folder）
- 1.1.2 選択したスペースの pinned items ルートへ移動する（A 案）
- 1.1.3 移動後に UI が最新化する（spaces snapshot / pinned items の再取得）

  1.2 `Spaces / Archive / Settings` タブ UI を廃止し、Spaces を常時表示にする（**BREAKING**）

- 1.2.1 `SpacesWorkspace`（sidepanel/floating）から tab navigation を削除する
- 1.2.2 Archive/Settings は別導線（More/ContextMenu）から開く

  1.3 `…`（More）メニューを追加し、Settings/Archive/Bookmark Import へ到達できるようにする

- 1.3.1 `SearchBar` もしくは Workspace ヘッダーに `…` ボタンを追加する（アイコン乱立はしない）
- 1.3.2 `…` メニューから Settings / Archive / Bookmark Import を開ける

  1.4 Space のコンテキストメニューからも Settings/Archive/Bookmark Import に到達できるようにする

- 1.4.1 `SpaceContextMenu` に上記項目を追加する

  1.5 Settings / Archive / Bookmark Import をウィンドウ（モーダル）表示にする

- 1.5.1 sidepanel / floating の両方で同一 UX で開閉できる
- 1.5.2 Escape / 背景クリックで閉じられる

  1.6 テストを追加/更新する

- 1.6.1 Playwright: 旧タブ UI に依存していた導線を `…` / context menu に変更
- 1.6.2 必要に応じて smoke test（Settings/Archive が開く）を追加

  1.7 品質ゲート

- 1.7.1 `pnpm openspec validate refactor-arc-style-sidebar-ui --strict`
- 1.7.2 `just check`

## 2. Approval Gate

2.1 proposal.md / specs の差分をレビューしてもらい、実装着手の承認を得る
