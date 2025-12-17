## Spaces Service Layer

## 1. Background refactor

- [x] 1.1 Define `SpaceState` type and storage helpers in `src/background/services/spaces.ts`（実装済み）
- [x] 1.2 Implement `getSpacesSnapshot` using `SpaceState[]` + Chrome tab/tabGroups APIs (browser.ts に実装済み)
- [x] 1.3 Wire `getSpacesSnapshot` into `background/index.ts` handlers（Bridge 経路 & 既存 command 経路、統合済み）
- [x] 1.4 Add deterministic unit tests for `getSpacesSnapshot`（space-navigation.spec.ts で実装済み）

## 2. Space operations

- [x] 2.1 Implement `createSpace(name, color)` using tabGroups + `SpaceState`（browser.ts に実装済み）
- [x] 2.2 Implement `removeSpace(spaceId)` with tabs + bookmarks cleanup + SpaceState 更新 (browser.ts に実装済み)
- [x] 2.3 Implement `moveTabToSpace({ tabId, spaceId, pinned? })` and `toggleTabPinned(tabId, pinned?)` (browser.ts に実装済み)
- [x] 2.4 Ensure all operations update `SpaceState[]` and broadcast updated snapshots (`broadcastSpacesSnapshot` 実装済み)

## 3. Bridge & hooks

- [ ] 3.1 Align `ServiceWorkerBridge` methods and background handlers（payload/response shape を統一）
- [ ] 3.2 Update `use-spaces-query` hooks to rely solely on Bridge-backed operations
- [ ] 3.3 Deprecate or simplify `useSpacesSync` / `requestSpacesSnapshot` in favor of the new API

## 4. UI integration

- [ ] 4.1 Update `SpaceManager` to:
- [ ]     - Always display header + "+ New" button（エラー/ローディング時も）
- [ ]     - Render loading/error states inline below the header
- [ ]     - Use `useSpacesSnapshot` results as the single source of truth
- [ ] 4.2 Adjust E2E tests (`space-management.spec.ts`, `simple-space-test.spec.ts`) to new behaviors

## 5. QA & cleanup

- [ ] 5.1 Run `pnpm check`, `pnpm test`, `pnpm test:e2e`
- [ ] 5.2 Remove or archive obsolete legacy code paths related to Spaces
- [ ] 5.3 Update developer docs / README sections referencing old Spaces behavior

## Extension Layering

## 1. Implementation

1.1 Service Worker エントリポイント（`src/background/index.ts`）の責務を棚卸しし、移動単位（router / listeners / handlers / init）を確定する
1.2 handlers の定義を分割できる構造へ移行する（export で合成し、外部 I/F は維持する）
1.3 tabs/windows/tabGroups 等のイベント購読を listeners モジュールへ移動し、エントリポイントから分離する
1.4 `chrome.*` 直接参照を段階移行できる最小の adapter 層を導入する（注入可能な依存境界）
1.5 content script の責務を「DOM 注入・ライフサイクル制御」と「React mount」に分割できる構造へ寄せる（挙動は維持する）
1.6 設定（Settings）の永続化を `chrome.storage.local` に統一し、必要に応じて初回のみ `chrome.storage.sync` から移行する

## 2. Testing / Verification

2.1 既存ユニットテストが落ちないこと
2.2 既存 E2E（必要範囲）が落ちないこと

## 3. Quality Gate

3.1 `just check` を実行し、lint/format/typecheck/test が通ること

## 4. Documentation

4.1 本 Change の delta spec を更新し、責務分離とテスト容易性の要件を明文化する
4.2 `openspec validate refactor-extension-layering --strict` をパスさせる

## MV3 E2E Stability

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

## Background Reliability

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
