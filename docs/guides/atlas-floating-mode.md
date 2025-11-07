# Atlas でフローティングビューを確実に動かすための手順書

最終更新: 2025-11-07

このドキュメントでは、Atlas ブラウザで Arcline のフローティングビューを確実に表示するために確認すべき設定・コード・検証手順を詳細にまとめます。特に開発中によく遭遇する "Side Panel が開かない" "メッセージ送信時に Receiving end does not exist となる" といった事象に対して、原因と対処方法を体系的に整理しています。

---

## 1. コードの要点整理

### 1.1 UI モード検出と保存
- `detectUiMode()` は現在すべてのブラウザで `floating` を返すように簡略化しています。Atlas 判定が確立したら、ここに Side Panel 切り替えロジックを再導入します。@apps/extension/src/background/index.ts#30-178
- `applyUiMode()` は以下を実施します。@apps/extension/src/background/index.ts#53-63
  1. `chrome.action.setPopup` で action アイコンの挙動を切り替え（`floating` 以上で `index.html` を設定）
  2. `chrome.storage.local` に `arclineoMode` キーで保存
  3. `broadcastUiMode()` を通じてコンテンツスクリプトへ通知

### 1.2 Atlas 専用の分岐
- Atlas（User-Agent に `Atlas` を含む環境）では初期判定・action クリックの両方で Side Panel を試さず、即座に `floating` モードを適用するようになっています。@apps/extension/src/background/index.ts#68-186
- README にも Atlas では手動切り替え不要でフローティングビューが即表示される旨を明記済みです。@README.md#85-105

### 1.3 フローティング UI の注入
- コンテンツスクリプト `floating-ui.ts` / `sidebar-manager.ts` が `document_idle` で注入され、`showSidebar` メッセージを受けると左端にフローティング UI を描画します。@apps/extension/src/content-scripts/sidebar-manager.ts#1-57
- `sendSidebarCommand()` 経由で `showSidebar` / `toggleSidebar` が送信されます。@apps/extension/src/background/index.ts#196-211

---

## 2. フローティング専用モードでの検証フロー（暫定）

以下は **開発モード（`pnpm dev`）での再現手順** を想定したチェックリストです。すべてのブラウザが `floating` 固定で動作します。開発ビルドでは MV3 の制約により Vite HMR を無効化しているため、**ソースを変更したら拡張とタブを手動リロード**する必要があります。

### ステップ 0: 前提確認
- ブラウザ: Atlas 最新版
- UA に `Atlas` を含むことを DevTools の Console で `navigator.userAgent` を実行して確認
- 既に `pnpm install` 済み

### ステップ 1: 開発サーバー起動
```bash
pnpm dev
```
> HMR が無効なため、コード保存後は `chrome://extensions` で拡張を Reload し、テストタブも再読み込みしてください。
- Vite + CRXJS のウォッチビルドを開始します。
- 出力に `CRXJS: Load dist as unpacked extension` があることを確認。

### ステップ 2: 拡張機能のリロード
1. `chrome://extensions/` を開く
2. 対象拡張 (Arcline) の「デベロッパーモード」を ON にする
3. `更新 (Reload)` ボタンをクリックして Service Worker を再起動

> **目的**: バックグラウンド Service Worker を最新コードで再登録する。古い Service Worker のままだと `arclineoMode` に旧値が残り続けるため。

### ステップ 3: 対象タブのリロード
- Atlas で任意の `https://` ページを開き、`Ctrl/Cmd + R` でリロード。
- コンテンツスクリプトはタブ読み込み時に注入されるため、開発中は毎回リロードが必要です。

### ステップ 4: UI モードの初期値確認
1. **Service Worker コンソール**を開く（`chrome://extensions/` > 対象拡張 > Service Worker の「inspect」）。
2. コンソールで以下を実行:
   ```js
   await chrome.storage.local.get('arclineoMode', console.log);
   ```
3. **期待結果**: `{ arclineoMode: 'floating' }` もしくはキー未設定 (`undefined`)
   - `side-panel` が返る場合 → ステップ 2 をやり直して Service Worker を再起動

### ステップ 5: UI モードの問い合わせ
1. **タブ側コンソールを拡張コンテキストに切り替える**
   - Console 左/右上のドロップダウンから `top` → `chrome-extension://.../sidebar-manager.ts` などに変更
2. 以下を実行:
   ```js
   chrome.runtime.sendMessage({ command: 'requestUiMode' }, console.log);
   ```
3. **期待結果**: `{ command: 'currentUiMode', mode: 'floating' }`
   - `side-panel` が返る場合 → Service Worker のリロードやストレージのクリアを再確認（暫定実装では常に `floating` になる）
   - `Unchecked runtime.lastError: Could not establish connection` → コンテキストがページのまま、またはコンテンツスクリプト未読込。タブを再リロードしてから再試行

### ステップ 6: フローティング UI の表示確認
1. 拡張アイコン（action）をクリック
2. 左端にフローティング UI が表示されるか確認
   - 同時に Service Worker コンソールに `Atlas detected: using floating mode` が出力される
   - 表示されない場合 → コンテンツスクリプトのログを確認（次節参照）

