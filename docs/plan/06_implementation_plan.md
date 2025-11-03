# 06. 実装ロードマップ

このロードマップは、Arcify をベースにした既存の JavaScript 実装を出発点とし、React + TypeScript を用いた Atlas / Arc 対応のモダンな拡張機能へと段階的に刷新するための工程表である。各フェーズは前段の成果物を前提条件とし、着手前に仕様とテスト観点を明確にすること。

## フェーズ0: 環境整備とベースライン

- Vite + React + TypeScript + Zustand + Zod のひな形を `apps/extension` ディレクトリに作成（モノレポ化する場合は pnpm workspace を構築）。
- `vite-plugin-web-extension` もしくは `@crxjs/vite-plugin` を導入し、Manifest V3 のビルドパイプラインを整える。
- 既存 Arcify から流用するアセット（アイコン、画像、スタイル）の棚卸しを行い、`public/` または `assets/` に配置する。
- ESLint + Prettier + Stylelint + Vitest の共通設定を追加し、CI（GitHub Actions）のテンプレートを用意する。

## フェーズ1: Manifest と Service Worker のTypeScript化

- `manifest.json` を TypeScript で生成する仕組み（`manifest.config.ts` 等）を整備し、ブラウザごとのフラグ（sidePanel 対応可否）を切り替えられるようにする。
- Service Worker（`background.ts`）を TypeScript 化し、`chrome.*` API の型定義を導入（`@types/chrome`）。
- sidePanel 可否の Feature Detection、フォールバックモード判定、メッセージング基盤（`chrome.runtime.onMessage` / `chrome.tabs.sendMessage`）をユーティリティ化する。

## フェーズ2: 状態管理レイヤーの実装

- Zustand ストアを `settingsSlice`, `spacesSlice`, `tabsSlice` などのスライスに分割して実装。
- `chrome.storage` との同期ロジック、初期データロード、永続化ミドルウェアを実装し、Vitest でユニットテストを追加。
- ブラウザ API（tabs / tabGroups / bookmarks / sessions）の操作をカプセル化した `services/browser` モジュールを作成し、Service Worker から呼び出す。

## フェーズ3: React UI の構築

- サイドパネル（またはポップアップ）用の React エントリーポイントを作成し、アプリケーションシェル（ナビゲーション、ヘッダー、ステータスバー）を実装。
- 垂直タブリスト、Pinned セクション、スペーススイッチャーなど、Arcify の既存レイアウトを React コンポーネントとして再構築。
- DnD（`@dnd-kit/core` など）と仮想リスト（`react-virtual` 等）を導入し、1,000 タブ規模でも滑らかに描画できることを確認する。
- Framer Motion などを用いてスペース切替・タブ移動のアニメーションを実装。

## フェーズ4: フォールバック UI の実装

- `chrome.sidePanel` 非対応ブラウザ向けに、`chrome.action` ポップアップと `chrome.windows.create` による独立ウィンドウを実装し、Service Worker の検出結果で自動切替する。
- コンテンツスクリプトベースの「フローティングミニサイドバー」を試作し、Atlas 等の制約ブラウザでも最低限のナビゲーションが可能なことを検証。
- キーボードショートカット（`commands` API）とフォールバック UI の連携を確認。

## フェーズ5: 機能拡張と Atlas 向け調整

- コマンドパレット、AI インテグレーション（Atlas のエージェント API と連携する場合は専用モジュールを用意）を実装。
- ブックマーク同期、スペースのエクスポート / インポート、オートアーカイブロジックを TypeScript + React の構造に合わせて移植。
- 国際化（i18next 等）、アクセシビリティ（ARIA ランドマーク、キーボードナビゲーション）対応を行う。

## フェーズ6: 品質保証とリリース準備

- Vitest によるユニットテスト充実、Playwright で主要ユーザーフローを自動化。
- Webpack Bundle Analyzer 等でバンドルサイズを計測し、コード分割や遅延読み込みを調整。
- Beta チャネルを通じて Atlas / Arc / Chrome / Brave での受け入れテストを実施し、フォールバックモードが期待通り動作することを確認。
- `semantic-release` と GitHub Actions を設定し、バージョニング・CHANGELOG・リリースアセット生成を自動化。

## マイルストーン

1. **M1**: フェーズ2まで完了（TypeScript 化 + Zustand ストア + ビルドパイプライン）
2. **M2**: フェーズ3（React UI の主要コンポーネント）が完成し、Chrome 上で Arcify 同等の操作が可能
3. **M3**: フォールバック UI を含むフェーズ4が完了し、Atlas/Arc でも基本操作が可能
4. **M4**: フェーズ5〜6で拡張機能を Beta 公開、AI アシストや追加機能を備えた MVP をリリース

各マイルストーン到達時には、仕様書と OpenSpec の更新、テスト結果の共有、既知の制限事項リストの更新を必ず行うこと。
