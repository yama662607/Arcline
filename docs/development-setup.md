# 開発環境セットアップガイド

## 概要

このドキュメントでは、Arcline 拡張機能の開発環境のセットアップ手順と、各ブラウザでのテスト方法をまとめる。

---

## 前提条件

- Node.js 18 以上
- pnpm 9 以上（Corepack 推奨）
- Google Chrome または Atlas Browser

---

## 初回セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. ビルド

```bash
pnpm build
```

出力先: `extension/dist/`

---

## 開発ワークフロー

### 開発モード（Watch）

```bash
pnpm dev
```

これにより:

- Vite 開発サーバーが起動（ポート 5173）
- ファイル変更時に自動的に再ビルド
- `extension/dist/`に出力

**注意**: 開発モードでは`dist/index.html`が一時的にプレースホルダーになる場合があります。その場合は一度`pnpm build`でプロダクションビルドを実行してください。

### プロダクションビルド

```bash
pnpm build
```

最適化されたビルドが`extension/dist/`に生成されます。

### Lint / Format

```bash
pnpm lint    # Biome lint
pnpm format  # Biome format
```

---

## ブラウザでのテスト

### Google Chrome でのテスト

#### 1. 拡張機能を読み込む

1. Chrome を開く
2. `chrome://extensions/`にアクセス
3. 右上の「デベロッパーモード」を**ON**にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. `extension/dist/`フォルダを選択

#### 2. 拡張機能を使用

- **アイコンをクリック**: ポップアップが開く
- **キーボードショートカット**:
  - `Command + E` (Mac) / `Ctrl + E` (Windows): パネル表示
  - `Command + D` (Mac) / `Ctrl + D` (Windows): アクティブタブの Pin 切り替え

#### 3. デバッグ

- **サービスワーカーのログ**:

  1. `chrome://extensions/`
  2. Arcline (Dev)の「サービスワーカー」をクリック
  3. DevTools の Console タブ

- **ポップアップのデバッグ**:
  1. ポップアップを開く
  2. ポップアップ内で右クリック → 「検証」
  3. DevTools が開く

#### 4. 再読み込み

コードを変更した後:

1. `chrome://extensions/`を開く
2. Arcline (Dev)の「更新」ボタン（🔄）をクリック

---

### Atlas Browser でのテスト

#### 1. 拡張機能を読み込む

1. Atlas を開く
2. 設定 → 拡張機能（または`atlas://extensions/`）
3. 右上の「デベロッパーモード」を**ON**にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. `extension/dist/`フォルダを選択

#### 2. 拡張機能を使用

- **アイコンをクリック**: ポップアップが開く
- **注意**: Atlas では**Side Panel は動作しません**（詳細は`browser-compatibility.md`参照）

#### 3. デバッグ

Chrome と同様の手順でサービスワーカーとポップアップをデバッグできます。

#### 4. 再読み込み

1. `atlas://extensions/`を開く
2. Arcline (Dev)の「更新」ボタンをクリック

---

## トラブルシューティング

### エラー: `Default locale was specified, but _locales subtree is missing`

**原因**: `manifest.config.ts`に`default_locale`が設定されているが、対応する`_locales`ディレクトリがない

**解決策**: `manifest.config.ts`から`default_locale: 'en'`の行を削除（既に対応済み）

### エラー: WebSocket connection failed

**原因**: Vite 開発サーバーの HMR ポート設定の問題

**解決策**:

1. `pnpm dev`を停止
2. プロダクションビルド実行: `pnpm build`
3. 拡張機能を再読み込み

### 警告: `The emitted file "..." overwrites a previously emitted file`

**影響**: なし（CRXJS の既知の動作）

**対応**: 無視して問題ありません

### Atlas でサイドパネルが開かない

**原因**: Atlas は Side Panel API を完全にサポートしていない

**解決策**:

- 現在の実装ではポップアップモードを使用
- アイコンをクリックするとポップアップが開きます
- 詳細は`browser-compatibility.md`を参照

---

## ホットリロード (HMR)

### 開発モードでの HMR

`pnpm dev`実行中は以下が自動的に反映されます:

✅ **反映される変更**:

- React コンポーネント（`.tsx`）
- スタイル（`.css`, Tailwind）
- TypeScript ファイル（background script を除く）

⚠️ **手動再読み込みが必要**:

- `manifest.config.ts`の変更
- Background script (`src/background/index.ts`)の変更
- アセット（`extension/public/` 以下のアイコンなど）の変更

手動再読み込み方法:

1. `chrome://extensions/`または`atlas://extensions/`
2. 「更新」ボタンをクリック

---

## ディレクトリ構造

```
extension/
├── dist/                    # ビルド出力（Git無視）
│   ├── manifest.json
│   ├── index.html
│   ├── popup.html
│   ├── options.html
│   └── assets/
├── public/                 # Vite の public ルート（そのまま dist へコピー）
│   ├── icons/
│   │   └── icon-128.png
│   ├── popup.html
│   └── options.html
├── src/
│   ├── main.tsx            # エントリーポイント
│   ├── App.tsx             # メインコンポーネント
│   ├── background/         # バックグラウンドスクリプト
│   │   ├── index.ts
│   │   └── services/
│   │       └── browser.ts  # タブ/スペース管理
│   ├── lib/                # ユーティリティ
│   ├── shared/             # 型定義
│   ├── store/              # Zustand store
│   ├── popup/              # Popup UI
│   ├── options/            # Options UI（React Hook Form + Zod）
│   └── ui/                 # UIコンポーネント
│       └── components/
├── index.html              # HTMLテンプレート
├── manifest.config.ts      # Manifest設定
├── vite.config.ts          # Vite設定
└── package.json
```

---

## 開発のベストプラクティス

### 1. コードスタイル

- **Linter**: Biome
- **フォーマット**: 保存時に自動フォーマット推奨
- **コミット前**: `pnpm lint && pnpm format`

### 2. コミットメッセージ

Conventional Commits を使用（日本語）:

```
feat: タブのピン機能を追加
fix: スペース切り替え時のバグを修正
docs: READMEにインストール手順を追加
chore: 依存関係を更新
```

### 3. ブランチ戦略

- `main`: 安定版
- `feature/*`: 新機能開発
- `fix/*`: バグ修正

### 4. テスト

両方のブラウザでテスト:

- ✅ Google Chrome
- ✅ Atlas Browser

---

## パフォーマンス最適化

### ビルドサイズ

現在のビルドサイズ（参考）:

```
dist/assets/index.html-CT0XgFcu.js  178.96 kB │ gzip: 57.84 kB
dist/assets/index-BcS_oa6B.css       16.45 kB │ gzip:  4.05 kB
dist/assets/index.ts-*.js             ~7 kB   │ gzip:  ~2 kB
```

### 最適化のヒント

1. **コード分割**: 将来的に大きくなる場合は動的インポートを検討
2. **Tree shaking**: 未使用のコードは自動的に削除される
3. **アイコン最適化**: PNG -> SVG への移行を検討

---

## CI/CD（今後の実装）

### GitHub Actions（案）

```yaml
name: Build and Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm build
```

---

## 参考資料

- [Vite Documentation](https://vitejs.dev/)
- [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin/)
- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [React Documentation](https://react.dev/)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/)

---

## 更新履歴

- 2025-11-04: 初版作成
