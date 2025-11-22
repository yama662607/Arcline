## Why

Manifest V3 の Service Worker はイベント駆動かつ短命であり、Playwright E2E テストから背景サービスの状態に依存して拡張 ID を解決する現在の方式は、タイミング次第で失敗する不安定な構造になっている。

- Service Worker が `onInstalled` / `onStartup` などで一度だけ起動し、その後すぐ terminate されると、Playwright の `context.serviceWorkers()` や `waitForEvent('serviceworker')` がタイムアウトし得る。
- 拡張 ID を「動的に探す」こと自体が MV3 のライフサイクル設計と相性が悪く、E2E の信頼性を下げている。

## What Changes

- E2E テスト専用ビルドにおいて、manifest の `key` を用いて拡張 ID を**決定的に固定**する。
  - Playwright フィクスチャは固定 ID を参照するだけにし、Service Worker 依存の `resolveExtensionId` ロジックを廃止する。
- テスト環境 (`NODE_ENV === 'test'` など) 限定で、背景 Service Worker に軽量な Keep-Alive ハートビート処理を追加し、E2E 実行中に予期せず terminate されないようにする。
- 本番ビルドでは `key` を含めず、Keep-Alive も無効化し、完全にイベント駆動・短命な MV3 Service Worker として振る舞うことを仕様で明示する。

## Impact

- Affected specs:
  - `platform`
    - ビルドモード別の挙動 (prod / dev / test) と、テスト用の決定的な拡張 ID 戦略を追加。
  - `background-services`
    - テスト環境限定の Service Worker Keep-Alive 要件と、本番環境でそれを有効化しないことを追加。
- Affected code (例):
  - `apps/extension/manifest.config.ts` / `vite.config.ts`
  - `apps/extension/playwright/fixtures/extension.ts`
  - `apps/extension/src/background/index.ts`
  - `apps/extension/playwright/playwright.config.ts`
