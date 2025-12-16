## Why

- 拡張機能しか作らない前提のため、`apps/extension` という階層は目的（複数アプリ運用）と乖離しており、日々の開発でのパスの深さ・認知負荷がノイズになっている。
- 初見の開発者にとって「このリポジトリの主役が Chrome Extension である」ことが直感的に伝わりづらい。

## What Changes

- `apps/extension` をリポジトリルート直下の `extension/` に移動する。
- `pnpm-workspace.yaml` を更新し、`extension` を workspace として登録する（`apps/*` は撤去する方針）。
- ルート `justfile` / ルート `package.json` / `turbo.json` / GitHub Actions などで `apps/extension` を前提としている箇所を `extension` に更新する。
- OpenSpec の `project.md` および影響を受ける仕様（例: `extension-shell`）のパス記述を更新する。

## Impact

- Affected specs:
  - `openspec/specs/extension-shell/spec.md`（`apps/extension/public` 等のパス記述）
  - `openspec/project.md`（`apps/extension/src/...` の参照）
- Affected code & config:

  - `pnpm-workspace.yaml`
  - `justfile`（`clean` 等）
  - `.github/workflows/*`（存在する場合）
  - ルート `package.json`（`--filter arcline-extension` は維持想定だが、パス参照がある場合は更新）
  - `extension` パッケージ内のスクリプト（相対パス参照の挙動が変わる可能性）

- Migration notes:
  - Chrome 拡張のローカルロード先が `apps/extension/dist` → `extension/dist` に変わる。
  - `git mv` を使用して履歴追跡可能な移動を行う。
