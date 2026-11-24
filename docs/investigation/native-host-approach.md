# Native Host Approach for Edge Detection (Future Implementation)

## Executive Summary

macOS でネイティブアプリケーション（Swift/Objective-C）と Chrome 拡張を連携させ、**ウィンドウ境界外でもマウス座標を取得する**アプローチの技術的実現可能性と実装計画。

**結論**: 技術的には完全に実現可能だが、Web API ベース（Phase 1-3）を先に実装し、その限界を評価してから検討すべき。

**ステータス**: 🔮 **将来的な選択肢**（現時点では未実装）

---

## 背景

### Web API の制約

Chrome 拡張の content script は Web API（DOM Events）に依存するため、以下の制約がある:

| 問題 | 原因 | 影響 |
|------|------|------|
| ウィンドウ境界外で検知不可 | `pointermove` イベントがクライアント領域内でのみ発火 | リサイズ領域でカーソルが途切れる |
| イベントの間引き | `requestAnimationFrame` による最適化 | 高速移動時に 8px ホットゾーンを飛び越える |
| 非クライアント領域 | ブラウザ UI（タブバー、枠など）で `pointerleave` 発生 | エッジ到達を正確に検知できない |

### Arc Browser の手法

Arc は **ネイティブ macOS アプリ**（Swift製）なので、OS レベルの API を使用:

- `SidebarDragRegionWindow`: 専用の透明ウィンドウを画面端に配置
- `NSTrackingArea`: OS レベルのマウスイベント捕捉
- `NSEvent.addGlobalMonitorForEvents`: ウィンドウ外も含むグローバルトラッキング

→ **Chrome 拡張では直接真似できない**

---

## 技術的実現可能性

### ✅ 実現可能

Chrome 拡張と macOS ネイティブアプリを連携させることで、Arc と同等の精度を実現できる。

**キーテクノロジー**:
- **Chrome Native Messaging API**: Chrome 拡張とローカルアプリ間の通信
- **NSEvent / CGEventTap**: macOS のグローバルマウスイベント監視

---

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  macOS システム                                          │
│                                                          │
│  ┌──────────────────┐         ┌──────────────────┐    │
│  │ Swift App        │◄──────►│ Chrome Extension │    │
│  │ (Native Host)    │  JSON  │ (Arcline)        │    │
│  │                  │  stdin/ │                  │    │
│  │ - NSEvent        │  stdout │ - background.js  │    │
│  │ - CGEventTap     │         │ - floating-ui.ts │    │
│  └────────┬─────────┘         └──────────────────┘    │
│           │                                             │
│           ▼                                             │
│  ┌──────────────────────────────────────┐              │
│  │ macOS Event System                   │              │
│  │ - グローバルマウスイベント監視       │              │
│  │ - ウィンドウ境界外も含む             │              │
│  │ - アクセシビリティ権限で制御         │              │
│  └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### データフロー

```
1. ユーザーがマウスを移動
   ↓
2. macOS Event System がイベントを発生
   ↓
3. Swift App が NSEvent.addGlobalMonitorForEvents で捕捉
   ↓
4. マウス座標を JSON 形式に変換
   ↓
5. stdout に Native Messaging Protocol 形式で出力
   ↓
6. Chrome Extension が chrome.runtime.connectNative で受信
   ↓
7. background script → content script にメッセージ転送
   ↓
8. floating-ui.ts でエッジ検知ロジック実行
```

---

## 実装コンポーネント

### 1. Swift ネイティブホスト

**役割**: システム全体のマウスイベントを監視し、座標を Chrome 拡張に送信

**ファイル構成** (想定):
```
ArclineMouseTracker/
├── Sources/
│   ├── main.swift              # エントリポイント
│   ├── MouseTracker.swift      # イベント監視
│   ├── NativeMessaging.swift   # Chrome との通信
│   └── Models.swift            # データモデル
├── Package.swift
└── Info.plist
```

