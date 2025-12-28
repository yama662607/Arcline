# Edge Detection Debug ウィンドウ 完全ガイド

## 概要

Edge Detection Debug ウィンドウは、Floating UI のエッジ検知機能を可視化・デバッグするための開発者ツールです。Phase 1-3 の実装効果をリアルタイムで確認できます。

**対象**: 開発モード（`pnpm dev`）のみで利用可能

---

## 起動方法

### 1. 開発モードで起動

```bash
cd /Users/daisukeyamashiki/Code/Projects/Arcline/extension
pnpm dev
```

### 2. Chrome で拡張を読み込み

1. Chrome を開く
2. `chrome://extensions/` にアクセス
3. 「デベロッパーモード」を ON
4. 「パッケージ化されていない拡張機能を読み込む」→ `extension/dist` を選択
   - または既存の拡張をリロード（🔄ボタン）

### 3. デバッグウィンドウを表示

1. 任意の Web ページを開く（例: `https://example.com`）
2. キーボードショートカット: **`Ctrl+Shift+D`** （Mac: `Cmd+Shift+D`）
3. 画面右上に緑色のデバッグウィンドウが表示される

---

## レイアウト構成

デバッグウィンドウは **3カラム構成** で、スクロールなしで全情報が見えます：

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Edge Detection Debug (Phase 1-3)    [ショートカット一覧]     │
├──────────────┬──────────────────┬──────────────────────────────┤
│ 📍 Position   │ ✓ Conditions     │ ⚙️ Settings                  │
│   & State     │                  │                              │
│               │ ✅/❌ チェック項目 │ □ Phase 2                    │
│  clientX: 5.2 │                  │ □ Console Log                │
│  clientY: 100 │                  │ VelX: -6                     │
│  screenX: ... │                  │ Edge: 24                     │
│  ...          │                  │                              │
│               │ 🚀 TRIGGER       │ 📊 Stats & History           │
│               │                  │ Events: 152                  │
│               │                  │ Triggers: 3                  │
│               │                  │ Recent (5):                  │
│               │                  │ 🚀 x=5 (120ms)              │
└──────────────┴──────────────────┴──────────────────────────────┘
│ 💡 使い方: [ヘルプテキスト]                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 各セクションの詳細説明

### 1. 📍 Position & State（左カラム）

マウスカーソルの現在位置と状態を表示します。

| 項目 | 説明 | 正常値の例 | 異常値の例 |
|------|------|-----------|-----------|
| **clientX** | ビューポート座標 X（左端 = 0） | `5.2` (緑) | `300.0` (緑) |
| **clientY** | ビューポート座標 Y（上端 = 0） | `250.0` (緑) | `500.0` (緑) |
| **screenX** | スクリーン座標 X（物理ディスプレイ基準） | `125.2` (緑) | `1920.0` (緑) |
| **winScreenX** | ウィンドウ左端のスクリーン座標 | `120.0` (緑) | `100.0` (緑) |
| **distFromEdge** | ウィンドウ左端からの距離（px） | `5.2` (**黄**) | `50.0` (緑) |
| **velocityX** | X方向の速度（px/frame、負=左向き） | `-8.0` (**黄**) | `2.0` (緑) |
| **velocityY** | Y方向の速度（px/frame） | `1.0` (緑) | `10.0` (緑) |
| **state** | エッジ検知の状態 | `BORDER` (緑) | `IDLE` (緑) |
| **event** | 最後に発火したイベント | `pointermove` (緑) | `pointerleave` (緑) |
| **coalesced** | 統合されたイベント数（Phase 1 の効果） | `3` (**黄**) | `1` (緑) |

#### 色の意味

- **緑色（#00ff00）**: 通常の値
- **黄色（#ffff00）**: 重要な値（条件を満たしている）
  - `clientX ≤ 8`: ホットゾーン内
  - `distFromEdge ≤ 24`: ウィンドウ端に近い
  - `velocityX ≤ -6`: 左向き高速移動
  - `coalesced > 1`: Phase 1 が動作中

#### State の種類

| State | 意味 | 条件 |
|-------|------|------|
| `IDLE` | 通常状態 | `clientX > 96` |
| `PROXIMITY` | エッジに近づいている | `8 < clientX ≤ 96` |
| `BORDER` | ホットゾーン内 | `clientX ≤ 8` |

---

