## 1. Implementation

1.1 既存のスワイプ/遷移ロジックと UI 構造を整理し、現状の依存関係を短くメモする

1.2 ジェスチャーの状態機械（idle→tracking→locked→committing→cooldown）と判定ルールを実装設計に落とし込む

1.3 ハンドオフ情報（direction / progress / mode / timestamp）の受け渡し方式を確定し、Service Worker 側の保持/取得手順を決める

1.4 `floating-gestures` を意図ロック＋指離し確定＋慣性無視のロジックに置き換える

1.5 `SpaceContentView` のスライド対象を「Space Header / Pinned / Temporary / NewTabButton」に揃える

1.6 停止型（継続）とフリック型（完了後切替）のアニメーションを実装し、移動先での継続表示を追加する

1.7 Bottom Space Bar からの切替をフリック型と同じ遷移制御に統一する

1.8 単体テストを追加/更新する（意図ロック判定、指離し確定、進捗処理）

1.9 関連する Playwright 既存テストがあれば導線更新を行う

1.10 品質ゲート

- 1.10.1 `pnpm openspec validate update-floating-space-swipe-transition --strict`
- 1.10.2 `just check`, `just e2e`

## 2. Approval Gate

2.1 proposal.md / design.md / specs のレビューを受けて実装着手の承認を得る
