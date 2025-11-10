## ADDED Requirements

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