### 2. ✓ Conditions（中央カラム）

Floating UI 起動条件のチェックリストです。

| 条件 | 説明 | ✅ の意味 |
|------|------|---------|
| **In Hotzone (≤8px)** | ホットゾーン内にいる | `clientX ≤ 8` |
| **Moving Left** | 左向きに移動中 | `velocityX < 0` |
| **Started Outside** | ホットゾーン外から開始 | 前フレームの `clientX > 8` |
| **Pointer Leave** | pointerleave イベント発生 | `lastEventType === 'pointerleave'` |
| **Fast Left Vel** | 左向き高速移動（Phase 2） | `velocityX ≤ -6` |
| **Slow Y Vel** | Y方向低速移動（Phase 2） | `|velocityY| ≤ 8` |
| **Near Win Edge** | ウィンドウ端に近い（Phase 3） | `distFromEdge ≤ 24` |
| **Multi-Coalesced** | 複数イベント統合（Phase 1） | `coalesced > 1` |

#### トリガー判定

条件の下に表示される大きなボックス:

- **🚀 TRIGGER**（緑背景）: Floating UI を起動すべき状態
  - 通常: `In Hotzone` ✅
  - Phase 1: `Multi-Coalesced` ✅ かつ中間イベントがホットゾーン通過
  - Phase 2: `Pointer Leave` + `Fast Left Vel` + `Slow Y Vel` + `Near Win Edge` すべて ✅

- **⏸️ NO TRIGGER**（灰背景）: 起動条件を満たしていない

---

### 3. ⚙️ Settings（右カラム上部）

エッジ検知の動作設定をリアルタイムで調整できます。

#### チェックボックス

| 設定 | 説明 | デフォルト |
|------|------|-----------|
| **Phase 2** | pointerleave 推論を有効化 | ✅ ON |
| **Console Log** | Chrome DevTools Console に詳細ログを出力 | ❌ OFF |

#### スライダー

| 設定 | 説明 | 範囲 | デフォルト |
|------|------|------|-----------|
| **VelX** | Snap velocity threshold<br/>左向き速度の閾値（これ以下で「高速左移動」判定） | -20 〜 0 px | **-6 px** |
| **Edge** | Window edge threshold<br/>ウィンドウ端判定の閾値（この距離以内で「端に近い」判定） | 0 〜 100 px | **24 px** |

#### 調整のコツ

- **Phase 2 が誤爆する場合**:
  - `VelX` をより負の値に（例: -10）→ より速い動きのみ反応
  - `Edge` を小さく（例: 12）→ より端に近い時のみ反応

- **Phase 2 が反応しない場合**:
  - `VelX` をゼロに近く（例: -4）→ ゆっくりでも反応
  - `Edge` を大きく（例: 40）→ 広い範囲で反応

---

### 4. 📊 Stats & History（右カラム下部）

累積統計と最近のイベント履歴を表示します。

| 項目 | 説明 |
|------|------|
| **Events** | 累計イベント数（pointermove / pointerrawupdate の合計） |
| **Triggers** | 累計トリガー数（Floating UI を起動した回数、黄色は1回以上） |
| **Recent (5)** | 最近5件のイベント履歴 |

#### Recent の見方

```
🚀 x=5 (120ms)      ← トリガー発生（緑色）、120ms前、clientX=5
   x=50 (250ms)     ← トリガーなし（灰色）、250ms前、clientX=50
🚀 x=7 (500ms)      ← トリガー発生
   x=100 (800ms)
   x=200 (1200ms)
```

---

### 5. 💡 使い方（下部ヘルプ）

青い背景のボックスに簡易ガイドが表示されます:

> **💡 使い方:**
> カーソルを画面左端に移動してエッジ検知をテスト。
> **clientX ≤ 8px** でホットゾーン。
> **coalesced > 1** なら Phase 1 が動作中（高速移動対応）。
> **Pointer Leave + 条件** なら Phase 2 が動作中（ウィンドウ枠対応）。

---

## キーボードショートカット

| ショートカット | 機能 |
|--------------|------|
| **Ctrl+Shift+D** | デバッグウィンドウの表示/非表示切り替え |
| **Ctrl+Shift+R** | 統計情報のリセット（Events / Triggers / History をクリア） |
| **Ctrl+Shift+C** | デバッグ情報をコピー & Console にログ出力 |

---

## テストシナリオ

