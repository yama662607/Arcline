# Arc Browser Edge Detection Analysis & Arcline Implementation Plan

## Executive Summary

Arc ブラウザのソースコード調査により、**Arc はネイティブ macOS アプリ（Swift製）**であることが判明。Arc の手法を**直接真似することは不可能**（技術スタックが異なる）だが、設計思想と多層検知戦略は Arcline（Chrome拡張）に応用可能。

---

## Arc Browser の実装アーキテクチャ（調査結果）

### 1. 技術スタック
- **言語**: Swift（1,806+ ファイル）、一部 Objective-C
- **UI Framework**: AppKit（macOS ネイティブ）
- **JavaScript**: ほぼなし（インテグレーションスクリプトのみ12ファイル）
- **結論**: Electron ではなく、完全ネイティブ macOS アプリ

### 2. エッジ検知の核心メカニズム

#### 2.1 専用エッジ検知ウィンドウ
**ファイル**: `Arc/SidebarDragRegionWindow.swift`

```
┌─────────────────────────────────────┐
│  Mac Screen                         │
│  ┌──┬───────────────────────┐      │  ← leadingDragRegionWindow
│  │  │                       │      │     (画面左端の透明ウィンドウ)
│  │  │  Arc Browser Window   │      │
│  │  │                       │      │
│  └──┴───────────────────────┘      │
└─────────────────────────────────────┘
```

**重要**: `SidebarDragRegionWindow` は
- **ブラウザウィンドウとは別の独立した NSWindow**
- **画面端全体**をカバーできる（ブラウザの外側も含む）
- ウィンドウ境界やブラウザ UI の制約を**受けない**

#### 2.2 NSTrackingArea による確実なイベント捕捉
**ファイル**: `ARCUI/NSWindow+TrackingAreas.swift`

- macOS の `NSTrackingArea` API で `mouseEntered:` / `mouseExited:` を捕捉
- DOM / Web API の制約を受けない（OS レベルのイベント）
- ウィンドウ枠やリサイズ領域でも確実に発火

#### 2.3 多層トラッキングシステム
Arc は**複数のトラッカーを組み合わせ**て検知精度を上げている:

| トラッカー | 役割 |
|-----------|------|
| `WindowHoverTracker` | ウィンドウ全体のホバー状態監視 |
| `SidebarPreviewHoverTracker` | サイドバー専用ホバー検知 |
| `HoverRegionTracker` | 汎用ホバー領域検知 |
| `MouseListener` | マウスイベント全般のリスナー |
| `TablistEdgeDragController` | エッジドラッグ制御 |

#### 2.4 状態管理
**ファイル**: `Arc/WindowState+Sidebar.swift`, `SidebarFeature/SidebarState+*.swift`

```swift
// 推定される状態設計
enum SidebarMode {
  case collapsed
  case expanded
  case floating  // ← ホバー時の浮遊表示
}

struct SidebarHoverState {
  var isActive: Bool
  var region: HoverRegion
  var timestamp: Date
}
```

- `sidebarHoverRegionActive` - ホバー検知フラグ
- `onSidebarHoverRegionActivated` - コールバック
- `toggleSidebar`, `showSidebar`, `hideSidebar` - 制御メソッド

---

## Arc と Arcline の根本的な違い

| 観点 | Arc（ネイティブアプリ） | Arcline（Chrome拡張） |
|------|------------------------|----------------------|
| **検知領域** | 画面端全体に専用ウィンドウを配置可能 | **ページのDOM内**のみ（クライアント領域） |
| **イベント取得** | OS レベル（NSTrackingArea） | Web API（pointermove/mouseenter） |
| **ウィンドウ境界** | 境界の外側も検知可能 | **境界外ではイベントが途切れる** |
| **実装自由度** | フル macOS API | **ブラウザサンドボックス制約** |

### 決定的な制約
Arcline は **content script = ページ内 JavaScript** なので、
- ブラウザウィンドウの枠（非クライアント領域）
- リサイズ領域（↔ カーソル）
- macOS のウィンドウマネージャ領域

