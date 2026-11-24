# Platform Specification

## Requirements

### Requirement: React ベースの拡張アーキテクチャ
Extension MUST render the vertical tab UI via a React + TypeScript application bundled with Vite and manage client state with Zustand.

#### Scenario: Side panel 対応ブラウザ
- **GIVEN** the browser exposes `chrome.sidePanel`
- **WHEN** the extension initializes
- **THEN** the Service Worker MUST detect support and load the React UI inside the side panel
- **AND** the UI MUST communicate with the Service Worker via runtime messaging

#### Scenario: Side panel 非対応ブラウザ
- **GIVEN** the browser does not expose `chrome.sidePanel`
- **WHEN** the extension initializes
- **THEN** the Service Worker MUST fallback to opening the same React UI via the toolbar popup or a dedicated popup window
- **AND** the user MUST still be able to access the vertical tab management features

### Requirement: Legacy 機能の再実装
The extension MUST reintroduce Arcify's core behaviors (tab context menu, bookmark synchronization, auto-archive) using the new architecture.

#### Scenario: Tab context menu actions
- **GIVEN** the user opens the tab context menu in the React UI
- **WHEN** the user selects an action (Pin/Unpin, Move to space, Close tab)
- **THEN** the UI MUST send a message to the Service Worker and the action MUST be reflected in Chrome's tab state
- **AND** the Service Worker MUST broadcast an updated spaces snapshot so the UI stays in sync

#### Scenario: Bookmark synchronization
- **GIVEN** the user pins or unpins a tab while the extension is active
- **WHEN** the action completes
- **THEN** the extension MUST update the corresponding Arcify bookmark folder to reflect the pinned state
- **AND** duplicate folders under Arcify MUST be merged to maintain a single source of truth

#### Scenario: Auto archive
- **GIVEN** the user enables auto archive in the settings
- **WHEN** a tab exceeds the configured idle threshold and meets Arcify's criteria (not audible, not bookmarked)
- **THEN** the Service Worker MUST archive the tab, close it, and add an entry to the archived list, making it available via the UI

### Requirement: Atlas 向けフローティング UI
The extension MUST provide a floating vertical tab UI for browsers where `chrome.sidePanel` cannot be opened, while preserving the Arcify layout and performance targets.

#### Scenario: ホットゾーン hover で UI 表示
- **GIVEN** the browser exposes the extension content script (e.g. Atlas) and the Side Panel cannot be opened by user gesture
- **WHEN** the user hovers the pointer over the 1–2px hot zone at the left edge of the page
- **THEN** the extension MUST animate the React vertical tab UI into view from the left within 150ms
- **AND** the rendered UI MUST reuse the existing Arcify button/layout structure

#### Scenario: ホットゾーン離脱で UI を閉じる
- **GIVEN** the floating UI is visible via the hot zone
- **WHEN** the pointer leaves the floating UI area and any configured grace period elapses
- **THEN** the UI MUST animate out of view and unmount, leaving no active polling timers running

#### Scenario: 非対応ページでのフォールバック
- **GIVEN** the current tab disallows content scripts (e.g. `chrome://`, PDF viewer)
- **WHEN** the user attempts to open the floating UI
- **THEN** the extension MUST fall back to the popup UI and display guidance on how to access the vertical tabs

#### Scenario: パフォーマンス指標を満たす
- **GIVEN** the floating UI bundle is built in production mode
- **WHEN** its assets are analyzed after compression
- **THEN** the initial JS payload dedicated to the floating UI MUST be ≤ 180KB
- **AND** measured paint-to-visible latency MUST average ≤ 150ms on a representative Chromium environment
- **AND** the UI MUST consume ≤ 60MB of memory once visible, reclaiming resources when hidden
