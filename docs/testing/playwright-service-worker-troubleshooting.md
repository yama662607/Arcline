# Playwright Service Worker 起動問題の解決

## 概要

Arcline 拡張の E2E テストで Service Worker が起動しない問題について、原因調査と解決策をまとめたドキュメントです。

## 問題の症状

- `pnpm test:e2e` 実行時に以下のエラーが発生していました：
  ```
  Error: Chrome 拡張の service worker を取得できませんでした。dist/ を再ビルドしてください。
  Error: Chrome 拡張の service worker が起動せず、拡張 ID を取得できませんでした。
  ```

## 原因調査

### 1. manifest.json の service_worker 設定問題

ビルド後の `dist/manifest.json` が開発用ローダーを指していました：

```jsonc
// dist/manifest.json (問題あり)
"background": {
  "service_worker": "service-worker-loader.js",
  "type": "module"
}
```

`service-worker-loader.js` の中身：

```javascript
import 'http://localhost:5173/@vite/env'
import 'http://localhost:5173/@crx/client-worker'
import 'http://localhost:5173/src/background/index.ts'
```

これは Vite dev server (http://localhost:5173) を前提としたローダーで、
Playwright 実行時（dev サーバーなし）では import が失敗し SW が起動しませんでした。

### 2. 本物の SW バンドルは存在していた

`dist/.vite/manifest.json` には正しいエントリがありました：

```jsonc
"src/background/index.ts": {
  "file": "assets/index.ts-uo_yPBp9.js",
  "src": "src/background/index.ts",
  "isEntry": true
}
```

Vite は正しく background をビルドしていましたが、manifest が dev 用 loader を指し続けていました。

### 3. Playwright の拡張サポート

Playwright 公式ドキュメントによると、Chrome 拡張を headless で動かすには：

- `chromium` チャネルを明示的に指定する必要がある
- `launchPersistentContext` を使用する

## 解決策

### 1. manifest パッチスクリプトの実装

`scripts/patch-sw-manifest.mjs` を作成し、ビルド済み SW バンドルを指すように manifest を修正：

```javascript
// scripts/patch-sw-manifest.mjs
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

async function main() {
  const distDir = path.join(process.cwd(), 'dist')
  const viteManifestPath = path.join(distDir, '.vite', 'manifest.json')
  const manifestPath = path.join(distDir, 'manifest.json')

  const viteRaw = await readFile(viteManifestPath, 'utf8')
  const viteManifest = JSON.parse(viteRaw)

  const swEntry = viteManifest['src/background/index.ts']
  if (!swEntry || typeof swEntry.file !== 'string') {
    console.error('[patch-sw-manifest] No src/background/index.ts entry in .vite/manifest.json')
    process.exit(1)
  }

  const manifestRaw = await readFile(manifestPath, 'utf8')
  const manifest = JSON.parse(manifestRaw)

  if (!manifest.background || typeof manifest.background !== 'object') {
    manifest.background = {}
  }

  manifest.background.service_worker = swEntry.file

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
}

main().catch(error => {
  console.error('[patch-sw-manifest] Failed to patch manifest:', error)
  process.exit(1)
})
```

### 2. package.json のスクリプト更新

```jsonc
{
  "scripts": {
    "patch:sw-manifest": "node scripts/patch-sw-manifest.mjs",
    "test:e2e": "pnpm build && pnpm patch:sw-manifest && PLAYWRIGHT_HEADLESS=1 playwright test -c playwright/playwright.config.ts",
    "test:e2e:headless": "pnpm build && pnpm patch:sw-manifest && playwright test -c playwright/playwright.config.ts"
  }
}
```

### 3. Playwright fixtures の修正

`playwright/fixtures/extension.ts` で Chromium チャネルを明示：

```typescript
export async function launchExtensionContext(): Promise<BrowserContext> {
  assertBuildExists()
  const headlessEnv = process.env.PLAYWRIGHT_HEADLESS
  const headless = headlessEnv ? headlessEnv !== '0' : true

  return chromium.launchPersistentContext('', {
    headless,
    channel: 'chromium', // 公式ドキュメントに従い Chromium チャネルを指定
    args: [
      `--disable-extensions-except=${extensionDistPath}`,
      `--load-extension=${extensionDistPath}`,
    ],
  })
}
```

## 結果

### 解決された問題

- Service Worker 起動エラーが解消
- `extensionId` の取得が成功するようになった
- テストが UI レイヤまで進行するようになった

### 現在の状況

- Service Worker は正常に起動
- 残りの問題は UI レイヤ（loading-spinner が消えない、spaces-new-button が見つからない）
- これは SW 起動問題とは別の、React Query / Bridge 通信の問題

## 次のステップ

1. **UI ロード問題の解決**

   - loading-spinner が消える条件を確認
   - spacesSnapshot の取得と React Query の状態を調査
   - E2E 環境での tabs/storage 初期状態を確認

2. **テストの安定化**
   - simple-space-test.spec.ts の待ちロジックを調整
   - 必要に応じて SW 動作確認用の極小テストを追加

## 関連ファイル

- `scripts/patch-sw-manifest.mjs` - manifest パッチスクリプト
- `playwright/fixtures/extension.ts` - Playwright 拡張用 fixtures
- `package.json` - テストスクリプト
- `dist/manifest.json` - ビルド後の manifest（パッチ適用後）

## 参考資料

- [Playwright Chrome Extensions](https://playwright.dev/docs/chrome-extensions)
- [CRXJS Vite Plugin](https://github.com/crxjs/chrome-extension-tools)