これらの外側/上では **pointermove / mouseenter が発火しない or 不安定**。

---

## Arc から学べる設計原則（Arcline への応用）

### 1. 専用検知領域の配置
Arc: `SidebarDragRegionWindow` という専用ウィンドウ
**Arcline**: `hostElement`（Shadow DOM の左端固定要素）を専用検知領域にする

→ ✅ **既に実装済み**（`floating-ui.ts` の `ensureHost()`）

### 2. 多層トラッキング戦略
Arc: 5つのトラッカーを組み合わせ
**Arcline**: 複数の検知手法を組み合わせる

| Arc の手法 | Arcline での代替 | 状態 |
|-----------|-----------------|------|
| NSTrackingArea (mouseEntered) | `hostElement` の `pointerenter` | ✅ 実装済み |
| mouseMove 連続監視 | `pointermove` + `pointerrawupdate` | ✅ 実装済み |
| *(OS level tracking)* | **`getCoalescedEvents()`** で間引き補正 | ❌ 未実装 |
| *(OS level tracking)* | **`pointerleave` 推論**（境界到達推定） | ❌ 未実装 |
| *(OS level tracking)* | **`screenX` 座標による境界近接判定** | ❌ 未実装 |

### 3. 状態機械による制御
Arc: `SidebarMode` / `SidebarHoverState`
**Arcline**: 状態機械の導入が必要

```typescript
// 提案する状態設計
enum EdgeDetectionState {
  IDLE,           // 通常状態
  PROXIMITY,      // エッジに近づいている（x < 100px など）
  HOVERING,       // ホットゾーン内（x <= 8px）
  TRIGGERED,      // 起動済み
  COOLDOWN        // 連続起動防止
}
```

### 4. デバウンス / クールダウン
Arc: `DEBOUNCE_MS = 100` 的なロジック（推定）
**Arcline**: ✅ 既に `DEBOUNCE_MS = 100` 実装済み

---

## 現在の問題の本質（調査結果との照合）

### 問題A: "currentX が 300 で止まる"
**原因候補** (優先度順):
1. **requestAnimationFrame のイベント間引き** → `getCoalescedEvents()` で解決可能
2. **ブラウザUI領域への侵入** → `pointerleave` 推論で対処
3. **focus/visibility の変化** → 計測で確認必要

### 問題B: "リサイズ領域（↔ カーソル）でイベントが止まる"
**原因**: ウィンドウ枠 = 非クライアント領域（DOM の外）
**Arc の解決法**: 専用ウィンドウで OS レベル捕捉
**Arcline の解決法**: ❌ 直接は不可能 → **推論で補う**しかない

---

## 推奨実装プラン（優先度順）

### Phase 1: 間引き補正（最小リスク・最大効果）
**目的**: 高速移動で 8px ホットゾーンを"飛び越える"問題を解決

#### 実装
```typescript
function handlePointerMove(e: PointerEvent) {
  // 既存の処理
  updateCurrentPosition(e.clientX, e.clientY);

  // 新規: Coalesced Events で"飛び越え"検知
  const coalescedEvents = e.getCoalescedEvents?.() || [e];
  for (const event of coalescedEvents) {
    if (event.clientX <= HOTZONE_WIDTH_PX) {
      // ホットゾーン通過を検知 → 起動
      triggerFloatingUI();
      break;
    }
  }
}
```

**期待効果**:
- ✅ "300で止まる"が間引き由来なら解決
- ✅ 高速フリックでも 8px 検知率向上
- ✅ リスク: 低（処理コスト小、誤爆なし）
- ✅ コスト: 低（既存ロジックへの追加のみ）

**Critical Files**:
- `extension/src/content-scripts/floating-ui.ts` (pointerMoveHandler)

---

### Phase 2: 境界到達推論（非クライアント領域対策）
**目的**: ウィンドウ枠/リサイズ領域に入ってイベントが途切れるケースを補う