**main.swift**:
```swift
import Cocoa
import Foundation

class MouseTracker {
    private var eventMonitor: Any?

    func start() {
        // グローバルマウスイベント監視（アプリがフォーカスされていなくても動作）
        eventMonitor = NSEvent.addGlobalMonitorForEvents(
            matching: [.mouseMoved, .leftMouseDragged]
        ) { [weak self] event in
            let location = NSEvent.mouseLocation
            self?.sendMousePosition(x: location.x, y: location.y)
        }

        // stdin からのメッセージを待機（Chrome からの制御）
        listenForMessages()

        RunLoop.main.run()
    }

    func sendMousePosition(x: CGFloat, y: CGFloat) {
        let message: [String: Any] = [
            "type": "mousePosition",
            "x": Double(x),
            "y": Double(y),
            "timestamp": Date().timeIntervalSince1970
        ]

        NativeMessaging.send(message)
    }

    func listenForMessages() {
        // Chrome からのメッセージを処理
        // 例: { "command": "start" } → トラッキング開始
        //     { "command": "stop" }  → トラッキング停止
        DispatchQueue.global(qos: .userInitiated).async {
            while let message = NativeMessaging.receive() {
                self.handleMessage(message)
            }
        }
    }

    func handleMessage(_ message: [String: Any]) {
        guard let command = message["command"] as? String else { return }

        switch command {
        case "start":
            // トラッキング開始（既に開始済み）
            break
        case "stop":
            if let monitor = eventMonitor {
                NSEvent.removeMonitor(monitor)
                eventMonitor = nil
            }
        default:
            break
        }
    }
}

// エントリポイント
let tracker = MouseTracker()
tracker.start()
```

**NativeMessaging.swift**:
```swift
import Foundation

enum NativeMessaging {
    /// Chrome Native Messaging Protocol でメッセージを送信
    static func send(_ message: [String: Any]) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: message) else {
            return
        }

        // Native Messaging Protocol:
        // 4バイトのリトルエンディアン長さ + JSON データ
        var length = UInt32(jsonData.count).littleEndian

        let lengthData = Data(bytes: &length, count: 4)
        FileHandle.standardOutput.write(lengthData)
        FileHandle.standardOutput.write(jsonData)
    }

    /// Chrome からのメッセージを受信
    static func receive() -> [String: Any]? {
        let stdin = FileHandle.standardInput

        // 4バイトの長さヘッダーを読み込み
        guard let lengthData = try? stdin.read(upToCount: 4),
              lengthData.count == 4 else {
            return nil
        }

        let length = lengthData.withUnsafeBytes { $0.load(as: UInt32.self).littleEndian }

        // JSON データを読み込み
        guard let jsonData = try? stdin.read(upToCount: Int(length)),
              let message = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] else {
            return nil
        }

        return message
    }
}
```

**代替案: CGEventTap（より低レベル）**

より高精度が必要な場合は `CGEventTap` を使用（アクセシビリティ権限が必須）:

```swift
func setupEventTap() {
    let eventMask = (1 << CGEventType.mouseMoved.rawValue)

    guard let eventTap = CGEvent.tapCreate(
        tap: .cgSessionEventTap,
        place: .headInsertEventTap,
        options: .listenOnly,  // イベントを変更しない（監視のみ）
        eventsOfInterest: CGEventMask(eventMask),
        callback: { (proxy, type, event, refcon) -> Unmanaged<CGEvent>? in
            let location = event.location
            let tracker = Unmanaged<MouseTracker>.fromOpaque(refcon!).takeUnretainedValue()
            tracker.sendMousePosition(x: location.x, y: location.y)
            return Unmanaged.passRetained(event)
        },
        userInfo: UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque())
    ) else {
        fatalError("Failed to create event tap")
    }

    let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
    CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
    CGEvent.tapEnable(tap: eventTap, enable: true)
}
```

---

### 2. Native Host Manifest

