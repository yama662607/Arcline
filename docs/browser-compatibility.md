# ブラウザ互換性調査レポート

## 概要

Arcline 拡張機能の Chrome Side Panel API の各ブラウザでの動作状況を調査した結果をまとめる。

調査日: 2025 年 11 月 4 日
対象ブラウザ: Google Chrome, Atlas Browser

---

## 調査結果サマリー

| ブラウザ      | Side Panel API    | 動作状況     | 推奨モード |
| ------------- | ----------------- | ------------ | ---------- |
| Google Chrome | ✅ 完全サポート   | 正常動作     | Side Panel |
| Atlas Browser | ⚠️ 部分的サポート | **動作不可** | Floating UI（ホットゾーン） + Popup フォールバック |

---

## Google Chrome

### 環境情報

- User Agent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/[version] Safari/537.36`
- Chrome Version: 120 以降（Side Panel API サポート）

### Side Panel API サポート状況

✅ **完全サポート**

```javascript
typeof chrome.sidePanel !== "undefined"; // true
```

利用可能なメソッド:

- `chrome.sidePanel.setOptions()`
- `chrome.sidePanel.getOptions()`
- `chrome.sidePanel.setPanelBehavior()`
- `chrome.sidePanel.getPanelBehavior()`
- `chrome.sidePanel.open()`
- `chrome.sidePanel.close()`
- `chrome.sidePanel.onClosed`
- `chrome.sidePanel.onOpened`
- `chrome.sidePanel.getLayout()`

### 動作確認

#### パターン 1: `openPanelOnActionClick: true`

```javascript
await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
```

**結果**: ✅ 成功

- 拡張機能アイコンをクリック → サイドパネルが自動的に開く
- `chrome.action.onClicked`イベントは発火しない（期待通りの動作）

#### パターン 2: 手動で`open()`を呼び出し

```javascript
chrome.action.onClicked.addListener(async () => {
  await chrome.sidePanel.open({ windowId: windowId });
});
```

**結果**: ✅ 成功

- アイコンクリック時にサイドパネルが開く
- エラーなし

### 推奨設定

```javascript
// Chrome用の推奨設定
await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
```

---

## Atlas Browser

### 環境情報

- User Agent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36`
- ベース: Chromium 142
- 特徴: 独自の垂直タブバーと AI 検索サイドバーを実装

### Side Panel API サポート状況

⚠️ **表面的にはサポートしているが実質的に動作不可**

```javascript
typeof chrome.sidePanel !== "undefined"; // true
```

利用可能なメソッド（API 上は存在）:

```javascript
[
  "onClosed",
  "onOpened",
  "close",
  "getLayout",
  "getOptions",
  "open",
  "setOptions",
  "setPanelBehavior",
  "Side",
];
```

### 詳細調査ログ

#### 初期化時

```javascript
[Arcline] ========== Side Panel Detection ==========
[Arcline] chrome.sidePanel available: true
[Arcline] Available side panel methods: (10) ['onClosed', 'onOpened', 'close', ...]
[Arcline] Current side panel options: {enabled: true, path: 'index.html'}
[Arcline] Number of windows: 5
[Arcline] Current window ID: 467517247
[Arcline] Panel options for current context: {enabled: true, path: 'index.html'}
```

**観察**: API は存在し、`getOptions()`も正常に値を返す

#### パターン 1: `openPanelOnActionClick: true`

```javascript
await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
// 結果: ✓ setPanelBehavior succeeded
```

**結果**: ❌ 失敗（無反応）

- `setPanelBehavior()`自体は成功
- しかし、アイコンをクリックしても**何も起きない**
- エラーなし、ログなし、完全に無反応

#### パターン 2: 手動で`open()`を呼び出し

```javascript
chrome.action.onClicked.addListener(async () => {
  const windows = await chrome.windows.getCurrent();
  await chrome.sidePanel.open({ windowId: windows.id });
});
```

**結果**: ❌ 失敗（エラー）

```
[Arcline] ========== Action Clicked ==========
[Arcline] Side panel API available: true
[Arcline] Attempting to open side panel...
[Arcline] Current window ID: 467517351
[Arcline] ✗ Failed to open side panel: Error: `sidePanel.open()` may only be called in response to a user gesture.
[Arcline] Error details: {
  message: "`sidePanel.open()` may only be called in response to a user gesture.",
  name: "Error",
  stack: "Error: `sidePanel.open()` may only be called in response to a user gesture."
}
```

### 問題分析

#### 矛盾点

1. **`chrome.action.onClicked`はユーザージェスチャー**

   - このイベントは拡張機能アイコンのクリックに応答して発火する
   - Chrome の仕様上、これはユーザージェスチャーとして認識されるべき

2. **Atlas の実装はこれを拒否**
   - 「ユーザージェスチャーが必要」というエラーを返す
   - つまり、`onClicked`をユーザージェスチャーとして認識していない

