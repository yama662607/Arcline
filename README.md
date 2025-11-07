# Arcline

Atlas や Arc などの Chromium 系ブラウザでも Arc Browser のような垂直タブ体験を提供することを目指す拡張機能です。既存の Arcify クローンをベースにしながら、React + TypeScript + Tailwind を中心としたモダンな実装へ段階的に移行しています。

## プロジェクト構成

```
.
├── apps/
│   └── extension/      # React + TypeScript + Vite ベースの新実装
├── legacy/
│   └── arcify/         # 参考用に残したバニラ JS 実装 (Arcify クローン)
├── docs/               # 設計ノートやリサーチ資料
├── openspec/           # 仕様・タスク管理 (OpenSpec)
├── package.json        # pnpm ワークスペース定義
└── pnpm-workspace.yaml
```

> 旧版の資産は `legacy/arcify/` に移動済みです。参照はできますが、ビルドや改修は今後 `apps/extension/` を中心に行います。

## 開発環境

### 前提

- Node.js 18 以上
- pnpm 9 以上 (Corepack 推奨)
- Chrome / Atlas / Arc などの Chromium ブラウザ

### 初回セットアップ

```bash
pnpm install
```

### Dev 実行（拡張を Chrome に読み込み）

```bash
pnpm dev
```

Vite + CRXJS による拡張のウォッチビルドが起動します（`apps/extension/dist/` に出力）。

変更保存で自動的に `dist/` が更新され、Chrome で拡張がリロードされます。

**初回または拡張の再読み込み時：**

1. Chrome の「拡張機能」ページを開く（`chrome://extensions/`）
2. 「デベロッパーモード」を ON にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `apps/extension/dist/` フォルダを選択

Arc / Atlas など Chromium 系でも同様に `dist/` を読み込めます。

### 開発サーバー (サンドボックス UI)

```bash
pnpm --filter arcline-extension dev
```

Vite の Dev サーバーが起動し、React + Tailwind ベースのプレースホルダー UI が表示されます。拡張としての sidePanel やポップアップ UI は順次実装していきます。

### 拡張パッケージのビルド

```bash
pnpm build
```

`apps/extension/dist/` に Manifest V3 形式の成果物が出力されます。Chrome の「パッケージ化されていない拡張機能を読み込む」で `dist/` を選択すると検証できます。

### Lint / Format / Test

```bash
pnpm lint    # Biome lint
pnpm format  # Biome format
pnpm test    # Vitest (今後整備)
```

## UI モードと Side Panel トラブルシューティング

Chrome の UI モードは `chrome.storage.local` に `arclineUiMode` として保存され、次回起動時の初期値に利用されます。Side Panel を利用するには、以下を満たしてください。

1. **ユーザー操作直後に Side Panel を開くこと**  
   ツールバーアイコンをクリックしてトリガーされたイベント内で `chrome.sidePanel.open` を呼び出します。非同期 API を挟むとユーザー操作扱いが失効するため、`chrome.windows.getCurrent()` ではなく `chrome.windows.WINDOW_ID_CURRENT` を利用し、同期的に `open({ windowId })` を呼び出します。

2. **Chrome の設定確認**  
   - Chrome バージョンは 116 以上であること。
   - `chrome://flags/#side-panel` が Disable になっていないこと。
   - 拡張機能の `manifest` に `permissions: ['sidePanel']` と `side_panel.default_path` が含まれていること（実装済み）。

3. **現在の暫定仕様（2025-11-07 時点）**  
   - Atlas 判定ロジックが未確定のため、**すべてのブラウザで UI モードを強制的に `floating` に固定**しています。
   - `chrome.storage.local.get('arclineUiMode')` は常に `'floating'`（または未設定時に初期化で `floating`）になります。
   - Side Panel は一時的に無効化しているため、`chrome.sidePanel` 関連のログや API 呼び出しは実行されません。

4. **Atlas / その他ブラウザでの挙動**  
   - Atlas ではこれまで通り左端にフローティングビューが即表示されます。
   - Chrome など他ブラウザでも同じ挙動になります。今後 Atlas を確実に判定できる方法が見つかった際に、Side Panel と Floating を切り替えるロジックを再導入する予定です。

これらを満たしてもフローティングビューが表示されない場合は、拡張 Service Worker のコンソールで `chrome.tabs.sendMessage(tabId, { command: 'showSidebar' })` の応答を確認し、コンテンツスクリプトが注入されているかを調べてください。

## コミット運用

- Conventional Commits を採用し、**日本語**でメッセージを記述します。
- 例: `feat: React テンプレートを追加`、`chore: pnpm ワークスペースを設定`
- 変更は機能単位で細かく分割し、OpenSpec の提案内容と整合するようにしてください。

## ライセンス

GPL-3.0。詳細は [LICENSE](LICENSE) を参照してください。

## 参考

- 旧実装 (Arcify) のドキュメントや資産は `legacy/arcify/` に残しています。
- 仕様やタスクは `openspec/` 以下にまとめています。
