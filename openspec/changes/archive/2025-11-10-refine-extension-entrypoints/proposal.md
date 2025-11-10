## Why
- 静的アセットが `src/` 配下やルートに散在しており、Vite の `public/` フローを活かせていないため、manifest の参照先や配布物が分かりにくくなっています。
- Popup/Side Panel/Options のエントリーポイントが混在しているため、マルチページ構成や将来の拡張時に混乱が生じます。
- オプション UI が未整備なため、設定系機能の導入・テストが滞っています。

## What Changes
- アイコンなどの共通アセットを `apps/extension/public/` 以下に整理し、manifest からの参照を一本化します。
- Popup HTML を `public/popup.html` として配置し、`@crxjs` + Vite のマルチエントリーポイント規約に合わせます。
- React/Tailwind ベースの Options ページ（`public/options.html` + `src/options`）を追加し、設定 UI の骨格とルーティングを整えます。
- ドキュメント/テスト戦略に新たな配置と Options ページの動作確認手順を追記します。

## Impact
- Affected specs: extension-shell
- Affected code: apps/extension/manifest.config.ts, apps/extension/vite.config.ts, apps/extension/src/**/* (popup/options), apps/extension/public/**/*, docs/development-setup.md
