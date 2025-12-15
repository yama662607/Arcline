## Why

Floating UI をデフォルトとして提供する方針において、同一タイミングで

- Web ページ上の Floating UI（content script）
- Side Panel / Popup（extension page）
  が同時に起動すると、React/Query のツリーが二重に立ち、メモリ消費・CPU・ネットワーク（refetch）が増加します。
  また、ユーザー体験としても「どちらが本体か分からない」状態になり得ます。

本変更は UI surface を常に 1 つに保ち（single surface）、Floating をデフォルトとした上で、Side Panel と同時表示されないことを厳密に保証します。

## What Changes

- Floating UI をデフォルトの UI モードとして扱う（設定未保存でも floating）
- UI モードの決定を background を single source of truth として統一する
- モード切替時に、不要な UI surface を確実に teardown する（同時表示ゼロ）
- `App.tsx`（extension page 側）は side-panel UI のみ担当し、floating の場合は本 UI を描画しない
- パフォーマンス最優先として、Floating の起動は lazy import + 必要時 mount を維持する

## Impact

- Affected specs:
  - background-services
  - extension-shell
  - floating-sidebar
- Affected code:
  - apps/extension/src/background/index.ts
  - apps/extension/src/lib/ui-mode.ts
  - apps/extension/src/content-scripts/floating-ui.ts
  - apps/extension/src/App.tsx

## Non-Goals

- UI の見た目/デザイン刷新（最小限の表示切替のみに留める）
- 新規機能追加（Spaces/Pin/Archive の仕様拡張はしない）
- iframe による extension page の埋め込み（性能/実装複雑度の観点で今回は採用しない）
