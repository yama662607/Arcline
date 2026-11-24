# E2E テストの UI ローディング問題

## 問題概要

Playwright E2E テストで Service Worker は起動するものの、React Query を介したデータ取得ができず、UI がローディング状態のままになる問題。

## 現状

1. **Service Worker 起動**: ✅ 成功

   - `chrome-extension://[id]/assets/index.ts-[hash].js` で Service Worker が起動
   - Playwright の `waitForEvent('serviceworker')` が成功

2. **Bridge 通信**: ❌ 失敗

   - Service Worker Bridge から Service Worker へのメッセージ送信がタイムアウト
   - Service Worker 側のコンソールログが Playwright で監視できない

3. **UI 状態**: ❌ ローディング停滞
   - `loading-spinner` が 10 秒以上表示されたまま
   - `spaces-new-button` が表示されない

## 原因調査

### Service Worker 側の問題

- Service Worker スクリプトは読み込まれているが、実行されていない可能性
- `chrome.runtime.onMessage` リスナーが登録されていない
- コンソールログが出力されていない

### Bridge 通信の問題

- `chrome.runtime.sendMessage` が Service Worker に到達していない
- メッセージ形式の不一致（Bridge vs Legacy）
- 非同期レスポンスのハンドリングの問題

### Playwright 環境の制約

- Headless モードでの Service Worker デバッグの制限
- 拡張機能のセキュリティ制約
- Service Worker コンテキストの分離

## 解決策の検討

### 1. Service Worker のモック化（推奨）

E2E テストでは Service Worker をモック化し、UI の動作検証に集中する：

```typescript
// playwright/fixtures/extension.ts にモックを追加
await page.addInitScript(() => {
  // Service Worker Bridge をモック
  ;(window as any).chrome = {
    runtime: {
      sendMessage: (message: any, callback?: (response: any) => void) => {
        // モックレスポンスを返す
        if (message.method === 'getSpacesSnapshot') {
          setTimeout(
            () =>
              callback?.([
                {
                  id: 1,
                  name: 'Default Space',
                  color: 'blue',
                  pinnedTabs: [],
                  temporaryTabs: [],
                },
              ]),
            100
          )
        }
      },
    },
  }
})
```

### 2. Service Worker の直接テスト

Service Worker の機能を別途ユニットテストで検証：

```typescript
// service-worker-bridge-integration.test.ts を修正
// 実際の Service Worker と通信するテストを実装
```

### 3. 環境変数による分岐

開発・本番環境では Service Worker を使用し、テスト環境ではモックを使用：

```typescript
// src/lib/service-worker-bridge.ts
if (process.env.NODE_ENV === 'test') {
  // モック実装を使用
} else {
  // 本来の Service Worker 通信
}
```

## 次のステップ

1. **即時対応**: Service Worker をモック化して UI テストを復旧
2. **中期的対応**: Service Worker 通信の統合テストを別途実装
3. **長期的対応**: E2E テスト環境での Service Worker デバッグ方法を確立

## 関連ファイル

- `extension/playwright/fixtures/extension.ts`
- `extension/src/lib/service-worker-bridge.ts`
- `extension/src/background/index.ts`
- `extension/playwright/e2e/simple-space-test.spec.ts`