**ファイル名**: `com.arcline.mousetracker.json`

**内容**:
```json
{
  "name": "com.arcline.mousetracker",
  "description": "Arcline Mouse Tracker for Edge Detection",
  "path": "/Applications/ArclineMouseTracker.app/Contents/MacOS/ArclineMouseTracker",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://YOUR_EXTENSION_ID_HERE/"
  ]
}
```

**配置場所**:
- ユーザー固有: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.arcline.mousetracker.json`
- 全ユーザー: `/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.arcline.mousetracker.json`

**注意**:
- `path` は絶対パスで指定
- `allowed_origins` は実際の Extension ID に置き換える
- Arc, Brave, Edge などは別のディレクトリパス

---

### 3. Chrome 拡張側の実装

#### manifest.json

```json
{
  "manifest_version": 3,
  "permissions": [
    "nativeMessaging",
    "tabs",
    "storage"
  ],
  "background": {
    "service_worker": "background/index.js",
    "type": "module"
  }
}
```

#### background/native-host-bridge.ts

```typescript
/**
 * Native Host との接続を管理
 */
export class NativeHostBridge {
  private port: chrome.runtime.Port | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.checkAvailability();
  }

  /**
   * Native Host の利用可能性をチェック
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const testPort = chrome.runtime.connectNative('com.arcline.mousetracker');
      testPort.disconnect();
      console.log('Native host available');
      return true;
    } catch (error) {
      console.log('Native host not available:', error);
      return false;
    }
  }

  /**
   * Native Host に接続
   */
  connect() {
    try {
      this.port = chrome.runtime.connectNative('com.arcline.mousetracker');

      this.port.onMessage.addListener((message) => {
        this.handleMessage(message);
      });

      this.port.onDisconnect.addListener(() => {
        console.log('Native host disconnected:', chrome.runtime.lastError);
        this.port = null;

        // 5秒後に再接続を試行
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, 5000);
      });

      // トラッキング開始を指示
      this.send({ command: 'start' });
      this.isEnabled = true;

      console.log('Connected to native host');
    } catch (error) {
      console.error('Failed to connect to native host:', error);
    }
  }

  /**
   * Native Host からのメッセージを処理
   */
  private handleMessage(message: any) {
    if (message.type === 'mousePosition') {
      // アクティブなタブにマウス座標を転送
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'nativeMousePosition',
            x: message.x,
            y: message.y,
            timestamp: message.timestamp
          }).catch(() => {
            // content script がまだ注入されていない場合は無視
          });
        }
      });
    }
  }

  /**
   * Native Host にメッセージを送信
   */
  send(message: any) {
    if (this.port) {
      this.port.postMessage(message);
    }
  }

  /**
   * 接続を切断
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.port) {
      this.send({ command: 'stop' });
      this.port.disconnect();
      this.port = null;
    }

    this.isEnabled = false;
  }
}

// シングルトンインスタンス
export const nativeHostBridge = new NativeHostBridge();
```

#### content-scripts/floating-ui.ts（拡張部分）

```typescript
// 既存の Web API ベースのトラッキング
let useNativeHost = false;
let lastNativeX = 0;
let lastNativeY = 0;

/**
 * Native Host からのマウス座標を処理
 */
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'nativeMousePosition') {
    if (!useNativeHost) return;

    const { x, y, timestamp } = message;
    lastNativeX = x;
    lastNativeY = y;

    // ウィンドウ左端からの距離を計算
    const windowLeft = window.screenX;
    const distanceFromLeftEdge = x - windowLeft;

    updateDebugInfo({
      source: 'native-host',
      screenX: x,
      screenY: y,
      windowScreenX: windowLeft,
      distanceFromWindowEdge: distanceFromLeftEdge,
      timestamp,
    });

    // エッジ検知
    if (distanceFromLeftEdge <= HOTZONE_WIDTH_PX && distanceFromLeftEdge >= 0) {
      triggerFloatingUI({ source: 'native-host' });
    }
  }
});

