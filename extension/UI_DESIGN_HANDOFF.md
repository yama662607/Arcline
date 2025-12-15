# UI デザイン改良 引き継ぎドキュメント

## プロジェクト概要

Chrome 拡張機能 **Arcline** の UI デザイン改良を依頼します。

### プロジェクト構造

- **場所**: `/Users/daisukeyamashiki/Library/Mobile Documents/com~apple~CloudDocs/Programming/Arcline/apps/extension/`
- **技術スタック**:
  - React + TypeScript
  - Tailwind CSS
  - shadcn/ui + Radix Primitives
  - Next.js (App Router)
  - Vitest + React Testing Library

### 現在の状態

- ✅ すべてのテストが通過（70 個）
- ✅ TypeScript エラー解消済み
- ✅ lint/format 完了
- ⚠️ テスト内に`any`型の警告あり（22 個）- テスト安定性のため許容

## UI コンポーネント現状

### 主要コンポーネント

1. **SpaceManager** - スペース管理画面
2. **EnhancedTabList** - タブリスト表示
3. **Popup/Floating UI** - ポップアップインターフェース

### 現在のデザイン課題

1. **ボタンのネスト問題**: SpaceManager で`<button>`内に`<button>`がある（hydration エラー）
2. **アクセシビリティ**: Radix Primitives ベースだが改善の余地あり
3. **レスポンシブデザイン**: 現在の対応状況不明
4. **視覚的階層**: 色使い、間隔、タイポグラフィの統一性

## 依頼内容

### 優先度：高

1. **ボタンネスト問題の解決**

   - `src/ui/components/SpaceManager.tsx` の HTML 構造を修正
   - アクセシビリティを維持したまま、ボタンのネストを解消

2. **デザインシステムの統一**
   - カラーパレットの整理と一貫性
   - タイポグラフィスケールの定義
   - コンポーネント間の間隔（spacing）の統一

### 優先度：中

3. **アクセシビリティ向上**

   - キーボードナビゲーションの改善
   - スクリーンリーダー対応の強化
   - ARIA 属性の適切な使用

4. **視覚的改善**
   - モダンな UI パターンの採用
   - アニメーションとトランジションの追加
   - フィードバック（hover, active, focus 状態）の改善

### 優先度：低

5. **レスポンシブ対応**
   - 異なる画面サイズでの表示最適化
   - モバイルフレンドリーなインターフェース

## 技術的制約

### 守るべきこと

- **shadcn/ui + Radix Primitives** ベースを維持
- **Tailwind CSS** を使用
- **TypeScript strict モード** を維持
- **テストカバレッジ** を維持（現在 70 個のテスト）

### 既存のデザインシステム

- カラー: `bg-surface`, `bg-surface-light`, `border-surface-light` など
- コンポーネント: Button, Card, Dialog などは shadcn/ui ベース

## テストに関する注意

### 現在のテスト状況

- `any`型をモックに使用（型安全性よりテスト安定性を優先）
- 変更する場合は**すべてのテストが通過すること**を確認
- `pnpm test` と `pnpm check` で検証

### テスト実行コマンド

```bash
pnpm test          # すべてのテスト実行
pnpm check         # lint + format + typecheck
pnpm typecheck     # TypeScript型チェックのみ
```

## ファイル構造（関連 UI）

```
src/
├── ui/
│   ├── components/
│   │   ├── SpaceManager.tsx          # 🎯 主要改善対象
│   │   ├── EnhancedTabList.tsx       # 🎯 改善対象
│   │   ├── SpaceManager.test.tsx     # ⚠️ テスト注意
│   │   └── EnhancedTabList.test.tsx  # ⚠️ テスト注意
│   └── lib/                          # UIユーティリティ
├── shared/
│   └── types.ts                      # 型定義
└── background/                       # バックグラウンド処理
```

## 次の AI Agent への指示

### 開始前に

1. `pnpm check` で現在の状態を確認
2. `pnpm test` ですべてのテストが通過することを確認

### 作業進め方

1. **ボタンネスト問題**から着手（最優先）
2. 各変更後にテスト実行を徹底
3. 大きな変更は小さな PR に分けて

### 品質基準

- ✅ すべてのテスト通過
- ✅ TypeScript エラーなし
- ✅ lint 警告なし
- ✅ アクセシビリティ標準準拠
- ✅ 既存デザインパターンとの一貫性

## 連絡事項

### 現在の問題点

- SpaceManager のボタンネストによる hydration エラー
- テスト内の`any`型警告（将来的に改善希望）

### 成功指標

- HTML 構造の妥当性（ボタンネスト解消）
- アクセシビリティスコア向上
- デザインの一貫性
- ユーザーエクスペリエンスの改善

---

**作成日時**: 2025-11-17
**担当前回**: Cascade（テスト修正と型エラー解消）
**次担当**: UI デザイン専門 AI Agent
**期待納期**: 要相談
