# Change Proposal: React/TypeScript リアーキテクチャ

## Change ID
`refactor-react-migration`

## Summary
- 既存のバニラ JavaScript 実装 (Arcify クローン) を React + TypeScript + Vite ベースのモダン構成へ段階的に移行する。
- Atlas/Arc など sidePanel 非対応ブラウザでも利用できるよう、UI 表示モードのフォールバック戦略を組み込む。
- Tailwind CSS・Headless UI・React Hook Form・Biome 等のモダンスタックを採用し、効率的な開発環境と一貫したスタイリングを確立する。
- 将来的な機能追加に耐えられるテスト/CI 基盤を整備する。

## Motivation
- 既存コードは巨大な単一ファイル構成のため保守が難しく、Atlas 固有機能の拡張が困難。
- React + TypeScript によって状態/ビューの分離、型安全性、コンポーネント再利用性を高める。
- sidePanel 未対応ブラウザへの対応をプロジェクト初期から考慮し、共通 UX を提供する。

## Scope
### In Scope
- Vite + React + TypeScript + Zustand + Zod + Tailwind を用いた新しい拡張テンプレートの導入。
- Manifest/Service Worker の TypeScript 化と API feature detection 実装。
- React + Tailwind + Headless UI を用いて垂直タブ UI・スペース UI を再実装。
- ポップアップ/独立ウィンドウ/フローティング UI などフォールバック手段の実装。
- Lint/テスト/CI パイプラインの整備。
- Arcify に存在するブックマーク同期・自動アーカイブ・タブ名上書きなど独自ユーティリティを TypeScript に再構築する。
- タブコンテキストメニューとキーボードショートカット (`quickPinToggle` 等) を React ↔ Service Worker 間で再実装し、Atlas/Arc でも同等の操作体験を提供する。
- コードリーディングガイドやフォールバック戦略を含むドキュメント整備。

### Out of Scope
- Atlas 専用の AI エージェント統合機能 (別変更で扱う)。
- 既存仕様を超える大幅な UI デザイン刷新 (まずは Arcify 同等を再現)。ただし、shadcn/ui などを用いたカスタマイズ可能なテーマ構造は段階的に検討する。
- モバイルブラウザ対応。
- Chrome Web Store での公開ポリシー適合度調査や Atlas 固有の AI エージェント統合など、本提案の範囲を超える機能追加。

## Impact
- **開発者**: 型とコンポーネントにより変更が容易になる。初期学習コストは上がるが、保守性が向上。
- **ユーザー**: Atlas/Arc などでも UI が利用可能になり、サイドパネルとの機能差が減る。
- **パフォーマンス**: 仮想リストやコード分割を前提に設計し、Arcify と同等の応答性を目標とする。

## Dependencies / Risks
- 大規模なリライトのため、段階的な移行と継続的なブラウザテストが必要。
- React 化に伴うバンドルサイズ増大を最適化で吸収する必要がある。

## Open Questions
- Atlas 固有 API (AI エージェント連携) のエンドポイントや制限事項は後続調査。
- Chrome Web Store でのポリシー遵守 (フォールバック UI が問題ないか) を確認する必要がある。
