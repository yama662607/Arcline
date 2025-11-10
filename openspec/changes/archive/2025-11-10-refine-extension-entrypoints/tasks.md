## 1. 静的アセット整理
- [x] 1.1 既存のアイコン/静的ファイルを `apps/extension/public/` に集約し、参照箇所（manifest・コード）を更新する
- [x] 1.2 `apps/extension/docs` などの記述を最新構成に追随させる

## 2. Popup / Options エントリー整備
- [x] 2.1 `public/popup.html` を整備し、`src/popup/index.tsx` を唯一のエントリーポイントにする
- [x] 2.2 新規 `public/options.html` + `src/options/` を追加し、React Hook Form + Tailwind を前提とした UI シェルを実装する
- [x] 2.3 manifest と `@crxjs` 設定を更新し、Side Panel / Popup / Options の各入口を確認する

## 3. テスト・ドキュメント
- [x] 3.1 `pnpm check` および Vitest/Playwright など必要なテストを実行して新構成を検証する
- [x] 3.2 README / 開発手順、openspec スペックに今回の変更点を反映する
