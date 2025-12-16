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

| コマンド           | 説明                               | 用途                                           |
| ------------------ | ---------------------------------- | ---------------------------------------------- |
| `just check`       | 読み取り専用の品質検証 (CI ゲート) | `fmt-check` → `lint` → `typecheck` → `test`    |
| `just fix`         | 自動修正適用                       | `fmt` → `lint-fix`                             |
| `just setup`       | 環境構築                           | 依存関係インストール + Playwright セットアップ |
| `just test [args]` | ユニット/統合テスト                | 引数パススルー対応                             |
| `just e2e [args]`  | E2E テスト                         | 引数パススルー対応                             |

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
