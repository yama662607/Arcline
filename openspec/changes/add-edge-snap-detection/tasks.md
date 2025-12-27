## 1. 計測とデバッグ

- [ ] 1.1 Edge Detection Debug に `screenX`, `windowScreenX`, `distanceFromWindowEdge`, `velocityX`, `lastEventType`, `state` を表示
- [ ] 1.2 調整用定数（しきい値・スイッチ）をホットリロード可能な設定オブジェクトとして公開し、Debug UI から変更できるようにする

## 2. エッジ検知ロジック

- [ ] 2.1 pointermove / pointerrawupdate で `getCoalescedEvents()` を用い、速度とホットゾーン通過を記録
- [ ] 2.2 pointerleave (window level) で「左向き + 画面外」推論を実装し、条件を調整可能な定数に集約
- [ ] 2.3 推論発火時のログ/テレメトリ（dev console）追加、誤爆防止のデバウンス共有

## 3. テスト・検証

- [ ] 3.1 just check（lint/format/type/test）を通す
- [ ] 3.2 高速移動・サイドパネル表示・複数 DPI など代表シナリオで手動検証し、閾値を最終調整（必要なら README に記録）