/**
 * Native Host の利用可能性をチェックして切り替え
 */
async function initializeTracking() {
  const response = await chrome.runtime.sendMessage({ type: 'checkNativeHost' });

  if (response?.available) {
    console.log('Using native host for edge detection');
    useNativeHost = true;
    // Native Host を使用する場合、Web API のイベントは補助的に使用
  } else {
    console.log('Using Web API for edge detection');
    useNativeHost = false;
    setupWebAPITracking(); // Phase 1-3 の実装
  }
}

initializeTracking();
```

---

## メリット

### 1. **完全な座標取得**
- ✅ ウィンドウ境界外でもマウス座標を取得
- ✅ リサイズ領域（↔ カーソル）でも途切れない
- ✅ ブラウザ UI（タブバー、ツールバー）上でも正確

### 2. **Arc と同等の精度**
- ✅ OS レベルの API を使用
- ✅ イベントの間引きがない
- ✅ フレームレート制限を受けない

### 3. **高精度タイミング**
- ✅ 最小遅延（OS ネイティブイベント）
- ✅ `requestAnimationFrame` の制約なし

### 4. **複数ディスプレイ対応**
- ✅ `NSEvent.mouseLocation` は画面座標系
- ✅ 負座標も自然にサポート

### 5. **将来的な拡張性**
- ✅ タッチパッドジェスチャーの高精度検知
- ✅ マルチタッチイベント
- ✅ 他の OS レベル機能との統合

---

## デメリット / 課題

### 1. **インストールの複雑さ** ⚠️

**問題**:
- Chrome 拡張 + ネイティブアプリの **2ステップインストール**
- Chrome Web Store だけでは完結しない

**影響**:
- ユーザー体験が悪化
- 離脱率が高まる可能性
- サポートコストが増加

**軽減策**:
- オンボーディング画面で明確なガイダンス
- インストーラーの提供（Homebrew formula など）
- オプション機能として提供（必須ではない）

---

### 2. **プラットフォーム依存** ⚠️

**問題**:
- macOS 専用実装
- Windows / Linux は別途対応が必要

**影響**:
- クロスプラットフォーム開発が複雑化
- Windows/Linux ユーザーは恩恵を受けられない

**代替案**:
- **Windows**: `SetWindowsHookEx` + `WH_MOUSE_LL`
- **Linux**: `xinput` または `libinput`

---

### 3. **権限要求** ⚠️

**CGEventTap 使用時**:
- macOS の **アクセシビリティ権限** が必要
- ユーザーがシステム設定で手動許可

**問題**:
- UX 障壁が高い
- セキュリティ/プライバシーの懸念を引き起こす

**軽減策**:
- `NSEvent.addGlobalMonitorForEvents` を優先使用（権限不要）
- 必要な場合のみ `CGEventTap` にフォールバック

---

### 4. **配布の複雑さ** ⚠️

**問題**:
- ネイティブアプリをどう配布するか？
  - **Homebrew formula**: 技術者向け、インストールは簡単
  - **直接ダウンロード**: 公証（Notarization）が必要
  - **App Store**: 審査が厳しい、サンドボックス制約

**推奨**:
- **Phase 1**: GitHub Releases で署名済み .app を配布
- **Phase 2**: Homebrew formula 追加
- **Phase 3**: App Store 検討（必要に応じて）

---

### 5. **セキュリティ / プライバシー** ⚠️

**問題**:
- システム全体のマウストラッキングは強力な権限
- ユーザーに不安を与える可能性

**軽減策**:
- オープンソースで透明性を確保
- データを一切保存しない（リアルタイム送信のみ）
- プライバシーポリシーで明記
- トラッキングの ON/OFF スイッチを提供

---

### 6. **メンテナンスコスト** ⚠️

**問題**:
- 2つのコードベース（拡張 + ネイティブアプリ）
- macOS バージョンアップへの対応
- Chrome API 変更への対応

**影響**:
- 開発リソースが分散
- テスト負荷が増加

---

## 実装戦略：段階的導入

### Phase 0: Web API ベース（Phase 1-3）【最優先】

**目的**: Chrome 拡張の範囲内で最善を尽くす

**実装**:
1. ✅ Phase 1: `getCoalescedEvents()` で間引き補正
2. ✅ Phase 2: `pointerleave` 推論で境界到達補完
3. ✅ Phase 3: `screenX` 座標による境界近接判定

**期待される精度**: 80-90%

**メリット**:
- 全プラットフォームで動作
- インストールが簡単
- 低リスク

---

### Phase 4 (Optional): Native Host 【将来的な選択肢】

**判断基準**:
- Phase 0-3 で **検知失敗率 > 10%** の場合のみ検討
- ユーザーからのフィードバックで「ウィンドウ境界での検知が不安定」という報告が多い場合

**実装方針**:
1. **オプション機能** として提供
2. ネイティブホストが利用可能なら自動使用
3. 利用不可ならフォールバック（Phase 0-3）

**実装例**:
```typescript
// 起動時に判定
const nativeHostAvailable = await checkNativeHostAvailability();

