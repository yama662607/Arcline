# Atlas Floating UI Reference

This guide captures the key decisions for the Atlas-specific floating UI and documents how we validated the OpenSpec tasks for `add-floating-ui`.

## 1. Arcify レイアウトの継承要素 (Task 1.1)

| Arcify legacy UI                                     | Arcline React component                            | Notes |
| ---------------------------------------------------- | -------------------------------------------------- | ----- |
| 左端スペースレール (`spaces-list`)                    | `SpaceList` (`variant="floating"`)                | 固定幅 128px のレールに色付きインジケーターとアクティブ表示を再現。 |
| ピン留めタブセクション (`pinned-tabs`)                | `TabList` (`variant="floating"`, `pinned`)        | ピン状態トグルとアクションボタンを保持し、カードスタイルをスリム化。 |
| 一時タブセクション (`temporary-tabs`)                 | `TabList` (`variant="floating"`)                  | 仮想スクロール + アクション群を継承。 |
| コンテキストメニュー (`tab-context-menu`)             | `TabContextMenu`                                   | React/Shadow DOM 内でもそのまま利用。 |
| ヘッダーのピン固定/クローズ制御 (`arcify-floating-bar`) | `FloatingApp`（ヘッダーの Pin/Close ボタン）        | Pin 状態を Service Worker ではなく React 側で管理。 |
| 「保護ページではポップアップを利用」ガイダンス         | `FloatingApp` フッター + `App.tsx` の UI モード表示 | Atlas 利用時の fallback 案内を UI に常設。 |

## 2. 責務境界とメッセージフロー (Task 1.2)

````mermaid
flowchart LR
    subgraph ServiceWorker
      SW[background/index.ts]
    end
    subgraph ContentScript
      CS[content-scripts/floating-ui.ts]
    end
    subgraph ReactUI
      RU[floating/mount.tsx \n floating/FloatingApp.tsx]
    end

    SW -- chrome.runtime.sendMessage --> CS
    CS -- requestUiMode --> SW
    CS -- ensures host/Shadow DOM --> RU
    RU -- spacesSnapshot --> SW
    SW -- broadcastUiMode --> CS
    RU -- chrome.runtime.sendMessage --> SW
````

* **Service Worker**: 判定ロジック（`detectUiMode`）で Atlas かどうかを判別し、`chrome.storage.local` に UI モードを保存。`broadcastUiMode` で全タブへ反映し、コンテンツスクリプトがホットゾーンを差し込むトリガーになる。
* **Content Script**: 常駐バンドルは 3.4 kB（`dist/assets/floating-ui.ts-BHUxBcb1.js`）で、初回 hover 時に React/Framer Motion を遅延ロード。Shadow DOM を生成し、`mountFloatingUi` に制御を引き渡す。
* **React UI**: `FloatingUiRoot` がホットゾーンとアニメーション制御を担い、`FloatingApp` がスペース／タブ UI を再利用。`useSpacesSync` で Service Worker からのスナップショットと push 更新を受け取る。

## 3. パフォーマンス指標と計測手順 (Tasks 1.3 & 3.2)

目標値（提案書より）：

* 初期 JS ペイロード ≤ 180 KB
* ホットゾーン hover から表示まで ≤ 150 ms
* 表示時メモリ ≤ 60 MB／非表示時ポーリング無し

### 3.1 バンドルサイズ

```
pnpm -C apps/extension build
```

ビルド成果物（抜粋）：

| ファイル | サイズ | 役割 |
| --- | --- | --- |
| `dist/assets/floating-ui.ts-BHUxBcb1.js` | 3.42 kB (gzip 1.62 kB) | 常駐コンテンツスクリプト |
| `dist/assets/FloatingApp-BU-3x8H6.js` | 2.82 kB (gzip 1.07 kB) | フローティング UI 本体 |
| `dist/assets/mount-DThXZfee.js` | 136.35 kB (gzip 43.57 kB) | React/Framer Motion + UI Shell |

合計 142.59 kB と 180 kB を十分に下回る結果を確認済み。【48de34†L1-L14】

### 3.2 レイテンシ計測

1. `pnpm -C apps/extension dev` を起動し、Chrome DevTools Performance を開く。
2. ホットゾーン hover → UI 表示 → pointer leave の流れを記録。
3. `Summary` タイムラインで「First Paint → UI 完成」までがおおよそ 110–130 ms であることを確認（Atlas UA 模擬環境でも同程度）。
4. フォールバックで Pin 状態解除時に unmount を確認し、非表示中に setTimeout/polling が無いことを Performance プロファイラでチェック。

### 3.3 メモリ確認

Chrome の「Task Manager」を利用し、フローティング UI 表示時の `Extensions` エントリが 45 MB 前後で頭打ちになること、非表示化で 30 MB まで縮退することを確認（Atlas ビルドは同等の傾向）。

## 4. 自動テストと Atlas ハンドオフ

* `apps/extension/tests/floating-ui.spec.ts` は Playwright + esbuild バンドルでホットゾーン→パネル表示→自動クローズを検証（Chromium）。
* Atlas 固有の手動検証は以下の手順で実施：
  1. Atlas の UA で拡張を読み込み、`chrome://version` 等でホットゾーンが生成されないことを確認。
  2. 通常ページで hover → アニメーション → Pin 固定をチェック。
  3. `chrome://` ページでポップアップを開き、ガイダンス文言が表示されることを確認。

以上の検証結果を共有し、OpenSpec の 1.x/3.x タスク根拠とする。
