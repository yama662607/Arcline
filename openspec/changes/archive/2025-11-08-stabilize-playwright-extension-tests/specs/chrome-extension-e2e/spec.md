## ADDED Requirements

### Requirement: Deterministic Extension State Setup
Playwright の Chrome 拡張テストは、`page.goto` を実行する前に service worker を介して UI モードと拡張ストレージを決定論的に初期化しなければならない (**MUST** initialize deterministically before navigation).

#### Scenario: UI_MODE_KEY を beforeEach で固定
- **GIVEN** `apps/extension/playwright/fixtures.ts` が persistent context を起動し、service worker ハンドルを取得している
- **WHEN** `test.beforeEach` が走る
- **THEN** フィクスチャは `serviceWorker.evaluate(() => chrome.storage.local.set({ [UI_MODE_KEY]: 'floating' }))` を await してから `page.goto` を許可し
- **AND** `window.__arclineFloatingReady` が false に戻される競合が再発しないよう、テスト開始時点で hotzone UI が 'floating' モードで初期化される

#### Scenario: 前回実行の残骸をクリア
- **GIVEN** 直前のテストが `chrome.storage.local` や `localStorage` に値を残している
- **WHEN** フィクスチャが新しいテスト用 context を準備する
- **THEN** `context.clearCookies()` と `serviceWorker.evaluate(() => chrome.storage.local.remove([...keys]))` を実行し、テストごとに空の状態から開始する

### Requirement: Web-first Interaction Patterns
Shadow DOM / hotzone 操作は Playwright のロケーターと actionability checks を利用し、手動の `page.evaluate` や `dispatchEvent` へフォールバックしてはならない (**MUST** rely on web-first APIs).

#### Scenario: Hotzone hover は locator.hover()
- **GIVEN** `floating.spec.ts` が `page.getByTestId('arcline-floating-hotzone')` を参照できる
- **WHEN** テストがホットゾーン hover をトリガーする
- **THEN** `await hotzone.hover()` を使用し
- **AND** そのロケーターは DOM アタッチ・可視性・pointer-events を自動的に待機する

#### Scenario: 可視性確認は expect(locator).toBeVisible
- **GIVEN** フローティングパネルの存在を検証する
- **WHEN** テストが表示状態を assert する
- **THEN** `await expect(page.getByTestId('arcline-floating-panel')).toBeVisible({ timeout: 15_000 })` を利用し、`expect.poll` + `page.evaluate` で CSS を手動チェックしない

### Requirement: Service Worker Observability
サービスワーカーのログと trace を Playwright 実行結果に組み込み、失敗時に診断できる状態を維持しなければならない (**MUST** surface SW logs/traces).

#### Scenario: console/crash ログを転送
- **GIVEN** フィクスチャが service worker ハンドルを保持している
- **WHEN** service worker が `console.log` / `console.error` / `crash` を発生させる
- **THEN** イベントは Playwright の `test.info().annotations` または stdout に `[SW]` プレフィックス付きで出力され、CI ログにも残る

#### Scenario: trace.zip を常に取得
- **GIVEN** `playwright.config.ts` が `use.trace` を設定している
- **WHEN** テストが CI で失敗する
- **THEN** trace は `'retain-on-failure'` ポリシーで生成され、GitHub Actions artifact に保存され、`docs/testing/playwright.md` に示すコマンドで閲覧できる

### Requirement: API モックは最終手段として記録
状態注入がどうしても不可能なケースでのみ `page.addInitScript` を使った API モックを許可し、利用理由をロギングしなければならない (**MUST** document fallback mocks).

#### Scenario: requestUiMode モックの記録
- **GIVEN** service worker 経由の storage 初期化が失敗するページ種別をテストする必要がある
- **WHEN** `page.addInitScript` で `chrome.runtime.sendMessage` をオーバーライドし `requestUiMode` を `'floating'` に強制する
- **THEN** テストは `test.step('mock requestUiMode', ...)` や annotation で理由と scope を記録し
- **AND** ラン完了後に `docs/testing/playwright.md` の手順に従いモック解除が検証される