if (nativeHostAvailable) {
  console.log('Using native host (high precision mode)');
  setupNativeHostTracking();
} else {
  console.log('Using Web API (standard mode)');
  setupWebAPITracking(); // Phase 1-3
}
```

---

## 実装タスク（Phase 4 を実装する場合）

### 1. Swift ネイティブアプリ開発

**タスク**:
- [ ] Xcode プロジェクト作成
- [ ] `MouseTracker.swift` 実装
- [ ] `NativeMessaging.swift` 実装
- [ ] ユニットテスト
- [ ] コード署名・公証

**期間**: 3-5日

---

### 2. Native Host Manifest 配置

**タスク**:
- [ ] manifest.json 作成
- [ ] インストールスクリプト作成（`install.sh`）
- [ ] アンインストールスクリプト作成（`uninstall.sh`）
- [ ] Homebrew formula 作成（オプション）

**期間**: 1-2日

---

### 3. Chrome 拡張側の実装

**タスク**:
- [ ] `NativeHostBridge` クラス実装
- [ ] `floating-ui.ts` にネイティブホスト対応追加
- [ ] 設定画面に ON/OFF スイッチ追加
- [ ] エラーハンドリング（接続失敗時のフォールバック）
- [ ] デバッグ UI に「Native Host: Active」表示追加

**期間**: 2-3日

---

### 4. テスト

**タスク**:
- [ ] ネイティブホスト単体テスト
- [ ] Chrome 拡張との統合テスト
- [ ] 複数ディスプレイ環境でのテスト
- [ ] パフォーマンステスト（CPU/メモリ使用率）
- [ ] エラーケーステスト（ネイティブホスト未インストール、権限拒否など）

**期間**: 2-3日

---

### 5. ドキュメント

**タスク**:
- [ ] インストールガイド（README）
- [ ] トラブルシューティングガイド
- [ ] プライバシーポリシー更新
- [ ] FAQ 追加

**期間**: 1日

---

### 6. 配布

**タスク**:
- [ ] GitHub Releases で .app 配布
- [ ] Homebrew formula 公開
- [ ] インストール手順を Web サイトに追加

**期間**: 1-2日

---

**総期間**: 約 2週間（フルタイム開発の場合）

---

## リスク評価

| リスク | 影響度 | 確率 | 軽減策 |
|--------|--------|------|--------|
| ユーザーがインストールを諦める | 高 | 中 | オプション機能化、明確なガイド |
| macOS アップデートで動作不良 | 中 | 低 | CI で複数バージョンテスト |
| アクセシビリティ権限を拒否される | 中 | 中 | `NSEvent` を優先使用 |
| Chrome API 変更で接続不可 | 高 | 低 | Native Messaging は安定した API |
| セキュリティ懸念でユーザーが不信感 | 中 | 中 | オープンソース化、透明性確保 |

---

## 代替案の検討

### 代替案A: Electron ラッパー

**アイデア**: Chrome 拡張を Electron アプリでラップし、Node.js の `ioHook` などを使用

**メリット**:
- クロスプラットフォーム対応が容易

**デメリット**:
- もはや「Chrome 拡張」ではない
- ユーザーがブラウザを切り替える必要
- 配布サイズが大きい

**結論**: ❌ 却下（本プロジェクトの趣旨と合わない）

---

### 代替案B: Browser Extension API の拡張提案

**アイデア**: Chromium にウィンドウ境界イベントの API を提案

**メリット**:
- 標準化されればすべての拡張で利用可能

**デメリット**:
- 採用まで数年かかる
- 採用される保証がない

**結論**: ⏸️ 長期的には有益だが、短期的な解決にはならない

---

## 結論

### 技術的実現可能性: ✅ **可能**

Swift + Chrome Native Messaging API を使えば、macOS でウィンドウ境界外のマウス座標取得が実現できる。

### 推奨アプローチ: **段階的導入**

1. **今すぐ**: Phase 1-3（Web API ベース）を実装 【最優先】
2. **評価**: 実際の使用で検知失敗率を計測
3. **判断**: 失敗率が許容範囲外なら Phase 4（Native Host）を検討
4. **実装**: オプション機能として提供（フォールバック付き）

### 実装判断のしきい値

| 指標 | 許容範囲 | Phase 4 実装を検討 |
|------|---------|-------------------|
| エッジ検知成功率 | ≥ 90% | < 90% |
| ユーザーからの不満報告 | < 5% | ≥ 5% |
| リサイズ領域での検知失敗 | 時々 | 頻繁 |

---

## 参考資料

### Chrome Native Messaging
- [Chrome Extensions: Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Example: Native Messaging Host](https://chromium.googlesource.com/chromium/src/+/master/chrome/common/extensions/docs/examples/api/nativeMessaging/)

### macOS Event Monitoring
- [NSEvent.addGlobalMonitorForEvents](https://developer.apple.com/documentation/appkit/nsevent/1535472-addglobalmonitorforevents)
- [CGEvent Tap](https://developer.apple.com/documentation/coregraphics/1454426-cgevent)
- [Quartz Event Services](https://developer.apple.com/documentation/coregraphics/quartz_event_services)

### Native Messaging Protocol
- [Protocol Specification](https://developer.chrome.com/docs/apps/nativeMessaging/#native-messaging-host-protocol)
- Message format: `[4-byte length (little-endian)][JSON data]`

### セキュリティ
- [App Sandbox](https://developer.apple.com/documentation/security/app_sandbox)
- [Code Signing](https://developer.apple.com/support/code-signing/)
- [Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

---

## 次のステップ

### 短期（現在）
1. ✅ このドキュメントを `docs/investigation/` に保存
2. ✅ Phase 1-3（Web API ベース）の実装を優先
3. ✅ 計測用デバッグ UI の拡充

### 中期（Phase 1-3 完了後）
1. ⏸️ 実際の使用で検知精度を評価
2. ⏸️ ユーザーフィードバックを収集
3. ⏸️ Phase 4 の必要性を判断

### 長期（必要に応じて）
1. ⏸️ Swift プロトタイプの開発
2. ⏸️ PoC でパフォーマンス検証
3. ⏸️ 本格実装・配布

---

**最終更新**: 2025-12-28
**ステータス**: 🔮 将来的な選択肢（未実装）
**関連ドキュメント**:
- [arc-browser-edge-detection-analysis.md](./arc-browser-edge-detection-analysis.md)
- [Atlas Floating Mode Handbook](../guides/atlas-floating-mode.md)
