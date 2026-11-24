# Arcline — Testing & Verification Guide

Arcline uses a 4-layer automated verification pipeline so every change is tested against both pure unit assertions and a real Chromium / Brave browser instance.

## 1. Quick Commands (`just`)

```bash
just check            # 1. Biome format check + Biome lint + TypeScript typecheck + Vitest unit/engine tests
just build            # 2. Production MV3 build (sidepanel + empty-space + background SW + IIFE overlay.js)
just check-extension  # 3. Real-browser chrome.developerPrivate 0-error diagnostics + 2x live reload
just e2e              # 4. Real-browser Playwright E2E suite (14 scenarios)
just package          # 5. Chrome Web Store ZIP packaging & manifest/bundle validation
```

## 2. Unit & Engine Integration Tests (Vitest)

Located under `extension/src/core/tests/` and `extension/src/background/engine.test.ts`:

- `arc-import.test.ts`: Arc `StorableSidebar.json` parser, Space theme/icon extraction, duplicate/search/empty-folder cleanup.
- `archive.test.ts`: Inactive temporary tab selection and archive deduplication/merging.
- `colors.test.ts`: Neutral charcoal (`-1`) handling, OKLCH Space palette, and Tab Group color mapping.
- `derive.test.ts`: Pure `Snapshot -> SidebarState` derivation, per-Space `lastActiveTabId`, and `O(1)` live tab patching.
- `edge-hover.test.ts`: Deterministic `EdgeHoverMachine` dwell, graze rejection, drag suppression, lock state, and cross-monitor pointer leave cancellation.
- `settings.test.ts`: Default settings and numeric clamping.
- `space-swipe.test.ts`: Horizontal two-finger trackpad `SpaceSwipeMachine`, threshold commit, rubber-band resistance, same-direction inertia lock, and 0ms sign-reversal unlock for instant back-and-forth swiping.
- `space-theme.test.ts`: 2D color orbit coordinate conversion, harmony modes, multi-layer radial/linear gradient CSS generation, and neutral charcoal floor.
- `engine.test.ts`: End-to-end `Engine` command queue execution against an in-memory Chrome API mock.

## 3. Real-Browser Runtime Diagnostics (`just check-extension`)

`extension/scripts/check-extension.mjs` launches Brave (or Playwright Chromium when `ARCLINE_BROWSER=chromium`), inspects `chrome.developerPrivate.getExtensionsInfo()`, performs two live extension reloads, opens `sidepanel.html` and a live webpage with `overlay.js`, and asserts zero manifest, runtime, console, or page errors.

## 4. Real-Browser Playwright E2E Suite (`just e2e`)

Located under `extension/tests/e2e/`:

- `edge-hover.spec.ts` (9 tests):
  - 10-frame startup zero-paint check, lazy `iframe` creation, `< openDelayMs` graze rejection, deliberate left-edge dwell open, cross-origin extension `iframe` (OOPIF) hover persistence, and cursor-leave auto-hide.
  - Text selection drag suppression across the left edge and post-release re-arm.
  - Window-centered Settings modal full-viewport transparent stage expansion and outside-click dismissal.
  - Live drag resize handle width update and persistence across page reload.
  - Hostile webpage CSS immunity (`html { font-size: 10px !important }`, `:not(:defined) { display: none !important }`) and SPA DOM removal self-repair.
  - Automatic background tab `iframe` unload after `400ms`.
  - Two-finger horizontal trackpad Space swipe, instant reverse swipe without moving the cursor, destination tab auto-reveal (`keepOverlayOpen`), and `overscroll-behavior-x` isolation from browser Back/Forward navigation.
  - Webpage zoom invariance (`150%`, `75%`, `100%` via `chrome.tabs.setZoom`).
  - Overflowing right-click context menu extending past the sidebar edge, Space submenu, and action toast feedback.
- `resilience.spec.ts` (4 tests):
  - Forced MV3 Service Worker termination via CDP `ServiceWorker.stopAllWorkers` and automatic recovery.
  - Persistent profile browser restart (`--restore-last-session`) with zero duplicate bookmark folders.
  - Real native `chrome.sidePanel.open()` target attachment and rendering verification.
  - 15-cycle edge-hover open/close DOM node and JS heap memory bound check.
- `sidebar-workflows.spec.ts` (1 test):
  - End-to-end Favorites, Spaces, nested folders, Arc JSON import, `⌘K` search, context menu bounds, and visual snapshot generation.
