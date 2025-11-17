## Why

背景サービスが複数の責務を担っている一方で、仕様やテスト網羅が不足しているため、UI モード配信やコマンドハンドラの失敗時挙動、ジェスチャー連動などが把握しづらい。テスト強化を進める前に、期待動作を仕様として明文化し、品質ゲートを定義する必要がある。

## What Changes

- background/index.ts の UI モード配信・ジェスチャー連動・commandHandlers の期待挙動を openspec に追記
- broadcastUiMode のフォールバック、chrome.runtime.lastError の取り扱い、ログ方針を明記
- ジェスチャー → navigateSpace → broadcastSpacesSnapshot のシーケンス要件を定義
- Service Worker 経由のメッセージング（requestUiMode 等）のエラーハンドリング要件を追加

## Impact

- Affected specs: `background-services`
- Affected code: `apps/extension/src/background/index.ts`, `apps/extension/src/background/services/browser.ts`, 将来的に `src/lib/service-worker-bridge.ts` のテストにも波及
