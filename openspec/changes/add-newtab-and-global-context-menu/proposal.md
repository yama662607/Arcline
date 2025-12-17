## Why

Arcline は Arc 風のタブ管理体験を提供しているが、ブラウザの「新規タブ」導線と OS/ブラウザ標準の右クリック導線（グローバルコンテキストメニュー）からの到達性が弱い。
その結果、ユーザーが日常的に使う起点（新規タブ、右クリック）から Arcline の検索・操作（Command Palette / Side Panel / Quick Pin）へ素早くアクセスできない。

## What Changes

- 新規タブ統合（New Tab Override）を追加する
  - `chrome_url_overrides.newtab` を Arcline の新規タブページへ接続する
  - 新規タブページは React で実装し、ホーム画面から Command Palette を起動しやすい UI を提供する（案 B）
  - ユーザーが無効化できる設定（フォールバック）を提供する
    - arcify と同様に、無効化時は background 経由で既定の新規タブへ遷移する
- グローバルコンテキストメニューを追加する
  - `contextMenus` に Arcline の共通エントリを登録し、右クリックから Side Panel / Command Palette / Quick Pin 等へ到達できるようにする
  - クリック時の動作は Service Worker 経由で既存のコマンド/ブリッジに接続する

## Impact

- Affected specs:
  - `extension-shell`（新規タブ HTML エントリ、manifest override）
  - `context-menu`（グローバルコンテキストメニュー項目の追加）
- Affected code (予定):
  - `extension/public/`（`newtab.html` 追加）
  - `extension/src/newtab/`（新規エントリ）
  - `extension/src/background/index.ts`（contextMenus の登録、クリックハンドラ）
  - `extension/src/background/handlers/command-handlers.ts`（必要ならコマンド追加）
  - `extension/src/floating/CommandPalette.tsx` / `extension/src/hooks/use-universal-search.ts`（New Tab モードの UX 調整が必要な場合）

## Open Questions

- 新規タブページで「スペース一覧 / ピン一覧」などをどこまで表示するか？（最小のホームか、情報量を増やすか）
- グローバルコンテキストメニューの項目セットを最小にするか、ショートカット相当の項目を増やすか？
- 右クリック対象（page / selection / link など）に応じた分岐が必要か？（初期は `contexts: ['all']` の単一導線で十分か）
