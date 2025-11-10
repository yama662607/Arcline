# Arcline テストガイド

## テスト構成

Arcline は以下の3層のテスト戦略を採用しています：

1. **ユニットテスト** (Vitest)
2. **E2Eテスト** (Playwright)
3. **手動テスト** (アクセシビリティ検証など)

## ユニットテスト

### 実行方法

```bash
# 全てのユニットテストを実行
pnpm test

# ウォッチモードで実行（開発中）
pnpm test:watch

# カバレッジレポートを生成
pnpm test -- --coverage
```

### テストファイルの場所

- `apps/extension/src/**/*.test.ts`
- `apps/extension/src/**/*.spec.ts`

### モック戦略

Chrome API のモックには Vitest の `vi.fn()` を使用します。

```typescript
const mockChrome = {
  tabs: {
    query: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
  },
  tabGroups: {
    query: vi.fn(),
  },
};

// @ts-expect-error - Mocking global chrome
global.chrome = mockChrome;
```

### 例: getSpacesSnapshot のテスト

```typescript
it('should create space for each tab group', async () => {
  const mockTabGroups: chrome.tabGroups.TabGroup[] = [
    {
      id: 1,
      title: 'Work',
      color: 'blue',
      windowId: 100,
      collapsed: false,
    },
  ];

  mockChrome.tabGroups.query.mockResolvedValue(mockTabGroups);
  mockChrome.tabs.query.mockResolvedValue([]);

  const result = await getSpacesSnapshot();

  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    id: 1,
    name: 'Work',
    color: 'blue',
  });
});
```

## E2Eテスト

### 実行方法

```bash
# ビルドしてE2Eテストを実行
pnpm test:e2e

# ヘッドレスモードを無効化（デバッグ用）
PLAYWRIGHT_HEADLESS=0 pnpm test:e2e

# 特定のテストのみ実行
pnpm test:e2e -- floating.spec.ts
```

### テストファイルの場所

- `apps/extension/playwright/e2e/*.spec.ts`

### E2Eテストの構成

- **フローティング UI テスト**: ホットゾーンのhover/離脱動作
- **ポップアップ UI テスト**: ポップアップの表示とインタラクション

### 例: フローティング UI のテスト

```typescript
test('floating UI hotzone reveals and hides panel', async ({ page }) => {
  // Chrome API をモック
  await page.addInitScript(() => {
    // ... モック設定
  });

  await page.setContent('<main>Test Page</main>');
  await page.evaluate(() => window.bootstrapFloatingUiForTest());

  // ホットゾーンにhoverしてパネルを開く
  await page.evaluate(() => {
    window.__arclineFloatingInstance?.openFromHover();
  });

  await expect
    .poll(readPanelOpen, { timeout: 2000 })
    .toBe(true);
});
```

## 手動テスト

### アクセシビリティ検証

#### 1. キーボード操作の確認

**ホットゾーン（フローティング UI）**

1. Tab キーでホットゾーンにフォーカスを移動
   - [ ] フォーカスリング（青い枠線）が表示されること
   - [ ] フォーカスインジケーターが明確に見えること

2. Enter キーまたは Space キーを押す
   - [ ] フローティング UI が開くこと
   - [ ] アニメーションがスムーズであること

3. Escape キーを押す
   - [ ] フローティング UI が閉じること
   - [ ] ピン留めも解除されること

4. ホットゾーンをクリック
   - [ ] UI がピン留めされること
   - [ ] 視覚的インジケーター（青い点）が表示されること

**タブリスト**

1. Tab キーでタブアイテムにフォーカスを移動
   - [ ] 各タブにフォーカスリングが表示されること
   - [ ] フォーカスが視覚的に明確であること

2. Enter キーまたは Space キーでタブを選択
   - [ ] タブがアクティブになること
   - [ ] Chrome でタブが切り替わること

#### 2. スクリーンリーダーのテスト

**推奨ツール:**
- macOS: VoiceOver (Cmd + F5)
- Windows: NVDA または JAWS
- Chrome: ChromeVox 拡張機能

