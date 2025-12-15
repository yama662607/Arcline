## Context

本プロジェクトは Floating UI（Web ページ上のオーバーレイ）と Side Panel（extension page）を併せ持つ。
しかし両者が同時に動作すると、React Query のキャッシュ・refetch、状態購読、イベントリスナが二重化し、性能/メモリ/UX の問題が生じる。

## Goals / Non-Goals

- Goals:
  - UI surface を常に 1 つに保つ（single surface）
  - Floating をデフォルトにする
  - モード切替時の teardown を確実にし、常駐コストを最小化する
- Non-Goals:
  - iframe 化による UI 統合
  - UI デザイン刷新

## Decisions

- Decision: UI モード決定は background を唯一の真実（SSOT）にする
  - 理由: content script と extension page の両方を統制でき、同時表示ゼロを保証しやすい
- Decision: Floating UI は content script + ShadowRoot mount を維持する
  - 理由: iframe より軽量で、ポインタ/フォーカス/ショートカットの取り回しが単純
- Decision: extension page（App.tsx）は side-panel 用に限定し、floating 時は本 UI を描画しない
  - 理由: React/Query の二重起動を根絶する

## Performance Considerations

- Lazy import（`import('../floating/mount')`）を維持し、起動まで JS を読み込まない
- `currentUiMode !== 'floating'` では floating root と React tree を破棄する
- デバッグ UI（エッジ検出オーバーレイ等）の本番常時有効は避け、常駐 DOM/ログを削減する

## Risks / Trade-offs

- Side Panel を強制的に閉じる挙動はブラウザ差異があり得る
  - Mitigation: 閉じられない場合は extension page 側で「無効化表示」にフォールバック
- 既存の preview UI（floating/sidepanel 切替）を除去すると開発体験が変わる
  - Mitigation: 開発専用フラグ/ビルド分岐（必要なら）で限定的に残す

## Migration Plan

- Settings.uiMode が未設定の既存ユーザーは floating にフォールバックする
- 既存設定で side-panel を選んでいるユーザーは従来通り side-panel を優先する

## Open Questions

- floating 既定時に extension page を自動で閉じる経路（API/権限）をどこまで保証できるか
- Debug overlay の有効化導線（開発向け）をどう提供するか
