## 1. Background refactor

- [ ] 1.1 Define `SpaceState` type and storage helpers in `src/background/services/spaces.ts`（仮）
- [ ] 1.2 Implement `getSpacesSnapshot` using `SpaceState[]` + Chrome tab/tabGroups APIs
- [ ] 1.3 Wire `getSpacesSnapshot` into `background/index.ts` handlers（Bridge 経路 & 既存 command 経路）
- [ ] 1.4 Add deterministic unit tests for `getSpacesSnapshot`（grouped/pinned/ungrouped/error cases）

## 2. Space operations

- [ ] 2.1 Implement `createSpace(name, color)` using tabGroups + `SpaceState`（デフォルトタブ生成含む）
- [ ] 2.2 Implement `removeSpace(spaceId)` with tabs + bookmarks cleanup + SpaceState 更新
- [ ] 2.3 Implement `moveTabToSpace({ tabId, spaceId, pinned? })` and `toggleTabPinned(tabId, pinned?)`
- [ ] 2.4 Ensure all operations update `SpaceState[]` and broadcast updated snapshots (`broadcastSpacesSnapshot`)

## 3. Bridge & hooks

- [ ] 3.1 Align `ServiceWorkerBridge` methods and background handlers（payload/response shape を統一）
- [ ] 3.2 Update `use-spaces-query` hooks to rely solely on Bridge-backed operations
- [ ] 3.3 Deprecate or simplify `useSpacesSync` / `requestSpacesSnapshot` in favor of the new API

## 4. UI integration

- [ ] 4.1 Update `SpaceManager` to:
- [ ]     - Always display header + "+ New" button（エラー/ローディング時も）
- [ ]     - Render loading/error states inline below the header
- [ ]     - Use `useSpacesSnapshot` results as the single source of truth
- [ ] 4.2 Adjust E2E tests (`space-management.spec.ts`, `simple-space-test.spec.ts`) to new behaviors

## 5. QA & cleanup

- [ ] 5.1 Run `pnpm check`, `pnpm test`, `pnpm test:e2e`
- [ ] 5.2 Remove or archive obsolete legacy code paths related to Spaces
- [ ] 5.3 Update developer docs / README sections referencing old Spaces behavior
