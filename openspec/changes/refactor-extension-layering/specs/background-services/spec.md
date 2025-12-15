## ADDED Requirements

### Requirement: Background service worker SHALL be structured for dependency isolation in unit tests

The system SHALL structure background service worker logic so that Chrome API dependencies can be isolated for deterministic unit tests. This requirement is satisfied when the core background logic can be exercised with mocked Chrome API surfaces without requiring a running extension runtime.

#### Scenario: Deterministic unit test setup without extension runtime

- **GIVEN** a unit test environment without an actual extension runtime
- **WHEN** the background core logic is executed with mocked Chrome API dependencies
- **THEN** the logic can produce deterministic outputs (e.g. snapshots / responses)
- **AND** the test does not require a real service worker lifecycle to be active

#### Scenario: Gradual adapter migration

- **GIVEN** background services currently call `chrome.*` directly
- **WHEN** a new Chrome API adapter is introduced for a subset of APIs (e.g. tabs/runtime)
- **THEN** the system can migrate call sites incrementally without changing functional behavior
- **AND** the migrated code paths remain testable via adapter mocks

### Requirement: Background settings SHALL be stored in `chrome.storage.local`

The system SHALL persist user-facing background settings in `chrome.storage.local` and MUST NOT depend on `chrome.storage.sync` as the source of truth for those settings.

#### Scenario: Read settings from local with defaults

- **GIVEN** no settings have been stored in `chrome.storage.local`
- **WHEN** the background loads settings
- **THEN** the background returns settings with default values applied

#### Scenario: Migrate legacy sync settings to local on first read

- **GIVEN** legacy settings exist in `chrome.storage.sync`
- **AND** no settings exist in `chrome.storage.local`
- **WHEN** the background loads settings for the first time
- **THEN** the background copies the legacy values into `chrome.storage.local`
- **AND** subsequent reads use `chrome.storage.local` as the source of truth

#### Scenario: Apply setting changes immediately via storage listener

- **GIVEN** the background is running
- **WHEN** a relevant setting key changes in `chrome.storage.local`
- **THEN** UI mode changes are applied immediately
- **AND** auto-archive scheduling is updated to reflect the new settings
