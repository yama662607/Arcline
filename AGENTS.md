# AGENTS.md

## 必須ワークフロー

- **編集後の品質ゲート**: 必ず `just check`（エラー時は `just fix` → `just check`）を実行し、結果を報告する。
- **UI・ショートカット・オーバーレイ・Command Bar・Background/Content Script 変更時の実機検証**:
  - `just check-extension`（実機 Brave/Chromium で 0 エラー＆reload 確認）
  - `just e2e [spec]`（Playwright 実機 E2E で対象シナリオを検証。未カバーなら追加する）
  - ちらつき・フォーカス・ポップアップ挙動など体感バグは `just debug-browser`（CDP port 9222）や Playwright DOM/スクショ計測で実画面を確認してから完了報告する。
- **プッシュ後の `mbp` 反映**: `main` へプッシュしたら、毎回 `mbp` に SSH して `git pull --ff-only origin main && just build` で最新ビルドを反映する。

## 主要コマンド

- `just check` / `just fix` — format・lint・typecheck・unit test
- `just test [args]` / `just build` — Vitest / MV3 本番ビルド
- `just check-extension` / `just e2e [args]` / `just debug-browser` — 実機検証

## プロジェクト制約

- 詳細なアーキテクチャとハマりポイントは [docs/HANDOFF_STUDIO.md](docs/HANDOFF_STUDIO.md) を参照。
- アプリ名・バージョン・コード内に `v2` 表記を入れず、素の **Arcline (`1.0.0`)** で統一する。
- `overlay.js` は MV3 `content_scripts` 制約のため `extension/vite.overlay.config.ts` で独立 IIFE ビルド（ES import ゼロ）を維持する。
- 個人データ（`StorableSidebar.json`・実データスクショ・`refs/`）は絶対にコミットしない。
