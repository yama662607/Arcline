## 1. Manifest / ビルド設定

- [ ] 1.1 テスト用拡張キー (PEM → base64 公開鍵) の生成手順を docs にまとめ、リポジトリ管理ポリシーを決める
- [ ] 1.2 `manifest.config.ts` / `vite.config.ts` に `NODE_ENV` / `import.meta.env.MODE` による分岐を追加し、テストビルド時のみ manifest の `key` を注入する
- [ ] 1.3 本番ビルド (`production`) で `key` が出力されないことを確認する

## 2. Service Worker (background/index.ts)

- [ ] 2.1 `background-services` spec の要件に沿った、test 環境限定の Keep-Alive 方針を確定する（API 選定・間隔・副作用）
- [ ] 2.2 `background/index.ts` に test 専用のハートビート処理を追加し、本番ビルドでは実行されないようガードを入れる
- [ ] 2.3 `initializeUiMode` / `initializeAutoArchive` / gesture 初期化との相互作用を確認し、ログとエラーハンドリング方針を整理する

## 3. Playwright フィクスチャ

- [ ] 3.1 `playwright/fixtures/extension.ts` から Service Worker 依存の `resolveExtensionId` ロジックを削除する
- [ ] 3.2 固定拡張 ID を 1 箇所に定義し、`extensionId` フィクスチャはそれを返すだけにする
- [ ] 3.3 `waitForExtensionServiceWorker` を「ログ・デバッグ用途」に限定し、E2E 全体の成否が SW 起動状態に依存しないようにする
- [ ] 3.4 `playwright.config.ts` の `timeout` などを見直し、MV3 + Keep-Alive 前提で E2E が安定して完走する閾値を設定する

## 4. Spec / テスト

- [ ] 4.1 `openspec/specs/platform/spec.md` に拡張 ID / ビルドモード差分の要件を追加する (ADDED Requirements)
- [ ] 4.2 `openspec/specs/background-services/spec.md` に MV3 testability / Keep-Alive 要件を追加する (ADDED Requirements)
- [ ] 4.3 変更後挙動をカバーするテストを追加する
  - 拡張 ID が期待どおり固定値であること
  - test 環境で SW がテスト中に予期せず terminate されにくくなっていること（ログベースで確認）
- [ ] 4.4 `pnpm check` / `pnpm test:e2e` を通し、`openspec validate stabilize-mv3-e2e-service-worker --strict` をパスさせる