#### 推測される原因

Atlas は独自のサイドバー実装（AI 検索、ブックマーク、履歴など）を持っており、Chrome 拡張の Side Panel API との競合を避けるため、以下のような制限を実装していると考えられる：

1. **意図的な API 制限**

   - API は存在するが、実際の動作は無効化されている
   - セキュリティや UX 上の理由で、拡張機能にサイドバーを奪われたくない

2. **実装の不完全性**

   - Chromium ベースだが Side Panel API の実装が不完全
   - または古いバージョンの API のみサポート

3. **Atlas 独自の設計思想**
   - 「サイドバーはブラウザが管理する領域」という方針
   - 拡張機能には開放しない設計

### Floating UI 対応

| シナリオ | 対応内容 |
| --- | --- |
| Atlas UA で `chrome.sidePanel` が利用不可 | Service Worker が `detectUiMode()` で `floating` を選択し、`chrome.storage.local` に保存。 |
| 通常ページ | コンテンツスクリプトがホットゾーン + Shadow DOM を生成し、React UI を遅延ロード。16 ms 未満の Framer Motion アニメーションでパネルをスライド表示。 |
| `chrome://` / PDF などコンテンツスクリプト禁止ページ | ホットゾーンは注入されない。ツールバーアイコンは自動的に popup (`index.html`) に切り替わり、`App.tsx` の UI モード表示にフォールバック手順を記載。 |

**手動確認の要点**

1. Atlas で任意のウェブページ（`https://example.com` など）を開き、画面左端 6px ホットゾーンにカーソルを置くとフローティング UI が 150 ms 以内に表示されること。
2. Pin ボタンで固定した後でも、`chrome.action.onClicked` を押すと popup が開くこと。
3. `chrome://extensions/` など保護ページではホットゾーンが存在しない代わりに、popup 上部へ「保護ページではポップアップを利用」ガイダンスが表示されること。

### Service Worker で確認できた API

Atlas の拡張機能サービスワーカーから `chrome` 名前空間を列挙した結果、以下の API 群が利用可能であることを確認した。ただし、**Side Panel API はオブジェクトとしては存在するものの、ユーザージェスチャー要件で実行が阻害される**。

- `chrome.action` / `chrome.commands` / `chrome.bookmarks` / `chrome.tabs` / `chrome.windows` など主要な MV3 API は一通り列挙される
- `chrome.sidePanel` オブジェクトも存在し、`setOptions`, `setPanelBehavior`, `open`, `close`, `getOptions`, `getLayout` など Chrome と同一のメソッド名が確認できる
- ただし `chrome.sidePanel.open()` 実行時は "`sidePanel.open()` may only be called in response to a user gesture." というエラーが返り、Atlas 側の制限でユーザージェスチャー判定が拒否されている

#### ログ抜粋（サービスワーカー）

```text
chrome.sidePanel
chrome.sidePanel.Side
chrome.sidePanel.Side.LEFT: string
chrome.sidePanel.Side.RIGHT: string
chrome.sidePanel.close()
chrome.sidePanel.getLayout()
chrome.sidePanel.getOptions()
chrome.sidePanel.getPanelBehavior()
chrome.sidePanel.onClosed.addListener()
chrome.sidePanel.onOpened.addListener()
chrome.sidePanel.open()
chrome.sidePanel.setOptions()
chrome.sidePanel.setPanelBehavior()
```

### Atlas での回避策検討

- `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` は成功レスポンスを返すが、拡張機能アイコンをクリックしてもパネルは開かない
- `chrome.sidePanel.open({ windowId })` を `chrome.action.onClicked` など明確なユーザージェスチャー内から呼び出しても、Atlas 側がジェスチャーとして認識せずエラーになる
- `chrome.commands.onCommand` やコンテキストメニューなど他のイベントもユーザージェスチャー扱いにならない可能性が高く、同じ制限に引っかかると推測される
- `chrome.windows.create({ type: "panel" })` のような代替 UI はブラウザ固有の挙動になり UX が崩れるため現状採用しない方針

**結論**: 2025 年時点では Atlas において Side Panel を開くための確実な回避策は確認できていない。安定した UX を優先し、Popup モードを継続採用する。

### 推奨設定

```javascript
// Atlas用の推奨設定: ポップアップモードを使用
chrome.action.setPopup({ popup: "index.html" });
```

**理由**:

- Side Panel API は動作しない
- Popup API は正常に動作する
- UX としてもポップアップで十分機能する

---

## 実装方針

### 現在の実装

すべてのブラウザで**Popup モード**を使用する統一実装。