### シナリオ A: 通常のエッジ検知

**目的**: 基本的なホットゾーン検知を確認

1. カーソルをゆっくり左端に移動
2. **確認ポイント**:
   - `clientX` が徐々に減少
   - `clientX ≤ 8` で黄色ハイライト
   - `In Hotzone (≤8px)` が ✅
   - `🚀 TRIGGER` が表示される
3. **期待結果**: Floating UI が表示される

---

### シナリオ B: Phase 1 の効果確認（高速移動対応）

**目的**: `getCoalescedEvents()` による間引き補正を確認

1. カーソルを画面右側（x > 300）に配置
2. **素早く**左端に向かってスワイプ（1秒以内に画面端まで）
3. **確認ポイント**:
   - `coalesced` の値が **2以上** に増加（黄色ハイライト）
   - `Multi-Coalesced` が ✅
   - `🚀 TRIGGER` が表示される
   - Chrome Console（F12）で `[Arcline][EdgeDetection] coalesced-hotzone-detected` のログ（Console Log をONにした場合）
4. **期待結果**: 高速移動でも Floating UI が確実に起動

#### Phase 1 実装前との比較

| | Phase 1 実装前 | Phase 1 実装後 |
|---|---|---|
| `coalesced` | 常に `1` | 高速時 `2〜10` |
| 高速移動での検知 | 失敗することがある | **確実に検知** ✅ |

---

### シナリオ C: Phase 2 の効果確認（ウィンドウ枠対応）

**目的**: `pointerleave` 推論による境界到達検知を確認

1. ブラウザウィンドウを通常サイズにする（最大化しない）
2. カーソルをウィンドウ左端のリサイズ領域（↔ カーソル）に向かって素早く移動
3. **確認ポイント**:
   - `event` が `pointerleave` に変化
   - `Pointer Leave` が ✅
   - `Fast Left Vel` が ✅（`velocityX` が黄色）
   - `Slow Y Vel` が ✅
   - `Near Win Edge` が ✅（`distFromEdge` が黄色）
   - `🚀 TRIGGER` が表示される
4. **期待結果**: リサイズ領域でもFloating UI が起動

#### Phase 2 の推論条件（すべて満たす必要がある）

- ✅ `relatedTarget === null`（DOM外への移動）
- ✅ `velocityX ≤ -6`（左向き高速移動）
- ✅ `|velocityY| ≤ 8`（Y方向は低速）
- ✅ `clientX ≤ 96`（ビューポート左端に近い）
- ✅ `distFromEdge ≤ 24`（ウィンドウ左端に近い）
- ✅ クールダウン経過（400ms）

---

### シナリオ D: Phase 3 の効果確認（物理座標判定）

**目的**: `screenX` 座標による正確な距離計測を確認

1. 複数ディスプレイ環境の場合、セカンドディスプレイにウィンドウを配置
2. カーソルを左端に移動
3. **確認ポイント**:
   - `screenX` と `winScreenX` の差が正確に計算されている
   - `distFromEdge` が物理的な距離を反映
   - `Near Win Edge` が ✅（24px以内の場合）
4. **期待結果**: ディスプレイ位置に関わらず正確に検知

---

## トラブルシューティング

### デバッグウィンドウが表示されない

**原因**: 開発モードで起動していない、または初回読み込み失敗

**対処法**:
1. `pnpm dev` で起動していることを確認
2. `Ctrl+Shift+D` を再度押す
3. ページをリロード（F5）
4. Chrome DevTools Console（F12）でエラーを確認

---

### Floating UI が起動しない

**原因**: エッジ検知条件を満たしていない

**対処法**:
1. デバッグウィンドウで `clientX` が更新されているか確認
2. `✓ Conditions` のチェック項目を確認
   - `In Hotzone (≤8px)` が ❌ → カーソルを左端（x=0）まで移動
3. Chrome DevTools Console で JavaScript エラーを確認
4. Phase 2 が有効な場合、一時的にOFFにして基本動作を確認

---

### Phase 2 が誤爆する（意図しない起動）

**原因**: しきい値が緩すぎる

**対処法**:
1. **Settings** で以下を調整:
   - `VelX` を小さく（例: -10 → より速い動きのみ反応）
   - `Edge` を小さく（例: 12 → より端に近い時のみ反応）
