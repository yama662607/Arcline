## 1. Design System & Tailwind

- [x] 1.1 Update `styles.css` with CSS variable definitions for all theme colors.
- [x] 1.2 Update `tailwind.config.ts` to map utility classes to these CSS variables.

## 2. Theming Engine

- [x] 2.1 Create `ThemeContext` to manage active theme state.
- [x] 2.2 Implement `useTheme` hook.
- [x] 2.3 Persist theme preference in `chrome.storage`.

## 3. Animations (`framer-motion`)

- [x] 3.1 Refactor `Sidebar` to use `motion.div` for layout transitions (FavoritesBar で実装済み)
- [x] 3.2 Add `AnimatePresence` for smooth mounting/unmounting of tabs/spaces (FavoritesBar, Onboarding で実装済み)
- [x] 3.3 Implement `whileHover` and `whileTap` interactions for all interactive elements (部分的に実装済み)

## 4. UI Polish

- [x] 4.1 Update all buttons/inputs to use the new theme variables (ThemeContext 統合済み)
- [x] 4.2 Verify Glassmorphism effects using `backdrop-blur` utilities (実装済み)

## 1. Implementation

- [ ] 1.1 background の `resolveUiMode()` を設定駆動（Settings.uiMode）に戻し、side panel 非対応時のフォールバックを明確化する
- [ ] 1.2 `applyUiMode()` を single surface 前提で整理する（side-panel 以外では panel を閉じる/必要な broadcast を保証）
- [ ] 1.3 content script（floating-ui.ts）が `currentUiMode` に追従して mount/teardown することを確認し、不要な常駐コストを削減する
- [ ] 1.4 `App.tsx` を side-panel 専用に寄せる（floating 時は本 UI を描画しない・プレビュー切替経路を排除/開発専用化）
- [ ] 1.5 「同時表示ゼロ」の回帰テスト方針を追加（最低限、UI mode broadcast と teardown の動作確認）

## 2. Quality Gate

- [ ] 2.1 `pnpm check` を実行し、lint/format/typecheck が通ること
- [ ] 2.2 `pnpm test`（必要範囲）を実行し、既存テストが落ちないこと

## 3. Documentation

- [ ] 3.1 変更点（single surface / floating default）を仕様として spec delta に反映する
