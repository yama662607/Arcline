## 1. Project Scaffolding
- [x] 1.1 pnpm ワークスペースを用意し、`apps/extension` に Vite + React + TypeScript + Zustand + Tailwind CSS テンプレートを作成、既存バニラ実装を `legacy/` へ退避
- [x] 1.2 Tailwind + PostCSS + Autoprefixer + `@tailwindcss/forms` を設定し、デザイン共通トークン (色/余白) を `tailwind.config.ts` に定義
- [x] 1.3 `vite-plugin-web-extension` (または同等) を設定し Manifest V3 ビルドを実行できるようにする
- [x] 1.4 Biome を ESLint/Prettier の代替として導入し、Vitest / Playwright / Biome ベースの CI テンプレートを追加

## 2. Service Worker & Infrastructure
- [x] 2.1 `manifest.config.ts` を作成し、ブラウザフラグ (sidePanel, command shortcuts, content script) を注入できるようにする
- [x] 2.2 Service Worker を TypeScript で再実装し、tabs / tabGroups / bookmarks / storage / windows API ラッパーを作成
- [x] 2.3 UI モード判定 (sidePanel / popup / window / floating) とメッセージングユーティリティを実装
- [ ] 2.4 `tanstack/query` 導入のための基盤 (QueryClient 初期化、Service Worker ブリッジ) を準備するが、使用は後続フェーズで段階的に行う

## 3. React UI Migration
- [x] 3.1 Zustand ストア (settings / spaces / tabs) を実装し、chrome.storage と同期
- [ ] 3.2 Tailwind + Headless UI を用いて垂直タブ UI, Pinned セクション, スペーススイッチャーを構築し、shadcn/ui を必要なコンポーネントから順次導入
- [ ] 3.3 React Hook Form + Zod Resolver で設定/ショートカット編集フォームを構築
- [ ] 3.4 DnD（`@dnd-kit/core` 等）・仮想リスト（`react-virtual` 等）・アニメーション（Framer Motion & Motion One）を導入し、Arcify 同等の UX を再現

## 4. Fallback UI & Testing
- [ ] 4.1 `chrome.action` ポップアップと `chrome.windows.create` フォールバックを実装
- [ ] 4.2 コンテンツスクリプトを用いたミニサイドバーを試作し、Atlas/Arc で動作確認
- [ ] 4.3 TanStack Query を必要なデータ取得に段階的に導入し、Service Worker との同期動作を検証
- [ ] 4.4 Vitest / Playwright / マルチブラウザ手動テストを整備し、自動化できる範囲を CI に組み込む

## 5. Documentation & Release Prep
- [x] 5.1 README と docs/plan を React/TS ベースに更新
- [ ] 5.2 GPL 表記やライセンス周りの UI 文言を整備
- [ ] 5.3 ベータ版リリース手順書と既知の制限事項リストを作成