---

## 3. 状態点検・デバッグコマンド集

| 目的 | コマンド / 操作 | 実行場所 | 想定される結果 / 補足 |
|------|------------------|-----------|-------------------------|
| Service Worker のストレージ確認 | `await chrome.storage.local.get('arclineoMode', console.log);` | Service Worker Console | `floating` または `undefined` が返るのが正常 |
| UI モード問い合わせ | `chrome.runtime.sendMessage({ command: 'requestUiMode' }, console.log);` | 拡張コンテキストのタブ Console | `{ mode: 'floating' }` が返る |
| サイドバー強制表示 | `chrome.tabs.sendMessage(tabId, { command: 'showSidebar' }, console.log);` | Service Worker Console | `true` が返れば注入済み。`lastError` が出る場合はコンテンツスクリプト未読込 |
| コンテンツスクリプト確認 | `document.querySelector('#arcline-sidebar-container')` | タブ Console（top コンテキスト） | 要素が取得できれば UI が描画済み | 

※ `chrome.storage` が `undefined` になる場合は、コンソールのコンテキストがページ側 (`top`) になっています。必ず `chrome-extension://...` の項目に切り替えてから実行してください。

---

## 4. よくあるエラーと対処

| ログ / エラー | 主な原因 | 対処方法 |
|---------------|-----------|-----------|
| `Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.` | コンテンツスクリプトが未注入、または対象タブが `chrome://` など禁止ページ | 対象ページを `https://` の通常サイトに変更し、タブをリロードしてから再度メッセージ送信 |
| `Error: Extension does not have a popup on the active tab.` | 旧コードで `side-panel` モードのまま `chrome.action.openPopup()` を呼び出していた（現行では発生しない想定） | まず `chrome.action.setPopup({ popup: 'index.html' })` を実行して popup を設定。暫定実装では常に `floating` に設定済み |
| `chrome.runtime` が `undefined` | コンソールがページコンテキスト (`top`) を指している | Console 上部のコンテキスト切替で `chrome-extension://...` を選択 |
| `mode: 'side-panel'` が返ってくる | Service Worker が旧コードのまま、または `arclineoMode` に旧値が残存 | `chrome://extensions` で拡張を Reload → `chrome.storage.local.remove('arclineoMode')` → 再度確認 （暫定実装では常に `floating` になる） |

---

## 5. Atlas 固有の挙動と考慮点

1. **ユーザーエージェント判定**: `navigator.userAgent` に `Atlas` が含まれる場合は必ず `floating` へ強制。
2. **Side Panel API 非対応扱い**: Atlas は Side Panel の挙動が不安定であるため、`chrome.sidePanel.open` を試さず、action クリック時に `showSidebar` でフローティング UI を即表示。
3. **`arclineoMode` の初期化**: `applyUiMode('floating')` が実行されるとストレージにも `floating` が保存される。ステートが戻ってしまう場合は Service Worker が再起動されていないことがほとんど。

---

## 6. ページごとの確認事項

| ページ種別 | コンテンツスクリプト注入 | メモ |
|------------|---------------------------|------|
| `https://` / `http://` | ✅ | 通常は `document_idle` で読み込まれ、`document.querySelector('#arcline-sidebar-container')` が取得可能 |
| `chrome://` / `chrome-extension://` | ❌ | Manifest V3 の制約で注入不可。テストは必ず `https://` など公開ドメインで行う |
| `file://` | ⚠️ | 許可されていれば動作するが、デフォルトでは無効。Chrome 設定で手動許可が必要 |

---

## 7. デバッグの進め方（推奨ワークフロー）

1. **環境起動**: `pnpm dev` → 拡張リロード → テスト対象タブをリロード
2. **状態リセット**: `chrome.storage.local.remove('arclineoMode')` で初期化（未設定のままでも `floating` が適用される）
3. **モード確認**: `requestUiMode` で `floating` が返ることを確認
4. **UI 表示確認**: 拡張アイコンをクリック → 左端にフローティングビューが出るか確認
5. **メッセージ疎通確認**: `sendSidebarCommand(tabId, 'showSidebar')` の応答を確認
6. **エラー解析**: エラーメッセージが出たら表 4 の対処法に沿って原因を切り分ける

---

## 8. まとめ

- 暫定対応として Side Panel をすべて無効化し、`background/index.ts` で `floating` モードへの強制が行われています。@apps/extension/src/background/index.ts#30-178
- Service Worker のリロードとストレージ初期化が行われていないと、古いモードが残り続けるため要注意。
- 開発中に `chrome.*` API が `undefined` になった場合は、コンソールのコンテキスト（isolated world）を確認する。
- 代表的なエラーメッセージとその背景を理解しておくと、再発時の切り分けが容易になります。

この手順に沿って検証することで、Atlas 環境でも確実にフローティングビューを起動し、Side Panel まわりの不具合に惑わされず開発を進めることができます。
