# 調査ドキュメント（Investigation）

このディレクトリには、Arcline の実装において遭遇した技術的課題の調査結果と分析レポートが含まれています。

---

## ドキュメント一覧

### 1. `arc-browser-edge-detection-analysis.md`
**Arc ブラウザのエッジ検知・Floating Sidebar 実装の詳細分析**

**調査日**: 2025-12-19

**内容**:
- Arc の技術スタック（Swift, AppKit）
- エッジ検知の核心メカニズム（SidebarDragRegionWindow, NSTrackingArea）
- 多層トラッキング戦略（5つのトラッカー）
- Arc と Arcline の根本的な違い
- **推奨実装プラン**（Phase 1〜4）
  - Phase 1: getCoalescedEvents() で間引き補正
  - Phase 2: pointerleave 推論で境界到達補完
  - Phase 3: screenX 座標による境界近接判定
  - Phase 4: chrome.windows API 連携（オプション）

**主な発見**:
- Arc は Electron **ではなく**、完全ネイティブ macOS アプリ
- 専用の透明ウィンドウ（SidebarDragRegionWindow）を画面端に配置
- OS レベル（NSTrackingArea）でマウスイベントを確実に捕捉
- Arcline は Web API の制約により、**推論で補うしかない**

**参考**: `/legacy/arc-browser/arc-app-structure.md` に構造の詳細あり

---

### 2. `ウィンドウ境界検知とChrome拡張.md`
**Chrome 拡張（content script）におけるウィンドウ境界検知の制約と対策**

**調査日**: 2025-12-19

**内容**:
- クライアント領域と非クライアント領域の違い
- ウィンドウ枠・リサイズ領域でのイベント断絶
- Chrome 拡張の制約（DOM 内のみ、OS API 不可）
- 検知手法の比較（pointermove, screenX, chrome.windows）
- **推論ベースの境界到達判定**（Snap-to-Edge）

**主な発見**:
- ウィンドウ枠（↔ カーソル領域）= 非クライアント領域
- この領域では **pointermove が発火しない or 不安定**
- content script では **OS レベルのイベントが取れない**
- → **pointerleave + 速度 + screenX で推論**するしかない

**キーワード**: 非クライアント領域、クライアント領域、screenX、pointerleave、境界推論

---

### 3. `Floating UI currentX 更新停止問題調査.md`
**「currentX が 300 で止まる」問題の原因分析と対策案**

**調査日**: 2025-12-19

**現象**:
- カーソルを素早く左端へ移動すると、デバッグの `currentX` が 300 付近で停止
- その状態でユーザーは左端へ到達できてしまう（Floating UI が起動しない）

**原因候補**（優先度順）:
1. **requestAnimationFrame のイベント間引き**
   - pointermove が高頻度で来ると、rAF の次フレームまでイベントが捨てられる
   - 8px ホットゾーンを"飛び越える"（物理的には通過しているが、観測点がスキップ）

2. **ブラウザUI領域への侵入**
   - ウィンドウ枠・リサイズ領域に入ると pointermove が途切れる
   - イベントストリームが断絶

3. **focus/visibility の変化**
   - macOS の介入（Mission Control など）でフォーカス喪失
   - イベントが止まる

**対策**:
1. **getCoalescedEvents() 導入**（Phase 1）
   - 間引きされたイベントも含めて全て検証
   - 8px を通過したかを確実に検知

2. **pointerleave 推論**（Phase 2）
   - 最後の座標・速度・方向から境界到達を推定

3. **screenX 座標判定**（Phase 3）
   - ウィンドウ左端への物理的な近さを計測

**キーワード**: 間引き、getCoalescedEvents, pointerleave, トンネル効果、スロットリング

---

## 調査の流れ（タイムライン）

### 1. 問題発見
- 高速移動時に Floating UI が起動しない
- デバッグで `currentX` が途中で止まることを観測

### 2. 仮説立案
- ホットゾーン幅が狭すぎる？（8px → 16px に拡大）
- → **効果なし**（300 で止まる問題は解消せず）

### 3. 原因の切り分け
- ウィンドウ枠（↔ カーソル）に入ると座標更新が止まることを確認
- **ブラウザ UI 領域 = 非クライアント領域** の制約を発見
- → Chrome 拡張では **OS API が使えない**（DOM 内のみ）

### 4. Arc ブラウザの調査
- Arc.app のバイナリを解析
- Swift 製のネイティブアプリであることを確認
- 専用ウィンドウ（SidebarDragRegionWindow）で画面端全体をカバー
- NSTrackingArea で OS レベルのイベント取得

### 5. 対策の立案
- Arc の手法を **直接真似することは不可能**
- **設計思想を応用**:
  - 多層トラッキング
  - 状態機械
  - 推論による補完

