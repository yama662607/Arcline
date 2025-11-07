## Why
- Floating UI ホットゾーンは押下時の視覚フィードバックやフォーカス可視化が不足しており、アクセシビリティ面で改善の余地があります。
- `getSpacesSnapshot` はタブ配分ロジックが複雑なため、回帰を防ぐための自動テストが不足しています。

## What Changes
- ホットゾーンに押下・キーボード操作時の視覚的フィードバック、ARIA 設定、フォーカスリングを追加し、アクセシビリティ要件を明文化・実装します。
- `getSpacesSnapshot` を対象に、Chrome API モックを用いたユニットテストを整備し、グループ分配や未分類タブ処理の期待値を検証します。
- テスト体制を踏まえて、必要なヘルパーやモックセットアップを共通化します。

## Impact
- Affected specs: floating-sidebar, background-services
- Affected code: apps/extension/src/floating/mount.tsx, apps/extension/src/floating/FloatingApp.tsx, apps/extension/src/background/services/browser.ts, 新規/変更されるテストユーティリティ
