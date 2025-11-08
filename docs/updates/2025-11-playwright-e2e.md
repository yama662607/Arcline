# 2025-11 Playwright E2E Improvements

## 状態初期化が原因だった理由と対策
- フローティング UI はコンテンツスクリプト `floating-ui.ts` が DOMContentLoaded 直後に `requestUiMode` を問い合わせ、`'floating'` 以外が返ると即座に teardown して `window.__arclineFloatingReady = false` に戻す実装になっていた。
- Playwright の persistent context では前回テストの `chrome.storage.local` が残り、UI モードが `'popup'` や `'side-panel'` のままになるため、テストが `window.postMessage` を送る時点でホットゾーンが存在しない状態に戻っていた。
- 対策として `fixtures/extension.ts` で service worker ハンドルを確実に取得し、`ensureUiMode` で `chrome.storage.local.clear()` → `set({ arclineoMode: 'floating' })` をテストごとに実行。これによりコンテンツスクリプトが常に `'floating'` を受け取り、ホットゾーンが teardown されなくなった。

## Playwright フィクスチャの再構築
- `launchExtensionContext()` を追加し、Chromium を persistent profile + `--load-extension` で起動する責務を分離。
- `waitForExtensionServiceWorker()` と `attachServiceWorkerLogging()` で service worker の console/crash を `[SW][<testId>]` 形式で stdout/annotations に流す。失敗時の原因が追いやすくなった。
- `mockRequestUiMode()` フィクスチャを追加し、`page.addInitScript` で `chrome.runtime.sendMessage` を差し替え。`requestUiMode` に `'popup'` 等を返させ、`chrome://` のような特殊ページでもフォールバック挙動を検証できる。

## テスト実装の更新
- `floating.spec.ts` と `popup.spec.ts` を web-first API (`getByTestId`, `hover`, `expect(...).toBeVisible`) へ書き換え、`page.evaluate` + `dispatchEvent` を排除。Playwright の actionability check が効くようになり、Shadow DOM 操作も安定。
- 新シナリオ「requestUiMode can be mocked…」を追加し、モックが `'popup'` を正しく返すことを `chrome.runtime.sendMessage` 経由で検証。
- `popup.spec.ts` もロケーターに揃え、UI のヘッダー/ボタン可視性を web-first アサーションで確認。

## ドキュメント整備
- `docs/testing/playwright.md` に状態初期化手順、headless/headed 推奨、`mockRequestUiMode` のステップ、trace の確認方法を追記。
- GUI 実行が必要な macOS では `PLAYWRIGHT_HEADLESS=0` を必須とする旨も記載。

## OpenSpec
- `stabilize-playwright-extension-tests` をアーカイブ (`2025-11-08-…`) し、提案書ヘッダーを英語に修正。

## 次にやるべきこと
- CI 上で `pnpm test:e2e` を組み込み、trace.zip を artifact として保存 (OpenSpec 3.2/4.2)。
- `refactor-react-migration` タスクに今回の改善を反映し、TanStack Query / fallback UI など残タスクを継続。
