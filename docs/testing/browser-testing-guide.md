# Arcline ブラウザ操作テストガイド

このドキュメントでは、Arcline 拡張機能のブラウザ操作テストを効率的に行うための知見をまとめています。

## 前提条件

### 開発サーバーの起動

```bash
cd <repo-root>
just dev
```

または本番ビルド:

```bash
cd <repo-root>/extension
pnpm build
```

### 拡張機能のロード

1. Chrome で `chrome://extensions/` を開く
2. 「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」
4. `extension/dist` フォルダを選択

## 拡張機能の確認方法

### 拡張機能 ID の取得

Content Script が動作しているページのコンソールログから取得可能:

```javascript
// コンソールログに以下のようなURLが表示される
// chrome-extension://eggeneglkkdpgicahmbiefpncdaggcfn/...
```

### 各エントリーポイント

| URL | 説明 |
|-----|------|
| `chrome-extension://{ID}/popup.html` | ツールバーのポップアップUI |
| `chrome-extension://{ID}/index.html` | メインのDevShell（フルスクリーンUI） |
| `chrome-extension://{ID}/newtab.html` | 新しいタブページ（設定で有効化時） |

## テストシナリオ

### 1. オンボーディングフロー

```
1. chrome-extension://{ID}/index.html を開く
2. 初回起動時は4ステップのオンボーディングが表示される
3. 各「Next」ボタンをクリックして進める
4. 最後の「Get Started」でメインUIへ
```

### 2. Floating UI トリガー

```
1. 通常のWebページ（例: https://www.google.com/）を開く
2. ページが完全に読み込まれるまで待機（2秒）
3. マウスを画面左端（X=1-5px）に移動
4. 1-2秒ホールドすると Floating UI がスライドイン
```

**注意点:**
- `chrome://` ページでは Content Script が動作しないため Floating UI は起動しない
- Edge Detection Debug オーバーレイが表示される場合がある（開発モード時）

### 3. インポート機能テスト

```
1. メインUIを開く
2. 右上の「︙」メニューをクリック
3. 「Import Bookmarks」を選択
4. ファイルを選択（Arc JSON または HTML）
```

**Arc データファイルの場所:**
```
~/Library/Application Support/Arc/StorableSidebar.json
```

### 4. スペース切り替え（スワイプ）

```
1. 通常のWebページで Floating UI を表示
2. 左右にスワイプジェスチャー
3. またはキーボードショートカット
```

## ブラウザサブエージェントの使用

### 基本的なパターン

```javascript
// ページを開く
open_browser_url("https://www.google.com/")

// DOMを取得
browser_get_dom(PageId)

// スクリーンショット
capture_browser_screenshot({
  PageID: "...",
  SaveScreenshot: true,
  ScreenshotName: "descriptive_name"
})

// クリック
click_browser_pixel({
  PageID: "...",
  X: 500,
  Y: 300
})

// マウス移動（Floating UI トリガーなど）
browser_move_mouse({
  PageId: "...",
  X: 1,
  Y: 430
})

// 待機
wait({ duration_ms: 2000 })
```

### 注意点

1. **chrome:// ページへのアクセス制限**
   - `chrome://extensions/` などの内部ページはDOM取得不可
   - 代わりに拡張機能のIDをコンソールログから取得

2. **ページID の取得**
   - `list_browser_pages()` で現在のページ一覧を取得
   - ページIDは頻繁に変わるため、操作前に再取得推奨

3. **待機時間**
   - ページ読み込み: 2000ms
   - UIアニメーション: 500-1000ms
   - Floating UI トリガー: 2000ms

## スクリーンショットの保存先

すべてのスクリーンショットは以下のディレクトリに保存される:

```
extension/test-results/visual/
```

命名規則: `{ScreenshotName}_{timestamp}.png`

## トラブルシューティング

### 拡張機能が動作しない

1. `chrome://extensions/` で拡張機能が有効か確認
2. エラーがあれば「Errors」ボタンで確認
3. Service Worker が「Active」状態か確認

### Floating UI が表示されない

1. Content Script が注入されているか確認（コンソールログ）
2. `chrome://` ページでは動作しない
3. Edge Detection の設定を確認

### インポートが失敗する

1. ファイル形式を確認（JSON or HTML）
2. Arc JSON の場合、`sidebar` キーが存在するか確認
3. コンソールログでエラーを確認

## テスト用コマンド

```bash
# ユニットテスト実行
just test

# リント＆型チェック
just check

# 開発サーバー起動
just dev

# 本番ビルド
cd extension && pnpm build
```

## 関連ドキュメント

- [Sync Architecture](./architecture/sync-architecture.md) - データ同期アーキテクチャ
- [Floating UI Guide](./guides/floating-ui.md) - Floating UI の技術詳細
- [Edge Detection Debug Guide](./guides/edge-detection-debug-guide.md) - エッジ検出のデバッグ
