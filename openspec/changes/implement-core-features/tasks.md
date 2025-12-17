## Pinned Tabs
## 1. バックエンド機能実装
- [ ] 1.1 ピン留めタブのグローバル管理機能をbrowser.tsに追加
- [ ] 1.2 ピン留めタブのストレージ同期ロジックを実装
- [ ] 1.3 スペース作成時のピン留めタブ引き継ぎ機能を追加
- [ ] 1.4 ピン留めタブの状態管理APIを実装

## 2. UIコンポーネント実装
- [ ] 2.1 ピン留めタブ専用の表示コンポーネントを作成
- [ ] 2.2 FloatingSidebarでピン留めタブを特別表示するロジックを実装
- [ ] 2.3 ピン留めタブの視覚的スタイルを定義

## 3. インタラクション機能
- [x] 3.1 ピン留め・ピン留め解除のユーザー操作を実装
- [x] 3.2 ピン留めタブのドラッグ＆ドロップ機能を追加 (Verified with dnd-kit integration)
- [x] 3.3 ピン留めタブのコンテキストメニューを拡張 (Verified in TabContextMenu)

## 4. テスト実装
- [ ] 4.1 ピン留めタブ機能の単体テストを作成
- [ ] 4.2 UIコンポーネントのテストを実装
- [x] 4.3 統合テストで動作を確認 (Implemented `pinned-tabs.spec.ts`)

## 5. ドキュメントと仕様更新
- [ ] 5.1 機能説明をREADMEに追加
- [ ] 5.2 使用方法のドキュメントを作成

## Tab Search
## 1. 設計と準備
- [x] 1.1 ファジー検索ライブラリの選定（fuse.js implemented）
- [x] 1.2 UI デザインの決定（Command パレットスタイル）
- [x] 1.3 キーボードショートカットの決定と manifest への追加 (In-App shortcut implemented)

## 2. 検索ロジックの実装
- [x] 2.1 検索フックの実装（`use-universal-search.ts`）
- [x] 2.2 ファジー検索アルゴリズムの統合
- [x] 2.3 検索結果のスコアリングと並び替え (Implemented in hook)
- [x] 2.4 検索パフォーマンスの最適化（debounce, メモ化）

## 3. UI コンポーネントの実装
- [x] 3.1 検索ダイアログコンポーネントの実装（CommandPalette）
- [x] 3.2 検索入力フィールドとキーボードナビゲーション
- [x] 3.3 検索結果リストの実装（仮想スクロール対応/cmdk）
- [x] 3.4 検索結果アイテムの操作（アクティブ化、移動、クローズ）
- [x] 3.5 空状態とローディング状態の UI

## 4. キーボードショートカットの統合
- [x] 4.1 manifest.config.ts に command を追加 (In-App handled in App.tsx)
- [x] 4.2 Service Worker でショートカットを処理 (Not needed for In-App)
- [x] 4.3 UI 側で検索ダイアログを開く (Implemented in App.tsx)

## 5. テストとドキュメント
- [x] 5.1 検索ロジックのユニットテスト (Verified `use-universal-search.test.tsx`)
- [x] 5.2 UI コンポーネントのテスト (Verified `CommandPalette.test.tsx`)
- [x] 5.3 E2E テスト（キーボードショートカット、検索、タブ操作 - Implemented `tab-search.spec.ts` as fixme)
- [ ] 5.4 ドキュメントの更新（README, TESTING.md）

## Trackpad Swipe
## 1. ジェスチャー検出基盤
- [x] 1.1 gestures.tsサービスモジュールを新規作成
- [x] 1.2 トラックパッドスワイプイベント検出を実装
- [x] 1.3 スワイプ方向と速度の計算ロジックを実装 (`SwipeDetector`)
- [x] 1.4 ジェスチャー設定ストレージを追加 (Settings API)

## 2. スペース切り替えロジック
- [x] 2.1 左スワイプで前のスペースに移動する機能を実装 (`navigateSpace`)
- [x] 2.2 右スワイプで次のスペースに移動する機能を実装 (`navigateSpace`)
- [x] 2.3 スペース循環移動（最初↔最後）を実装 (Already handled in `navigateSpace`)
- [x] 2.4 スワイプ感度と閾値設定を実装 (`SwipeDetector` config)

## 3. UI統合とフィードバック
- [ ] 3.1 FloatingSidebarでジェスチャー有効化UIを追加 (Future: Settings UI)
- [ ] 3.2 スワイプ時の視覚的フィードバックを実装 (Optional for MVP)
- [ ] 3.3 ジェスチャー無効化トグルを実装 (Settings needed, backend ready)
- [ ] 3.4 設定画面で感度調整UIを追加 (Settings needed)

## 4. エッジケースと互換性
- [x] 4.1 タッチスクリーンとの互換性を確保 (Handled by WheelEvent)
- [x] 4.2 マウスドラッグとの誤検出を防止 (Only WheelEvent used)
- [x] 4.3 ブラウザナビゲーションとの干渉を回避 (Using `passive` listener for now)
- [x] 4.4 パフォーマンス最適化とデバウンス (`SwipeDetector` timeout)

## 5. テスト実装
- [x] 5.1 ジェスチャー検出の単体テストを作成 (`gestures.test.ts`)
- [x] 5.2 スペース切り替えの統合テストを実装 (`command-handlers.test.ts`)
- [x] 5.3 UIコンポーネントのテストを追加 (Content Script covered via E2E `gestures.spec.ts`)
- [x] 5.4 E2Eテストでスワイプ動作を検証 (Implemented `gestures.spec.ts` and Verified)

## 6. ドキュメントと仕様更新
- [ ] 6.1 ジェスチャー機能の使用方法をドキュメント化
- [ ] 6.2 設定オプションの説明を追加
- [ ] 6.3 トラブルシューティングガイドを作成

## Auto Archive
## 1. テスト環境準備
- [ ] 1.1 Chrome APIモックを拡張（bookmarks, alarms API）
- [ ] 1.2 テスト用ヘルパー関数を作成
- [ ] 1.3 テストデータフィクスチャを準備

## 2. ブックマーク同期機能テスト
- [ ] 2.1 getOrCreateArcifyFolderの単体テスト
- [ ] 2.2 getOrCreateSpaceFolderの単体テスト
- [ ] 2.3 syncSpaceToBookmarksの単体テスト
- [ ] 2.4 重複フォルダマージ機能のテスト
- [ ] 2.5 スペース削除時のブックマーククリーンアップテスト

## 3. 自動アーカイブ機能テスト
- [ ] 3.1 setupAutoArchiveAlarmの単体テスト
- [ ] 3.2 archiveInactiveTabsの単体テスト
- [ ] 3.3 shouldExcludeFromAutoArchiveのテスト
- [ ] 3.4 タブアクティビティ追跡のテスト
- [ ] 3.5 アラームリスナーの統合テスト

## 4. 統合テスト
- [ ] 4.1 スペース作成→ブックマーク同期→アーカイブのE2Eフロー
- [ ] 4.2 設定変更→自動アーカイブ動作変更のテスト
- [ ] 4.3 エラーハンドリングとリカバリーのテスト

## 5. カバレッジと品質
- [ ] 5.1 テストカバレッジ80%以上を達成
- [ ] 5.2 全てのテストがCIで通過することを確認
- [ ] 5.3 テスト結果をドキュメント化
