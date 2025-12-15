## 1. Implementation

1.1 Service Worker エントリポイント（`src/background/index.ts`）の責務を棚卸しし、移動単位（router / listeners / handlers / init）を確定する
1.2 handlers の定義を分割できる構造へ移行する（export で合成し、外部 I/F は維持する）
1.3 tabs/windows/tabGroups 等のイベント購読を listeners モジュールへ移動し、エントリポイントから分離する
1.4 `chrome.*` 直接参照を段階移行できる最小の adapter 層を導入する（注入可能な依存境界）
1.5 content script の責務を「DOM 注入・ライフサイクル制御」と「React mount」に分割できる構造へ寄せる（挙動は維持する）
1.6 設定（Settings）の永続化を `chrome.storage.local` に統一し、必要に応じて初回のみ `chrome.storage.sync` から移行する

## 2. Testing / Verification

2.1 既存ユニットテストが落ちないこと
2.2 既存 E2E（必要範囲）が落ちないこと

## 3. Quality Gate

3.1 `just check` を実行し、lint/format/typecheck/test が通ること

## 4. Documentation

4.1 本 Change の delta spec を更新し、責務分離とテスト容易性の要件を明文化する
4.2 `openspec validate refactor-extension-layering --strict` をパスさせる
