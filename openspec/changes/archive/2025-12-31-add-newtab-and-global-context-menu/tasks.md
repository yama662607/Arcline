## 1. Implementation

- [x] 1.1 `public/newtab.html` を追加し、React の新規エントリ（例: `src/newtab/index.tsx`）を読み込む
- [x] 1.2 manifest に `chrome_url_overrides.newtab` を追加し、新規タブが Arcline に置き換わることを確認する
- [x] 1.3 新規タブページの UI を実装する
- [x] 1.3.1 ホーム画面を表示し、Command Palette を起動できる導線（ボタン/ショートカット）を提供する（案 B）
- [x] 1.3.2 Command Palette 起動時の placeholder/挙動を New Tab 仕様に調整する
- [x] 1.4 新規タブ統合を無効化できる設定を追加する（設定 UI + 保存 + 適用）
- [x] 1.4.1 無効化時は arcify と同様に background 経由で既定の新規タブへ遷移する（`chrome://new-tab-page/` → フォールバック）
- [x] 1.5 `chrome.contextMenus` に Arcline のグローバルメニューを登録する
- [x] 1.5.1 `onInstalled` 等で登録し、二重登録を防ぐ
- [x] 1.5.2 クリック時のハンドラを Service Worker に実装する
- [x] 1.6 グローバルコンテキストメニューの動作を実装する
- [x] 1.6.1 Side Panel を開く
- [x] 1.6.2 Command Palette を開く（可能なら現在タブで Floating UI を開いて Command Palette を表示）
- [x] 1.6.3 Quick Pin/Unpin（アクティブタブに対して既存ロジックを呼ぶ）
- [x] 1.7 テストを追加/更新する
- [x] 1.7.1 Vitest: contextMenus 登録/クリックのユニットテスト
- [x] 1.7.2 Playwright: 新規タブページの基本表示、メニュー導線の smoke test（可能な範囲）
- [x] 1.8 品質ゲート
- [x] 1.8.1 `just check`

## 2. Approval Gate

- [x] 2.1 proposal.md をレビューしてもらい、実装着手の承認を得る
