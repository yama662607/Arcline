## ADDED Requirements

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