2. 一時的に `Phase 2` をOFFにする
3. `Ctrl+Shift+R` で統計をリセットして再テスト

---

### `coalesced` が常に 1 のまま

**原因**: Phase 1 が動作していない、またはイベント間引きが発生していない

**対処法**:
1. **より高速**にカーソルを移動（1秒以内に画面端まで）
2. `pointerrawupdate` も Phase 1 の対象なので、複数のイベントソースを確認
3. Chrome DevTools Console で `getCoalescedEvents` がサポートされているか確認:
   ```javascript
   // Console で実行
   document.addEventListener('pointermove', (e) => {
     console.log('Coalesced:', e.getCoalescedEvents?.());
   });
   ```

---

## データの解釈ガイド

### 良好な検知パターン

```
📍 Position & State:
  clientX: 5.2 ← 黄色（ホットゾーン内）
  velocityX: -8.0 ← 黄色（左向き高速）
  coalesced: 3 ← 黄色（Phase 1 動作中）

✓ Conditions:
  ✅ In Hotzone
  ✅ Moving Left
  ✅ Multi-Coalesced

🚀 TRIGGER ← 緑背景
```

**解釈**: Phase 1 が正常に動作し、高速移動でも検知成功

---

### Phase 2 が動作しているパターン

```
📍 Position & State:
  clientX: 15.0
  distFromEdge: 18.0 ← 黄色（ウィンドウ端に近い）
  velocityX: -7.0 ← 黄色（左向き高速）
  event: pointerleave

✓ Conditions:
  ✅ Pointer Leave
  ✅ Fast Left Vel
  ✅ Slow Y Vel
  ✅ Near Win Edge

🚀 TRIGGER ← 緑背景
```

**解釈**: ウィンドウ枠でイベントが途切れたが、Phase 2 の推論で検知成功

---

### 検知失敗のパターン

```
📍 Position & State:
  clientX: 300.0
  velocityX: 2.0 ← 右向き移動

✓ Conditions:
  ❌ In Hotzone
  ❌ Moving Left

⏸️ NO TRIGGER ← 灰背景
```

**解釈**: ホットゾーンに到達していない、または右向きに移動中

---

## パフォーマンス指標

デバッグウィンドウの `Stats` で確認すべき指標:

| 指標 | 良好な値 | 要改善 |
|------|---------|--------|
| **Events / 10秒** | 100〜500 | > 1000（イベント過多） |
| **Triggers / Events** | 5〜20% | > 50%（誤爆） |
| **coalesced（平均）** | 1.5〜3.0 | 常に 1（Phase 1 未動作） |

---

## ログのエクスポート

`Ctrl+Shift+C` でログをエクスポートすると、以下の形式で Chrome Console に出力されます:

```
=== Arcline Edge Detection Debug Report ===
Total Events: 152
Total Triggers: 3
History Size: 50

Event History (last 50):
1. x=5.20 | TRIGGERED | 120ms ago
2. x=50.00 | no trigger | 250ms ago
3. x=7.10 | TRIGGERED | 500ms ago
...

Generated at: 2025-12-28T10:30:45.123Z
```

このログを GitHub Issue や調査ドキュメントに貼り付けることで、問題の再現や分析が容易になります。

---

## まとめ

デバッグウィンドウを活用することで、以下が可能になります:

1. ✅ **Phase 1-3 の効果を可視化**
   - `coalesced > 1` → Phase 1 動作確認
   - `Pointer Leave + 条件` → Phase 2 動作確認
   - `distFromEdge` の正確性 → Phase 3 動作確認

2. ✅ **リアルタイムでの設定調整**
   - スライダーで `VelX` / `Edge` を調整
   - 誤爆を減らし、検知精度を最適化

3. ✅ **問題の迅速な診断**
   - `✓ Conditions` で起動条件の不足を特定
   - `Stats` で異常なイベント頻度を検知

4. ✅ **データ駆動の改善**
   - ログをエクスポートして分析
   - 検知失敗率を計測

**開発時は常にデバッグウィンドウを表示**して、エッジ検知の挙動を監視することを推奨します。

---

**最終更新**: 2025-12-28
**関連ドキュメント**:
- [arc-browser-edge-detection-analysis.md](../investigation/arc-browser-edge-detection-analysis.md)
- [Floating UI リファレンス](./floating-ui.md)
- [Atlas Floating Mode Handbook](./atlas-floating-mode.md)
