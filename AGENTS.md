<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

## just コマンド運用ルール（AI Agent Protocol）

### 🤖 基本方針

- **デフォルト動作**: `just`（引数なし） = `just check`
- **AI エージェント必須手順**: **ファイル編集・生成後は必ず `just check` を実行**し、結果をレポートに記載
- **第一手**: エラー時は `just fix` で自動修正を適用してから `just check` で再検証

### 📋 標準インターフェース

| コマンド                | 説明                               | 用途                                                       |
| ----------------------- | ---------------------------------- | ---------------------------------------------------------- |
| `just check`            | 読み取り専用の品質検証 (CI ゲート) | `fmt-check` → `lint` → `typecheck` → `test`                |
| `just fix`              | 自動修正適用                       | `fmt` → `lint-fix`                                         |
| `just setup`            | 環境構築                           | 依存関係インストール                                       |
| `just setup-refs`       | 参考 OSS リポジトリ取得            | `refs/`（gitignore 済み）へ 5 リポジトリを shallow clone   |
| `just test [args]`      | ユニット/統合テスト                | Vitest 引数パススルー対応                                  |
| `just check-extension`  | 実機ランタイム診断                 | Brave/Chromium + `chrome.developerPrivate` 0 エラー＆reload |
| `just e2e [args]`       | 実機 E2E テスト                    | Playwright（左端ホバー・ワークフロー・耐障害性・Visual QA）|
| `just debug-browser`    | CDP 対話デバッグ用ブラウザ起動     | 隔離 Brave（port 9222）＋`--cdp-endpoint` MCP 接続用       |
| `just visual-arc`       | 実データ Arc 比較撮影              | `StorableSidebar.json` 取込＆2x Retina 比較撮影            |

### 📌 Arcline 開発コンテキスト / 引き継ぎ

- 全体アーキテクチャ・検証手順・ハマりポイントは **[docs/HANDOFF_STUDIO.md](docs/HANDOFF_STUDIO.md)** を最初に参照すること。
- バージョン・アプリ名・フォルダ名・ブランチ名・コード内に `v2` などの表記を入れず、素の **Arcline (`1.0.0`)** として統一すること。
- `overlay.js` は MV3 `content_scripts` 制約のため `extension/vite.overlay.config.ts` で独立 IIFE ビルド（ES import ゼロ）を維持すること。
- 個人データ（`StorableSidebar.json`・実データスクショ・`refs/`）は絶対に git にコミットしないこと。

### 🧩 粒度別タスク

- **Format**: `just fmt-check` (検証) / `just fmt` (修正)
- **Lint**: `just lint` (検証) / `just lint-fix` (修正)
- **Typecheck**: `just typecheck` (型チェック)

### 🛠️ 運用 & ユーティリティ

- `just dev` … 開発サーバー起動
- `just build` … 本番ビルド
- `just clean` … アーティファクト削除


### ⚠️ 重要事項

- **CI 互換**: `just check` は CI と同等の品質ゲートを実行
- **読み取り専用 vs 修正**: `check` は検証のみ、`fix` は修正適用
- **引数パススルー**: `test` と `e2e` は引数を受け取り可能（例: `just test src/lib/auth`）

これらのルールは openspec ドキュメント更新時にも再確認し、変更があれば速やかに本ファイルを更新してください。
