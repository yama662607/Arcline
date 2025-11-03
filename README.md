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

### 開発サーバー (サンドボックス UI)

```bash
pnpm --filter arcline-extension dev
```

Vite の Dev サーバーが起動し、React + Tailwind ベースのプレースホルダー UI が表示されます。拡張としての sidePanel やポップアップ UI は順次実装していきます。

### 拡張パッケージのビルド

```bash
pnpm --filter arcline-extension build
```

`apps/extension/dist/` に Manifest V3 形式の成果物が出力されます。Chrome の「パッケージ化されていない拡張機能を読み込む」で `dist/` を選択すると検証できます。

### Lint / Format / Test

```bash
pnpm --filter arcline-extension lint    # Biome lint
pnpm --filter arcline-extension format  # Biome format
pnpm --filter arcline-extension test    # Vitest (今後整備)
```

## コミット運用

- Conventional Commits を採用し、**日本語**でメッセージを記述します。
- 例: `feat: React テンプレートを追加`、`chore: pnpm ワークスペースを設定`
- 変更は機能単位で細かく分割し、OpenSpec の提案内容と整合するようにしてください。

## ライセンス

GPL-3.0。詳細は [LICENSE](LICENSE) を参照してください。

## 参考

- 旧実装 (Arcify) のドキュメントや資産は `legacy/arcify/` に残しています。
- 仕様やタスクは `openspec/` 以下にまとめています。
