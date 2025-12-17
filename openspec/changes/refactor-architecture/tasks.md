# refactor-architecture タスク

## Phase 1: Spaces Service Layer（完了）

### 1. Background refactor

- [x] 1.1 Define `SpaceState` type and storage helpers in `spaces.ts`
- [x] 1.2 Implement `getSpacesSnapshot` using `SpaceState[]` + Chrome APIs
- [x] 1.3 Wire `getSpacesSnapshot` into `background/index.ts` handlers
- [x] 1.4 Add unit tests for `getSpacesSnapshot` (space-navigation.spec.ts)

### 2. Space operations

- [x] 2.1 Implement `createSpace(name, color)` using tabGroups + `SpaceState`
- [x] 2.2 Implement `removeSpace(spaceId)` with cleanup
- [x] 2.3 Implement `moveTabToSpace` and `toggleTabPinned`
- [x] 2.4 Ensure all operations broadcast updated snapshots

---

## Phase 2: Bridge & Hooks 統合（残タスク）

### 3. Bridge & hooks

- [ ] 3.1 `ServiceWorkerBridge` と background handlers の payload/response shape を統一
- [ ] 3.2 `use-spaces-query` hooks を Bridge-backed operations に統一
- [ ] 3.3 `useSpacesSync` / `requestSpacesSnapshot` を整理・簡素化

### 4. UI integration

- [ ] 4.1 `SpaceManager` の改善
  - エラー/ローディング時もヘッダー + "+ New" ボタンを常に表示
  - loading/error states をインラインで表示
  - `useSpacesSnapshot` を single source of truth として使用
- [ ] 4.2 E2E tests を新しい動作に合わせて調整

---

## Phase 3: Extension Layering（将来タスク）

### 5. Service Worker 責務分離

- [ ] 5.1 `background/index.ts` の責務を棚卸し（router / listeners / handlers / init）
- [ ] 5.2 handlers を分割可能な構造へ移行
- [ ] 5.3 イベント購読を listeners モジュールへ分離
- [ ] 5.4 `chrome.*` 直接参照を adapter 層で抽象化

### 6. Content Script 整理

- [ ] 6.1 content script を「DOM 注入・ライフサイクル」と「React mount」に分割
- [ ] 6.2 Settings 永続化を `chrome.storage.local` に統一

---

## Phase 4: MV3 E2E Stability（将来タスク）

### 7. Manifest / ビルド設定

- [ ] 7.1 テスト用拡張キーの生成手順をドキュメント化
- [ ] 7.2 テストビルド時のみ manifest `key` を注入
- [ ] 7.3 本番ビルドで `key` が出力されないことを確認

### 8. Service Worker 安定化

- [ ] 8.1 test 環境限定の Keep-Alive 方針を確定
- [ ] 8.2 test 専用ハートビート処理を追加
- [ ] 8.3 初期化処理の相互作用を整理

### 9. Playwright フィクスチャ

- [ ] 9.1 固定拡張 ID を使用するよう簡素化
- [ ] 9.2 `waitForExtensionServiceWorker` をデバッグ用途に限定
- [ ] 9.3 MV3 前提で timeout 設定を見直し

---

## Phase 5: Background Reliability（部分完了）

### 10. Specification

- [x] 10.1 既存の background-services スペックを確認
- [x] 10.2 UI モード配信・ジェスチャー連動・コマンドエラー要件を追記

### 11. Implementation

- [x] 11.1 broadcastUiMode / commandHandlers のユニットテストを追加
- [ ] 11.2 ServiceWorkerBridge との統合テストを追加
- [ ] 11.3 E2E シナリオを拡張して gesture + UI mode を検証

---

## Quality Gate（全フェーズ共通）

- [ ] QG.1 `just check` を実行し、lint/format/typecheck が通ること
- [ ] QG.2 `just test` を実行し、既存テストが落ちないこと
- [ ] QG.3 `just e2e` を実行し、E2E テストが通ること
- [ ] QG.4 `openspec validate refactor-architecture --strict` をパス
