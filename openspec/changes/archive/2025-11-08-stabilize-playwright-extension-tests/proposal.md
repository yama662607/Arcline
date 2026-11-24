# 変更提案: Playwright E2E テスト環境の安定化

## Change ID
`stabilize-playwright-extension-tests`

## 概要
- Chrome 拡張 (Manifest V3) の E2E を担う Playwright セットアップを段階的に刷新し、初期状態の不一致と flake の根本原因を排除する。
- `chromium.launchPersistentContext` から取得した service worker ハンドルを用いて UI モードや storage を決定論的に初期化し、「Control State, Then Act」原則をテスト全体で徹底する。
- Shadow DOM を含む操作を Playwright ネイティブのロケーター／アクションに統一し、`page.evaluate` と手動ポーリングを削減することで actionability checks を活かす。
- サービスワーカーの console/crash をログへ転送し、trace 収集・artifact 化を標準化して診断可能性を高める。
- 将来的に TanStack Query や fallback UI をテストへ広げられるよう、fixtures・config・docs を再利用可能な形に整備する。

## Why
- 現状の `floating.spec.ts` は DOMContentLoaded 直後にコンテンツスクリプトが UI を teardown する決定論的バグの影響を受け、テスト前に `window.__arclineFloatingReady` が false へ戻される。
- `page.evaluate` + `dispatchEvent` で Shadow DOM を直接操作しており、Playwright の auto-waiting や actionability を活かせず再現性が低い。
- サービスワーカーのログや trace.zip が取得できず、失敗時の根本原因が追跡しづらい。
- `refactor-react-migration` のタスク 4.4 が「Vitest / Playwright テスト体制整備」として残っているが、仕様が不足しているため progress を測れない。

## スコープ
### In Scope
- `apps/extension/playwright/fixtures.ts` および `playwright.config.ts` を拡張し、service worker 初期化・ストレージ書き込み・ログ転送・trace 収集を標準化する。
- `apps/extension/playwright/e2e/floating.spec.ts` から開始し、テスト実装を Web-first API へ置き換える指針と共通ユーティリティを追加する。
- `docs/testing/playwright.md`（新設）でランブックとトラブルシュート手順を openspec 準拠で記述する。
- `pnpm test:e2e`（turbo 経由）を `check/test/build` ルーティンと CI に組み込み、trace artifact の保存手順を定義する。

### Out of Scope
- TanStack Query や fallback UI 自体の実装（本 change ではテスト基盤のみ）。
- Firefox/Safari 向け E2E（Chromium + Chrome 拡張動作確認に絞る）。
- Playwright 以外の E2E ツール導入。

## 影響
- **開発者**: `pnpm test:e2e` で常に決定論的な初期状態が得られ、ログ/trace を利用したデバッグが容易になる。Shadow DOM もロケーター経由で統一操作できる。
- **CI**: Playwright 実行時間は少し増加するが、失敗時に artifact が残ることでリトライや flake 調査コストを削減できる。
- **変更管理**: `refactor-react-migration` のテストタスクは本 change に依存し、明確な完了条件を持つようになる。

## リスク / 依存関係
- Service worker 初期化の追加ロジックが拡張そのものに副作用を与えないよう、`chrome.storage.local` のキー衝突やレースに注意する必要がある。
- Trace 常時取得はディスク容量を圧迫する可能性があるため、CI では `retain-on-failure` を基本としつつローカル debug 用に `on` を許可する運用を設計する。
- `pnpm build`（拡張 dist）が存在しない場合に Playwright を起動できない現状は維持するため、ドキュメントで前提手順を明記する。
