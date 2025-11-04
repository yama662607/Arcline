## 1. 仕様策定と準備
- [ ] 1.1 既存 Arcify レイアウトとの差分を洗い出し、保持すべき UI コンポーネント/ボタン配置を一覧化する
- [ ] 1.2 Service Worker / React UI / コンテンツスクリプトの責務境界を図式化し、ドキュメントに反映する
- [ ] 1.3 Performance 指標（初期ロード <=180KB、表示遅延 <=150ms、メモリ <=60MB、常時タイマー無し）を計測方法とともにチームへ共有する

## 2. 実装
- [ ] 2.1 `manifest.config.ts` にコンテンツスクリプト定義を追加し、Atlas 判定時に注入されるよう Service Worker を拡張する
- [ ] 2.2 コンテンツスクリプトでホットゾーンと Shadow DOM ルートを生成し、React エントリポイントを遅延ロードする
- [ ] 2.3 既存 React 垂直タブ UI を `React.lazy` + Suspense で再利用し、モード別スタイル差分を Tailwind で切り替える
- [ ] 2.4 ホットゾーン hover / pointerleave、クリック固定などの挙動を実装し、Framer Motion 等でスライドイン・アウトを 16ms/フレーム以内で描画する
- [ ] 2.5 `chrome://` などコンテンツスクリプト不可ページでポップアップへ誘導するメッセージと UI を実装する
- [ ] 2.6 Atlas でのフォールバックを想定し、Service Worker の UI モード保存ロジックを更新する

## 3. テスト & ドキュメント
- [ ] 3.1 Playwright でホットゾーン hover→UI 表示の自動テスト（Chromium）を追加し、Atlas は手動チェック手順を docs に追記する
- [ ] 3.2 bundle レポート・Performance 計測結果を共有し、指標を満たしていることを確認する
- [ ] 3.3 docs/browser-compatibility.md と開発ガイドに Atlas モードとフローティング UI の仕様・制限を追記する
- [ ] 3.4 `openspec validate add-floating-ui --strict` を通過する
