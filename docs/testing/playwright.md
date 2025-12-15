# Playwright E2E テストガイド

Chrome 拡張 (Manifest V3) の E2E テストは `extension/playwright` に配置されています。拡張 dist を読み込んだ Chromium を `chromium.launchPersistentContext` で起動し、service worker を介して状態を決定論的に初期化します。

## 前提条件

- 依存関係をインストール: `pnpm install`
- 拡張をビルド: `pnpm --filter arcline-extension build`
  - `pnpm --filter arcline-extension test:e2e` は内部で `pnpm build` を実行しますが、初回は明示的にビルドして dist の存在を確認してください。

## 実行コマンド

### すべての E2E を実行

```bash
pnpm --filter arcline-extension test:e2e
```

- デフォルトは headless 実行です。macOS では Crashpad の制約で headless がクラッシュする場合があるため、`PLAYWRIGHT_HEADLESS=0` を付与してウィンドウを表示した状態で実行することを推奨します。
- `PWDEBUG=console` で devtools を開いたままデバッグできます。

### 単一テスト

```bash
pnpm --filter arcline-extension exec playwright test e2e/floating.spec.ts --project=chromium
```

## 状態初期化フロー

`extension/playwright/fixtures.ts` が以下を自動で行います。

1. `chromium.launchPersistentContext` 起動後に拡張 service worker を待機。
2. `test.beforeEach` 時に `context.clearCookies()` を呼び、`serviceWorker.evaluate` で `chrome.storage.local.clear()` → `UI_MODE_KEY = 'floating'` を書き込み。
3. service worker の `console` / `crash` イベントを `[SW][<testId>] ...` 形式で stdout と `test.info().annotations` に出力。

これにより、`page.goto` を呼び出す前に常に `'floating'` モードがセットされ、Chrome storage の残骸に左右されません。

## ロケーターとアサーション

- Shadow DOM を横断するため、`playwright.config.ts` で `testIdAttribute: 'data-testid'` を設定しています。
- `page.getByTestId('arcline-floating-hotzone')`, `await hotzone.hover()`, `await expect(panel).toBeVisible()` といった web-first パターンを必須とし、`page.evaluate` や `dispatchEvent` での pointer 操作は使用禁止です。

## トレースとログの収集

- `use.trace` は CI で `retain-on-failure`, ローカルで `on` に固定しています。trace は `extension/playwright/test-results/` に保存されます。
- 失敗時にトレースを確認するには:
  ```bash
  npx playwright show-trace extension/playwright/test-results/<test-name>-trace.zip
  ```
- サービスワーカーのログは `[SW][<testId>]` で標準出力と Playwright annotations に記録されるため、CI ログから状態遷移を追跡できます。

## フォールバックモックの利用

`serviceWorker.evaluate` で状態注入できないタブ種別をテストする場合のみ、`mockRequestUiMode(mode, reason)` フィクスチャを使って `chrome.runtime.sendMessage` をモックできます。

1. テスト冒頭で `await mockRequestUiMode('popup', 'chrome:// での fallback を検証')` のように呼び出します。
2. フィクスチャが `page.addInitScript` で `requestUiMode` のレスポンスを差し替え、`test.step` と annotation へ理由を自動で記録します。
3. テスト終了時にオリジナルの `chrome.runtime.sendMessage` へ復元します。

このモードは最終手段であり、通常は service worker を経由した実状態制御を優先してください。

## CI / check 流れ

- `pnpm check && pnpm test && pnpm build` に続けて `pnpm test:e2e` を実行し、trace artifacts をアップロードします（`extension/playwright/test-results/**.zip` を保存）。
- GitHub Actions 等の CI でも `pnpm --filter arcline-extension test:e2e` を追加し、失敗時は artifact を `actions/upload-artifact` で共有してください。

## トラブルシューティング

| 症状                                    | 対処                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `Chrome 拡張の dist/ が見つかりません`  | `pnpm --filter arcline-extension build` を再実行し、`extension/dist/manifest.json` が存在するか確認                                        |
| `service worker を取得できませんでした` | ブラウザを閉じ、`pnpm test:e2e` を再走行。`dist/` 配下の `background/index.js` がエラーを出していないかログを確認                          |
| `trace.zip が生成されない`              | `extension/playwright/playwright.config.ts` の `use.trace` 設定が上書きされていないか、`PLAYWRIGHT_TRACE_DIR` をカスタムしていないかを確認 |

このドキュメントは `openspec/changes/stabilize-playwright-extension-tests` の要件に基づき、最新仕様に合わせて随時更新してください。
