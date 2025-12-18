## Context

- 本変更は Arc 風 UI/UX を目的として、ワークスペースのナビゲーションを刷新する。
- 既存実装には `Spaces / Archive / Settings` のタブ UI が存在し、Archive/Settings が「別ページ」化している。
- pinned item（ブックマーク同期の pinned tab / folder）には Move to Space の導線が不足している。

## Goals / Non-Goals

- Goals:

  - pinned item（Pinned Tab / Pinned Folder）に `Move to Space >` を提供する
  - `Spaces / Archive / Settings` タブ UI を廃止し、Spaces を常時表示にする
  - `…`（More）メニュー + Space context menu の両方から Settings/Archive/Bookmark Import に到達できる
  - Settings/Archive/Bookmark Import をモーダルとして表示する（sidepanel/floating 両対応）

- Non-Goals:
  - `Move to` の移動先フォルダ選択（階層メニュー）は今回行わない
  - pinned item の rename UI の刷新（prompt の置き換え）は必要最小限とする

## Decisions

- Decision: Move to Space の移動先

  - pinned item の移動先は「選択したスペースの pinned items ルート」とする（A 案）。

- Decision: ナビゲーション導線

  - 主要導線は `…`（More）メニュー。
  - 追加導線として Space context menu にも同等の項目を設ける。

- Decision: モーダル実装
  - `@radix-ui/react-dialog` を用いて modal window を実装し、Escape/背景クリックで閉じられることを担保する。

## Risks / Trade-offs

- `Spaces / Archive / Settings` タブ UI 廃止により、既存 E2E の selector が破綻する。

  - 対応: `…` / context menu を起点とする導線で E2E を更新する。

- pinned item のコンテキストメニューが既存で非 Radix の可能性がある。
  - 対応: 実装時に Radix 統一を検討し、アクセシビリティを確保する。

## Migration Plan

- UI の表示方式を変更するが、データ（spaces snapshot, pinned items, settings, archive）形式は変更しない。
- 既存の操作（Archive/Settings）への到達は `…` / context menu に移管する。

## Open Questions

- Bookmark Import は独立モーダルか、Settings モーダル内の Import タブへの deep link か？
- `…` メニューを SearchBar 右端に置くか、Workspace ヘッダーに置くか？
