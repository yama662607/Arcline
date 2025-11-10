# 変更提案: タブ検索機能の追加

## Change ID
`add-tab-search`

## Why
- ユーザーが多数のタブやスペースを持っている場合、目的のタブを見つけるのが困難
- スペースを跨いだタブ検索機能がないため、どのスペースにタブがあるか分からない場合に不便
- キーボードショートカットで素早くタブにアクセスできる機能が求められている

## What Changes
- 全スペース横断のタブ検索機能を実装
- ファジー検索（タイトル、URL、ドメイン名で検索）
- キーボードショートカット（Ctrl/Cmd+K）で検索パネルを開く
- 検索結果からタブをアクティブ化・移動・クローズできる
- 検索履歴の保存（オプション）

## Scope

### In Scope
- 検索 UI コンポーネントの実装（shadcn/ui Dialog + Command パレット）
- ファジー検索アルゴリズムの実装（fuse.js またはカスタム実装）
- キーボードショートカット（Ctrl/Cmd+K）の登録
- 検索結果の表示と絞り込み
- 検索結果からのタブ操作（アクティブ化、移動、クローズ）
- すべての UI モード（side panel, popup, floating）での動作

### Out of Scope
- 高度なフィルタリング（日付範囲、タグなど）
- ブックマーク検索の統合
- 履歴検索
- AI による検索候補

## Impact
- **ユーザー**: 大量のタブを持つユーザーの生産性が向上
- **開発者**: 新しい検索ロジックとUI コンポーネントの追加
- **パフォーマンス**: 検索インデックスのメモリ使用量（軽微）

## Affected Specs
- tab-search (新規)

## Affected Code
- `apps/extension/src/ui/components/TabSearch.tsx` (新規)
- `apps/extension/src/hooks/use-tab-search.ts` (新規)
- `apps/extension/src/background/index.ts` (キーボードショートカット追加)
- `apps/extension/manifest.config.ts` (commands 追加)
