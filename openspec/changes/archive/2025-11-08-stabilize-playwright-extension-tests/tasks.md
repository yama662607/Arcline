## 1. フィクスチャ基盤
- [x] 1.1 `apps/extension/playwright/fixtures/extension.ts`（仮名）を追加し、`chromium.launchPersistentContext` で service worker ハンドル取得・`chrome.storage.local` 初期化・`context.clearCookies()` をワンショット関数にまとめる
- [x] 1.2 既存 `../fixtures.ts` を拡張し、上記ヘルパーを `test.extend` から利用できるようにして `test.beforeEach` で `UI_MODE_KEY='floating'` を保証する
- [x] 1.3 `playwright.config.ts` に `testIdAttribute: 'data-testid'`, `use.trace` ポリシー, `projects` など設定変更を追加し、Shadow DOM 操作・trace収集を標準化する

## 2. テスト実装更新
- [x] 2.1 `apps/extension/playwright/e2e/floating.spec.ts` をロケーター + `locator.hover()` + `expect(locator).toBeVisible()` へ書き換え、`page.evaluate` ベースの dispatch/ポーリングを撤廃する
- [ ] 2.2 `popup.spec.ts` など他の E2E も順次ロケーター化し、Shadow DOM traversal をヘルパー経由に置き換える
- [ ] 2.3 必要に応じ `page.addInitScript` で chrome.runtime モックを行う最終手段を実装し、利用時は `test.step` / annotation で理由をログする

## 3. 可観測性とトレース
- [ ] 3.1 service worker からの `console` / `crash` イベントを Playwright ログ・`test.info().annotations` に反映させるユーティリティを追加する
- [ ] 3.2 `trace: 'retain-on-failure'`（CI）/`'on'`（ローカル debug）を実装し、`pnpm test:e2e` 後に trace.zip を artifacts へアップロードする CI ジョブを更新する
- [ ] 3.3 失敗時に `npx playwright show-trace` で確認する手順とログ保存先を runbook に追記する

## 4. ドキュメント & ワークフロー
- [ ] 4.1 `docs/testing/playwright.md` を新設し、ビルド前提・フィクスチャ構造・状態初期化手順・トラブルシューティングを openspec に沿って記述する
- [ ] 4.2 `package.json` / Turbo pipeline / CI に `pnpm test:e2e` を追加し、`pnpm check && pnpm test && pnpm build` の順序と trace 保存を必須手順として書面化する
- [ ] 4.3 `refactor-react-migration` の tasks (4.4) に当 change への依存を注記し、完了条件を連携する

## 5. バリデーション
- [ ] 5.1 `pnpm build` → `pnpm test:e2e` をローカルで実行し、service worker ログと trace が採取されることを確認する
- [ ] 5.2 `openspec validate stabilize-playwright-extension-tests --strict` を通過させる
