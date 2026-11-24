## Why

Playwright E2E テストで 7 件のテストがスキップされており、そのうち dnd-kit ドラッグ＆ドロップ機能に関するテストが `test.fixme` でマークされていた。dnd-kit の PointerSensor は HTML Drag and Drop API ではなく独自のポインターイベントを使用するため、Playwright の標準 `dragTo()` メソッドでは動作しなかった。

## What Changes

- dnd-kit の PointerSensor に対応したカスタムドラッグ＆ドロップ実装を追加
- アクティベーション制約（distance: 8px）を超える移動ロジックを実装
- `steps` オプションを使用して適切な `pointermove` イベント発火を保証
- `index.html`（DndContext あり）を使用するようテストを修正
- 全 27 テストが合格するようにテストスイートを修正

## Impact

- Affected specs: Testing, E2E Testing
- Affected code: playwright/e2e/\*.spec.ts, playwright/fixtures/
- Result: 27 passed, 0 skipped (以前は 20 passed, 7 skipped)