```typescript
async function initializeUiMode() {
  const hasSidePanel = typeof chrome.sidePanel !== "undefined";

  console.log("[Arcline] ========== Side Panel Detection ==========");
  console.log("[Arcline] chrome.sidePanel available:", hasSidePanel);
  console.log("[Arcline] User agent:", navigator.userAgent);

  // (診断ログ省略)

  // Atlas doesn't support side panel properly (user gesture error even in onClicked)
  // Use popup mode for maximum compatibility
  const mode: UiMode = "popup";

  await chrome.storage.local.set({ [UI_MODE_KEY]: mode });

  // Use popup mode - works in all Chromium browsers
  chrome.action.setPopup({ popup: "index.html" });
  console.log("[Arcline] Using popup mode (Atlas compatibility)");
}
```

### 将来的な改善案

ブラウザごとに最適なモードを使い分ける実装：

```typescript
async function initializeUiMode() {
  const hasSidePanel = typeof chrome.sidePanel !== "undefined";
  const userAgent = navigator.userAgent;

  // Detect Chrome (not Atlas/Arc)
  const isChrome =
    !userAgent.includes("Atlas") && !userAgent.includes("Arc") && hasSidePanel;

  if (isChrome) {
    // Chrome: Use side panel
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    await chrome.storage.local.set({ [UI_MODE_KEY]: "side-panel" });
    console.log("[Arcline] Using side panel mode (Chrome)");
  } else {
    // Atlas/Other: Use popup
    chrome.action.setPopup({ popup: "index.html" });
    await chrome.storage.local.set({ [UI_MODE_KEY]: "popup" });
    console.log("[Arcline] Using popup mode (Atlas compatibility)");
  }
}
```

**注意**: 現時点では User Agent で Atlas を検出できないため（Chrome と同じ UA）、より高度な検出ロジックが必要。

---

## テスト結果

### Chrome

| テスト項目          | 結果 | 備考                   |
| ------------------- | ---- | ---------------------- |
| 拡張機能読み込み    | ✅   | エラーなし             |
| Side Panel 表示     | ✅   | アイコンクリックで開く |
| タブリスト表示      | ✅   | 実際のタブが表示される |
| Pin/Unpin 機能      | ✅   | 正常動作               |
| ホットリロード(HMR) | ✅   | Vite + CRXJS           |

### Atlas

| テスト項目          | 結果 | 備考                   |
| ------------------- | ---- | ---------------------- |
| 拡張機能読み込み    | ✅   | エラーなし             |
| Side Panel 表示     | ❌   | 動作せず               |
| Popup 表示          | ✅   | アイコンクリックで開く |
| タブリスト表示      | ✅   | 実際のタブが表示される |
| Pin/Unpin 機能      | ✅   | 正常動作               |
| ホットリロード(HMR) | ⚠️   | 要確認                 |

---

## 技術的な詳細

### Manifest V3 設定

```json
{
  "manifest_version": 3,
  "action": {
    "default_title": "Arcline",
    "default_icon": {
      "128": "icons/icon-128.png"
    }
  },
  "side_panel": {
    "default_path": "index.html"
  },
  "permissions": [
    "tabs",
    "tabGroups",
    "bookmarks",
    "storage",
    "sidePanel",
    "commands"
  ]
}
```

### Side Panel API 利用時の注意点

1. **`openPanelOnActionClick`との併用**

   - これを true にすると`chrome.action.onClicked`は発火しない
   - false にすると手動で`open()`を呼ぶ必要がある

2. **ユーザージェスチャー要件**

   - `chrome.sidePanel.open()`はユーザージェスチャーのコンテキストで呼ぶ必要がある
   - `chrome.action.onClicked`は本来ユーザージェスチャー
   - しかし Atlas はこれを認識しない（バグまたは制限）

3. **Window ID 指定**
   - `open({ windowId: number })`でウィンドウを指定
   - `chrome.windows.WINDOW_ID_CURRENT`は非推奨
   - `chrome.windows.getCurrent()`で取得するのが正しい

---

## 結論

### 現状の方針

- **全ブラウザで Popup モードを使用**
- 理由:
  - 最大限の互換性
  - Atlas での動作保証
  - 実装がシンプル
  - UX 上も十分実用的

### 今後の検討事項

1. **ブラウザ検出の改善**

   - User Agent 以外の方法で Atlas を検出
   - 実行時テストによる機能検出

2. **Side Panel 対応ブラウザでの最適化**

   - Chrome では可能な限り Side Panel を使用
   - より良い UX 提供

3. **Atlas 公式の対応待ち**
   - Atlas が将来的に Side Panel API を完全サポートする可能性
   - 定期的な再検証が必要

---

## 参考リンク

- [Chrome Side Panel API Documentation](https://developer.chrome.com/docs/extensions/reference/sidePanel/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Atlas Browser](https://arc.net/)

---

## 変更履歴

- 2025-11-04: 初版作成（Chrome/Atlas 互換性調査）
