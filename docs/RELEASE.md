# Arcline ベータ版リリース手順書

## リリース前チェックリスト

### 1. コード品質確認
- [ ] `pnpm check` が全て通過することを確認
- [ ] `pnpm lint` でエラーがないことを確認
- [ ] `pnpm typecheck` で型エラーがないことを確認
- [ ] `pnpm test` で全てのユニットテストが通過することを確認
- [ ] `pnpm test:e2e` でE2Eテストが通過することを確認

### 2. 機能テスト
- [ ] Chrome でフローティング UI が正常に動作することを確認
- [ ] Atlas でフローティング UI が正常に動作することを確認
- [ ] Arc でフローティング UI が正常に動作することを確認
- [ ] スペース作成・削除・切り替えが動作することを確認
- [ ] タブのピン留め・解除が動作することを確認
- [ ] タブのアーカイブ・復元が動作することを確認
- [ ] 設定の保存・読み込みが動作することを確認
- [ ] DnD（ドラッグ&ドロップ）が動作することを確認

### 3. ドキュメント確認
- [ ] README.md が最新の情報に更新されていることを確認
- [ ] LICENSE ファイルが存在することを確認
- [ ] KNOWN_ISSUES.md が最新の情報に更新されていることを確認

### 4. ビルドと配布物準備
```bash
# 本番ビルドを実行
pnpm build

# ビルド成果物を確認
ls -la apps/extension/dist/

# 必須ファイルの存在確認
test -f apps/extension/dist/manifest.json
test -f apps/extension/dist/index.html
```

## リリース手順

### ベータ版リリース（GitHub Releases）

1. **バージョン番号の更新**
   ```bash
   # apps/extension/package.json の version フィールドを更新
   # 例: "0.0.1" -> "0.1.0-beta.1"
   ```

2. **変更履歴の記録**
   - CHANGELOG.md に変更内容を記録
   - 新機能、バグ修正、既知の問題を明記

3. **Git タグの作成**
   ```bash
   git add .
   git commit -m "chore: Prepare v0.1.0-beta.1 release"
   git tag v0.1.0-beta.1
   git push origin main --tags
   ```

4. **GitHub Release の作成**
   - GitHub の Releases ページで新しいリリースを作成
   - タグ: `v0.1.0-beta.1`
   - タイトル: `Arcline v0.1.0-beta.1`
   - 説明:
     ```markdown
     ## What's New
     - React + TypeScript への移行完了
     - フローティング UI の実装
     - TanStack Query による状態管理の改善
     - DnD（ドラッグ&ドロップ）のサポート

     ## Known Issues
     詳細は [KNOWN_ISSUES.md](./docs/KNOWN_ISSUES.md) を参照してください。

     ## Installation
     1. `dist.zip` をダウンロード
     2. Chrome で `chrome://extensions/` を開く
     3. 「デベロッパーモード」を有効化
     4. 「パッケージ化されていない拡張機能を読み込む」をクリック
     5. 解凍した `dist` フォルダを選択
     ```
   - ビルド成果物（`apps/extension/dist`をzipしたもの）を添付
   - "This is a pre-release" にチェック

5. **リリースノートの公開**
   - GitHub Release を公開
   - Discord/Twitter などでアナウンス（必要に応じて）

### Chrome Web Store への公開（将来）

1. **Chrome Web Store デベロッパーダッシュボード**
   - https://chrome.google.com/webstore/developer/dashboard にアクセス
   - "New Item" をクリック

2. **拡張機能のアップロード**
   - `apps/extension/dist` をzip化してアップロード
   - ストアの説明文、スクリーンショット、アイコンを設定

3. **審査の提出**
   - プライバシーポリシーのURL（必要に応じて作成）
   - 単一目的の説明（"Vertical tab management for Chromium browsers"）
   - 審査を提出

4. **審査完了後の公開**
   - 審査が通過したら公開設定を行う

## ロールバック手順

問題が発生した場合：

1. **GitHub Release の取り下げ**
   - 問題のあるリリースを Draft に戻す
   - 既知の問題を Issue に記録

2. **緊急修正版のリリース**
   ```bash
   # 修正を実装
   git add .
   git commit -m "fix: Critical bug fix"

   # パッチバージョンを上げる
   # 例: "0.1.0-beta.1" -> "0.1.0-beta.2"

   git tag v0.1.0-beta.2
   git push origin main --tags
   ```

3. **新しいリリースの作成**
   - 修正内容を明記したリリースノートを作成
   - ビルド成果物を再度添付

## リリース後の確認事項

- [ ] GitHub Release が正常に公開されていることを確認
- [ ] ダウンロードリンクが有効であることを確認
- [ ] インストール手順が正確であることを確認
- [ ] 既知の問題がドキュメントに記載されていることを確認
- [ ] ユーザーからのフィードバックを GitHub Issues で受け付ける体制を整える

## サポートとフィードバック

- GitHub Issues: https://github.com/anthropics/arcline/issues
- Discussions: https://github.com/anthropics/arcline/discussions
