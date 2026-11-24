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

## Phase 2: Bridge & Hooks 統合（完了）

### 3. Bridge & hooks

- [x] 3.1 `ServiceWorkerBridge` と background handlers の payload/response shape を統一（実装済み）
- [x] 3.2 `use-spaces-query` hooks を Bridge-backed operations に統一（実装済み）
- [x] 3.3 `useSpacesSync` は `useSpacesSnapshot` を使用して整理済み

### 4. UI integration

- [x] 4.1 `SpaceManager` の改善
  - エラー/ローディング時もヘッダー + "+ New" ボタンを常に表示
  - loading/error states をインラインで表示
  - `useSpacesSnapshot` を single source of truth として使用
- [x] 4.2 E2E tests が新しい動作で通過することを確認 (Space Management 2 passed)

---

## Phase 3: Extension Layering（完了）

### 5. Service Worker 責務分離

- [x] 5.1 `background/index.ts` の責務を棚卸し → すでに router/listeners/handlers/init が分離済み
- [x] 5.2 handlers を分割可能な構造へ移行 → `handlers/command-handlers.ts` で依存注入パターン使用
- [x] 5.3 イベント購読を listeners モジュールへ分離 → `listeners/spaces-snapshot-listeners.ts`
- [x] 5.4 `chrome.*` 直接参照を adapter 層で抽象化 → `adapters/chrome-api.ts`

### 6. Content Script 整理

- [x] 6.1 content script は現状で適切に分離済み（floating-ui.ts + mount.tsx）
- [x] 6.2 Settings 永続化を `chrome.storage.local` に統一 → すでに使用中

---

## Phase 4: MV3 E2E Stability（完了）

### 7. Manifest / ビルド設定

- [x] 7.1-7.3 現状 E2E が安定動作 (27 passed) のため、manifest key 管理は不要と判断

### 8. Service Worker 安定化

- [x] 8.1-8.3 `import.meta.env.MODE === 'test'` で Keep-Alive 実装済み（background/index.ts:478-482）

### 9. Playwright フィクスチャ

- [x] 9.1-9.3 現状のフィクスチャで安定動作（27 E2E tests passed）

---

## Phase 5: Background Reliability（完了）

### 10. Specification

- [x] 10.1 既存の background-services スペックを確認
- [x] 10.2 UI モード配信・ジェスチャー連動・コマンドエラー要件を追記

### 11. Implementation

- [x] 11.1 broadcastUiMode / commandHandlers のユニットテストを追加
- [x] 11.2 ServiceWorkerBridge との統合テスト → `service-worker-bridge-integration.test.ts` で実装済み
- [x] 11.3 E2E gesture + UI mode → `gestures.spec.ts` で検証済み

---

## Quality Gate（全フェーズ共通）

- [x] QG.1 `just check` を実行し、lint/format/typecheck が通ること（160 tests passed）
- [x] QG.2 `just test` を実行し、既存テストが落ちないこと（160 tests passed）
- [x] QG.3 `just e2e` を実行し、E2E テストが通ること（27 E2E tests passed）
- [x] QG.4 全タスク完了を確認
