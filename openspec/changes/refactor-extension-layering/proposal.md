## Why

`apps/extension` の実装では、Service Worker（`src/background/index.ts`）が肥大化しており、メッセージルーティング・イベント購読・各ドメイン処理・初期化が同一ファイルに集中している。この状態は変更影響範囲が広く、既存/進行中の改善（Spaces 層の整理、UI mode の single surface 化、E2E 安定化等）と衝突しやすい。

また `chrome.*` API への直接依存が散在しており、ユニットテストでのモックが困難になりやすい。結果として、仕様（振る舞い）を変えないリファクタでも回帰を起こしやすい構造になっている。

## What Changes

- Service Worker のエントリポイントを「組み立て（wiring）」中心に縮退し、責務（ルーティング/イベント購読/handler 定義）をモジュール分割する
- `chrome.*` 参照を段階的に adapter 層へ寄せるための基盤（注入可能な依存境界）を導入する
- content script について、DOM 注入・ライフサイクル制御と React マウント責務を分離できる構造へ寄せる（挙動は変えない）
- 設定（Settings）の永続化は `chrome.storage.local` を正とし、必要に応じて初回のみ `chrome.storage.sync` から `chrome.storage.local` へ移行する
- 設定変更は `chrome.storage.onChanged`（local）を起点に UI mode / auto-archive を即時反映する
- 変更に伴うログ/エラーの文言・出力箇所の差分は許容する（ただし機能的な挙動は維持する）

## Impact

- Affected specs:
  - `background-services`
  - `extension-shell`
  - `floating-sidebar`
- Affected code (例):
  - `apps/extension/src/background/index.ts`
  - `apps/extension/src/background/services/*`
  - `apps/extension/src/content-scripts/*`
  - `apps/extension/src/lib/service-worker-bridge.ts`
  - `apps/extension/src/ui/components/SettingsPanel.tsx`

## Non-Goals

- Spaces ドメインの設計変更（`refactor-spaces-service-layer` の領域）
- UI mode の single surface 化の仕様変更（`update-ui-mode-single-surface` の領域）
- MV3 E2E の安定化方針（`stabilize-mv3-e2e-service-worker` の領域）