#### 実装
```typescript
enum EdgeDetectionState {
  IDLE = 'idle',
  PROXIMITY = 'proximity',  // x < 100 など
  BORDER = 'border',        // x <= 8
  TRIGGERED = 'triggered'
}

let state: EdgeDetectionState = EdgeDetectionState.IDLE;
let lastVelocityX: number = 0; // dx/dt

function handlePointerMove(e: PointerEvent) {
  const { clientX, screenX } = e;
  const velocityX = clientX - lastClientX; // 負なら左向き
  lastVelocityX = velocityX;

  // 状態遷移
  if (clientX <= HOTZONE_WIDTH_PX) {
    state = EdgeDetectionState.BORDER;
  } else if (clientX < PROXIMITY_THRESHOLD) {
    state = EdgeDetectionState.PROXIMITY;
  } else {
    state = EdgeDetectionState.IDLE;
  }
}

function handlePointerLeave(e: PointerEvent) {
  // relatedTarget === null → DOM外へ出た（ウィンドウ枠 or 画面外）
  if (e.relatedTarget === null) {
    // 推論条件
    const isMovingLeft = lastVelocityX < -5; // 左向き高速移動
    const isNearEdge = state === EdgeDetectionState.PROXIMITY ||
                       state === EdgeDetectionState.BORDER;
    const isNearWindowEdge = (e.screenX - window.screenX) < SNAP_THRESHOLD;

    if (isMovingLeft && isNearEdge && isNearWindowEdge) {
      // "ウィンドウ左端に吸われた"と推定 → 起動
      triggerFloatingUI({ source: 'edge-snap-inference' });
    }
  }
}
```

**期待効果**:
- ✅ リサイズ領域でイベント途切れても起動可能
- ⚠️ リスク: 中（誤爆の可能性、しきい値調整必要）
- ⚠️ コスト: 中（状態管理追加、デバッグ複雑化）

**Critical Files**:
- `extension/src/content-scripts/floating-ui.ts` (setupEdgeDetection)
- `extension/src/content-scripts/edge-detection-debug.ts` (状態表示追加)

---

### Phase 3: screenX 座標による境界近接判定（精度向上）
**目的**: ウィンドウ左端への近さを物理座標で判定

#### 実装
```typescript
function isNearWindowLeftEdge(screenX: number): boolean {
  const windowLeft = window.screenX;
  const distanceFromWindowEdge = screenX - windowLeft;

  // ウィンドウ左端から 20px 以内
  return distanceFromWindowEdge < 20;
}

function handlePointerMove(e: PointerEvent) {
  updateDebugInfo({
    clientX: e.clientX,
    screenX: e.screenX,
    windowScreenX: window.screenX,
    distanceFromEdge: e.screenX - window.screenX
  });

  // Phase 2 の推論精度を上げる
  if (isNearWindowLeftEdge(e.screenX)) {
    state = EdgeDetectionState.PROXIMITY;
  }
}
```

**期待効果**:
- ✅ DPI/ズーム/最大化状態でのブレに強い
- ✅ Phase 2 の誤爆を減らせる
- ⚠️ リスク: 低〜中（座標系の複雑さ）
- ⚠️ コスト: 低（既存に追加）

**Critical Files**:
- `extension/src/content-scripts/floating-ui.ts`
- `extension/src/content-scripts/edge-detection-debug.ts`

---

### Phase 4（オプション）: chrome.windows API 連携
**目的**: background script でウィンドウ座標を補助

**実装**:
```typescript
// background script
chrome.windows.getCurrent({ populate: false }, (win) => {
  // win.left, win.top, win.width を content script へ送信
});
```

**期待効果**:
- ✅ 負座標・複数ディスプレイ対応
- ⚠️ リスク: 高（メッセージング増、複雑化）
- ⚠️ コスト: 高（設計変更）

**位置づけ**: Phase 1〜3 で不十分な場合のみ

---

## 追加計測（判断のため必須）

現在のデバッグビューに**以下を追加**:

