## Why

Arcify 由来の Spaces ロジックと、現在の MV3 + React Query ベースの実装が混在しており、
Service Worker / Bridge / UI 間の責務が曖昧になっている。

- `getSpacesSnapshot` の挙動が不透明で、E2E/Unit テストからも状態の一貫性を検証しづらい。
- UI 側では `SpaceManager` のローディング/エラー処理と `+ New` ボタン表示が不安定で、Arc の Spaces 体験を再現できていない。
- Arc ブラウザの Spaces（Life-area / Project 単位の distinct browsing areas）を再現するには、
  Service Worker を中心とした Space ドメインの再設計が必要。

## What Changes

- Spaces のドメインモデルを、永続層の `SpaceState[]` と UI 向けの `SpaceSnapshot[]` に分離する。
- Service Worker 内に `SpacesService`（仮称）を導入し、tab groups / bookmarks / storage との同期ロジックを集約する。
- background の public API を整理し、少なくとも次の操作を Bridge 経由で提供する:
  - `getSpacesSnapshot`
  - `createSpace(SpaceCreateRequest)`
  - `removeSpace(spaceId)`
  - `moveTabToSpace(TabMoveRequest & { pinned?: boolean })`
  - `toggleTabPinned(tabId, pinned?)`
- React 側は `ServiceWorkerBridge + React Query` を唯一の取得経路とし、旧来の `requestSpacesSnapshot` ベースの同期は段階的に縮退させる。
- UI (`SpaceManager` など) は、新しい `SpaceSnapshot` を前提に pinned / temporary を明確に分離し、Arc Spaces らしい切り替え体験を提供する。
- **BREAKING**: 既存の Spaces 取得ロジックや `useSpacesSync` の挙動が変わる可能性があるため、移行期間中は慎重にテストと互換性確認を行う。

## Impact

- Affected specs:
  - `openspec/specs/background-services/spec.md`
    - `getSpacesSnapshot` のユニットテスト要件を "SpaceState → SpaceSnapshot" ベースに拡張。
    - 新しい space 管理 API の要件を追加。
  - `openspec/specs/platform/spec.md`
    - 「Legacy 機能の再実装」のうち Spaces 部分を、Arc 互換の挙動として具体化。
  - 新規 capability: `openspec/specs/spaces/spec.md`
    - Spaces ドメイン（SpaceState, SpaceSnapshot, pinned/temporary, active space）の要件を集約。
- Affected code (例):
  - `apps/extension/src/background/index.ts`
  - `apps/extension/src/background/services/browser.ts`（または同等の service 層）
  - `apps/extension/src/lib/service-worker-bridge.ts`
  - `apps/extension/src/hooks/use-spaces-query.ts`
  - `apps/extension/src/lib/spaces.ts`, `apps/extension/src/lib/useSpacesSync.ts`
  - `apps/extension/src/ui/components/SpaceManager.tsx` ほか Spaces 関連 UI
  - 関連テスト（background 単体テスト / Bridge テスト / Playwright E2E）
