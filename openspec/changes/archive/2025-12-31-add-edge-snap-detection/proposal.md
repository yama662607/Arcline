## Why

- 高速カーソル移動やブラウザ UI（非クライアント領域）に入った際、pointermove が間引き/途絶することでホットゾーンを通過しても Floating Sidebar が起動しない
- デバッグ情報が不足しており、環境差（screenX, velocity など）を可視化しづらい

## What Changes

- getCoalescedEvents / pointerleave 推論を前提とした「左向き速度 + 画面外逸脱」検知を追加し、推論条件を定数化
- Edge Detection Debug ウィンドウを拡張し、しきい値や実測値（screenX、velocity、state 等）をリアルタイム表示 & 変更できるようにする
- 定数を content script から参照できる設定ホルダーにまとめ、調整値をデバッグ UI から注入できる API を用意

## Impact

- Affected specs: floating-sidebar
- Affected code: `extension/src/content-scripts/floating-ui.ts`, `edge-detection-debug.ts`, 共有ユーティリティ
- QA: エッジ検知成功率向上、誤爆抑制シナリオの追加テストが必要

## Risks

- 推論起動の誤発火（screenX や velocity の閾値が環境依存）
- 追加イベントリスナーによるパフォーマンス影響（pointerleave / coalesced processing）