**確認項目:**

1. ホットゾーン
   - [ ] "Pin floating sidebar" または "Unpin floating sidebar" と読み上げられること
   - [ ] 現在の状態（pinned/unpinned）が明確に伝わること

2. タブリスト
   - [ ] タブのタイトルとURLが読み上げられること
   - [ ] ピン留め状態が伝わること

3. ボタンとリンク
   - [ ] すべてのインタラクティブ要素にラベルがあること
   - [ ] ボタンの目的が明確であること

#### 3. マウス操作の確認

1. ホットゾーンにマウスをホバー
   - [ ] UI が即座に表示されること（150ms以内）
   - [ ] アニメーションがスムーズであること

2. UI 内でマウスを移動
   - [ ] UI が開いたままであること

3. UI の外にマウスを移動
   - [ ] 220ms後に UI が閉じること
   - [ ] ピン留めされている場合は閉じないこと

4. タブアイテムをクリック
   - [ ] タブがアクティブになること
   - [ ] hover時にボタンが表示されること

5. ピン留めボタンをクリック
   - [ ] タブがピン留めされること
   - [ ] UI に反映されること

#### 4. 視覚的フィードバックの確認

1. ホットゾーン
   - [ ] hover時に背景が表示されること
   - [ ] focus時にリングが表示されること
   - [ ] active時にスケールが変化すること（active:scale-95）
   - [ ] pinned時に青い点が表示されること

2. タブアイテム
   - [ ] hover時に背景色が変わること
   - [ ] active状態が視覚的に区別できること

### ブラウザ別の動作確認

#### Chrome

```bash
pnpm dev
# http://localhost:5173/ を Chrome で開く
# chrome://extensions/ で拡張を有効化
```

確認項目:
- [ ] フローティング UI が正常に動作すること
- [ ] Side Panel が正常に動作すること
- [ ] ポップアップが正常に動作すること

#### Atlas

確認項目:
- [ ] フローティング UI が自動的に選択されること
- [ ] Atlas の UI と競合しないこと
- [ ] ホットゾーンの位置が適切であること

#### Arc

確認項目:
- [ ] フローティング UI が動作すること
- [ ] Arc のスペース機能と干渉しないこと

### パフォーマンステスト

#### メモリ使用量

```bash
# Chrome DevTools の Memory タブで確認
# 1. ヒープスナップショットを取得
# 2. フローティング UI を開閉
# 3. 再度スナップショットを取得
# 4. メモリリークがないか確認
```

確認項目:
- [ ] UI を100回開閉してもメモリリークがないこと
- [ ] フローティング UI のメモリ使用量が 60MB 以下であること

#### 描画パフォーマンス

```bash
# Chrome DevTools の Performance タブで確認
# 1. 記録を開始
# 2. ホットゾーンにhover
# 3. 記録を停止
# 4. フレームレートを確認
```

確認項目:
- [ ] hover から表示まで 150ms 以内であること
- [ ] アニメーション中のフレームレートが 60fps を維持すること
- [ ] レイアウトシフトがないこと

## CI/CD での自動テスト

### GitHub Actions

CI では以下のテストが自動実行されます:

1. Lint チェック
2. 型チェック
3. ユニットテスト
4. ビルド
5. E2Eテスト

### ローカルで CI 相当の確認

```bash
# すべてのチェックを実行
pnpm check

# 個別実行
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## トラブルシューティング

### Vitest のタイムアウトエラー

```typescript
// テストのタイムアウトを延長
it('should complete long operation', async () => {
  // ...
}, { timeout: 10000 }); // 10秒
```

### Playwright のタイムアウトエラー

```bash
# playwright.config.ts でグローバルタイムアウトを設定
export default defineConfig({
  timeout: 30_000, // 30秒
});
```

### Chrome API モックが動作しない

```typescript
// beforeEach でモックをクリア
beforeEach(() => {
  vi.clearAllMocks();
});
```

## 参考リンク

- [Vitest ドキュメント](https://vitest.dev/)
- [Playwright ドキュメント](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Web Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