```typescript
interface EnhancedDebugInfo {
  // 既存
  clientX: number;
  clientY: number;
  targetTag: string | null;
  targetId: string | null;
  targetClass: string | null;

  // 新規追加
  screenX: number;
  screenY: number;
  windowScreenX: number;     // window.screenX
  windowScreenY: number;     // window.screenY
  distanceFromWindowEdge: number; // screenX - window.screenX
  velocityX: number;         // 移動速度 (px/frame)
  state: EdgeDetectionState; // 状態機械
  lastEventType: string;     // 'pointermove' | 'pointerleave' | etc.
  lastEventTimestamp: number; // performance.now()
  timeSinceLastEvent: number; // ms
  hasFocus: boolean;         // document.hasFocus()
  visibilityState: string;   // document.visibilityState
}
```

**Critical Files**:
- `extension/src/content-scripts/edge-detection-debug.ts`
- `extension/src/content-scripts/floating-ui.ts`

---

## OpenSpec Change Proposal（推奨）

この変更は**起動条件の仕様変更**なので、OpenSpec で管理すべき:

```yaml
change-id: update-floating-edge-detection-multi-layer
why: |
  高速移動/非クライアント領域で Floating UI 起動が欠落する問題に対し、
  Arc ブラウザの多層検知戦略を参考に、複数の検知手法を組み合わせる。

  - Phase 1: getCoalescedEvents() で間引き補正
  - Phase 2: pointerleave 推論で境界到達補完
  - Phase 3: screenX 座標による境界近接判定

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

## リスク/リターン比較

| Phase | リターン | リスク | コスト | 優先度 |
|-------|---------|--------|--------|--------|
| **Phase 1** (coalesced) | ★★★★★ 間引き解決 | ★☆☆☆☆ ほぼなし | ★☆☆☆☆ 低 | **最優先** |
| **Phase 2** (pointerleave) | ★★★★☆ 境界到達補完 | ★★★☆☆ 誤爆可能性 | ★★★☆☆ 中 | **推奨** |
| **Phase 3** (screenX) | ★★★☆☆ 精度向上 | ★★☆☆☆ 座標系複雑 | ★☆☆☆☆ 低 | 推奨 |
| Phase 4 (windows API) | ★★☆☆☆ 環境差吸収 | ★★★★☆ 設計変更 | ★★★★☆ 高 | 保留 |

---

## 次のステップ（ユーザー確認待ち）

### 確認事項
1. **期待する"左端"の定義**:
   - A) Webコンテンツの左端（clientX=0）
   - B) ブラウザウィンドウの左端（枠含む）
   - C) 物理ディスプレイの左端（画面端）

   → **B or C の場合、Phase 2 必須**

2. **現象の再現環境**:
   - ブラウザ: Chrome / Arc / Brave / Edge
   - サイドパネル: 開いている / 閉じている
   - DevTools: 開いている / 閉じている

   → 計測で確認

3. **pointerleave の発生有無**:
   - "300で止まる瞬間"にデバッグログで `pointerleave` が見えるか

   → **これが Phase 2 の必要性を決める**

### 実装順序（推奨）
1. **計測強化** → デバッグビューに screenX/velocity/state 追加
2. **Phase 1 実装** → getCoalescedEvents()
3. **動作確認** → "300で止まる"が消えるか
4. （消えない場合）**Phase 2 実装** → pointerleave 推論
5. **Phase 3 実装** → screenX 判定（Phase 2 の精度向上）

---

## 結論

**Arc の手法を直接真似することは不可能**（ネイティブアプリ vs Web拡張）だが、
**Arc の設計思想（多層検知・状態管理・専用領域）は応用可能**。

現実的な解決策:
- ✅ **Phase 1（coalesced events）** は必須（ほぼノーリスク）
- ✅ **Phase 2（pointerleave 推論）** は "枠に入ると止まる"対策として有効
- ⚠️ **Phase 3（screenX）** は Phase 2 の精度向上（追加推奨）
- ❌ **Phase 4（windows API）** は最後の手段（保留）

まず **計測強化 → Phase 1 → 動作確認** の順で進め、
Phase 2 の必要性は **pointerleave ログ** で判断する。
