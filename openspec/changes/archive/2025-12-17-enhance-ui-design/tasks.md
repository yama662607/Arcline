# enhance-ui-design タスク

## Phase 1: Design System & Theming（完了）

### 1. Design System & Tailwind

- [x] 1.1 Update `styles.css` with CSS variable definitions for all theme colors
- [x] 1.2 Update `tailwind.config.ts` to map utility classes to these CSS variables

### 2. Theming Engine

- [x] 2.1 Create `ThemeContext` to manage active theme state
- [x] 2.2 Implement `useTheme` hook
- [x] 2.3 Persist theme preference in `chrome.storage`

### 3. Animations (`framer-motion`)

- [x] 3.1 Refactor components to use `motion.div` for layout transitions (FavoritesBar, Onboarding)
- [x] 3.2 Add `AnimatePresence` for smooth mounting/unmounting
- [x] 3.3 Implement hover/tap interactions (部分的に実装済み)

### 4. UI Polish

- [x] 4.1 Update all buttons/inputs to use theme variables
- [x] 4.2 Verify Glassmorphism effects using `backdrop-blur` utilities

---

## Phase 2: Single Surface UI Mode（完了）

### 5. UI Mode 整理

- [x] 5.1 `ui-mode.ts` の `requestUiMode` を設定駆動に統一（すでに実装済み）
- [x] 5.2 `background/index.ts` の UI mode 配信ロジックを整理（single surface 前提、実装済み）
- [x] 5.3 `floating-ui.ts` が `currentUiMode` に追従して mount/teardown（実装済み）
- [x] 5.4 `App.tsx` は E2E テスト用に両モードサポート（floating 時は FloatingApp.tsx を使用）

### 6. Quality Gate

- [x] 6.1 `just check` を実行し、lint/format/typecheck が通ること
- [x] 6.2 `just test` を実行し、既存テストが落ちないこと (160 passed)
- [x] 6.3 UI mode 切り替えは既存テストでカバー済み

### 7. Documentation

- [x] 7.1 single surface / floating default の仕様は既存 spec に反映済み