---

## 推奨実装順序（まとめ）

### Phase 1: 計測強化（最優先）
- デバッグビューに以下を追加:
  - `screenX`, `screenY`
  - `window.screenX`, `window.screenY`
  - `distanceFromWindowEdge` (screenX - window.screenX)
  - `velocityX` (移動速度)
  - `state` (EdgeDetectionState)
  - `lastEventType` ('pointermove' | 'pointerleave')
  - `hasFocus`, `visibilityState`

### Phase 2: getCoalescedEvents() 実装
```typescript
const coalescedEvents = e.getCoalescedEvents?.() || [e];
for (const event of coalescedEvents) {
  if (event.clientX <= HOTZONE_WIDTH_PX) {
    triggerFloatingUI();
    break;
  }
}
```

**期待効果**: 間引きによる"飛び越え"を解消

### Phase 3: pointerleave 推論
```typescript
function handlePointerLeave(e: PointerEvent) {
  if (e.relatedTarget === null) {
    const isMovingLeft = lastVelocityX < -5;
    const isNearEdge = clientX <= PROXIMITY_THRESHOLD;
    const isNearWindowEdge = (e.screenX - window.screenX) < 20;

    if (isMovingLeft && isNearEdge && isNearWindowEdge) {
      triggerFloatingUI({ source: 'edge-snap-inference' });
    }
  }
}
```

**期待効果**: ウィンドウ枠でイベントが途切れても起動可能

### Phase 4: 状態機械の導入
```typescript
enum EdgeDetectionState {
  IDLE = 'idle',
  PROXIMITY = 'proximity',
  BORDER = 'border',
  TRIGGERED = 'triggered'
}
```

**期待効果**: 状態遷移の可視化、デバッグ容易性向上

---

## リスク / リターン 評価

| Phase | リターン | リスク | コスト | 優先度 |
|-------|---------|--------|--------|--------|
| **計測強化** | ★★★★★ | ★☆☆☆☆ | ★☆☆☆☆ | **最優先** |
| **Phase 1** (coalesced) | ★★★★★ 間引き解決 | ★☆☆☆☆ ほぼなし | ★☆☆☆☆ 低 | **必須** |
| **Phase 2** (pointerleave) | ★★★★☆ 境界到達補完 | ★★★☆☆ 誤爆可能性 | ★★★☆☆ 中 | **推奨** |
| **Phase 3** (状態機械) | ★★★☆☆ 精度向上 | ★★☆☆☆ 複雑化 | ★★☆☆☆ 中 | 推奨 |
| Phase 4 (windows API) | ★★☆☆☆ 環境差吸収 | ★★★★☆ 設計変更 | ★★★★☆ 高 | 保留 |

---

## OpenSpec Change Proposal（推奨）

```yaml
change-id: update-floating-edge-detection-multi-layer
why: |
  高速移動/非クライアント領域で Floating UI 起動が欠落する問題に対し、
  Arc ブラウザの多層検知戦略を参考に、複数の検知手法を組み合わせる。

what:
  - extension/src/content-scripts/floating-ui.ts
    - getCoalescedEvents() 実装
    - EdgeDetectionState 状態機械導入
    - pointerleave ハンドラ追加
    - screenX 判定追加

  - extension/src/content-scripts/edge-detection-debug.ts
    - screenX/velocityX/state 表示追加

impact:
  - 起動成功率向上（特に高速移動）
  - 誤爆リスク微増（Phase 2 のしきい値次第）
  - デバッグ複雑化

risks:
  - Phase 2 の推論条件が環境依存（DPI/OS/ブラウザ）
  - screenX の座標系が負になるケース（複数ディスプレイ）
```

---

## 関連ドキュメント

- `/legacy/arc-browser/README.md` - Arc ブラウザのリファレンス実装
- `/legacy/arc-browser/arc-app-structure.md` - Arc の構造詳細
- `/docs/guides/floating-ui.md` - Floating UI の実装ガイド

---

## 用語集

- **クライアント領域**: ブラウザのコンテンツエリア（DOM が存在する領域）
- **非クライアント領域**: ウィンドウ枠、タイトルバー、リサイズ領域など（DOM の外）
- **NSTrackingArea**: macOS の API。マウスイベントを OS レベルで取得
- **getCoalescedEvents()**: Pointer Event API。間引きされたイベントも取得
- **pointerleave**: カーソルが要素から離れた時のイベント
- **relatedTarget**: pointerleave の移動先要素（null なら DOM 外へ）
- **screenX**: スクリーン座標系の X 座標（物理ディスプレイ基準）
- **clientX**: クライアント座標系の X 座標（ビューポート基準）
- **window.screenX**: ブラウザウィンドウの左端のスクリーン座標

---

**最終更新**: 2025-12-19
