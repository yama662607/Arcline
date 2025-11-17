## 1. Specification

- [x] 1.1 既存の background-services スペックを確認する
- [x] 1.2 UI モード配信・ジェスチャー連動・コマンドエラー要件を追記する

## 2. Implementation

- [x] 2.1 broadcastUiMode / commandHandlers のユニットテストを追加
- [ ] 2.2 ServiceWorkerBridge との統合テストを追加
- [ ] 2.3 E2E (Playwright) シナリオを拡張して gesture + UI mode を検証
- [ ] 2.4 追加テストに合わせてドキュメント・CI を更新

## 3. Validation

- [ ] 3.1 openspec validate enhance-background-reliability --strict
- [ ] 3.2 pnpm check && pnpm test && pnpm test:e2e
