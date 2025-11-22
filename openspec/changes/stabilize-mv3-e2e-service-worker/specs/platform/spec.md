## ADDED Requirements

### Requirement: Deterministic extension ID for E2E tests

The system SHALL provide a deterministic Chrome extension ID for automated E2E tests.

#### Scenario: E2E test build uses a stable ID

- **WHEN** the extension is built for the `test` environment used by Playwright E2E tests
- **THEN** the manifest includes a stable `key` value dedicated to tests
- **AND** the resulting extension ID remains constant across builds and machines
- **AND** Playwright fixtures do not need to query the Service Worker to resolve the ID

### Requirement: Distinct behaviors between production and test builds

The system SHALL separate production and test behaviors regarding extension identity and background lifetime.

#### Scenario: Production build managed by the Chrome Web Store

- **WHEN** the extension is built for production and distributed via the Chrome Web Store
- **THEN** the manifest does NOT embed the test `key`
- **AND** the extension ID is managed by the store
- **AND** no test-only keep-alive logic is active in the background Service Worker

#### Scenario: Local E2E test build

- **WHEN** the extension is built for local E2E tests
- **THEN** the manifest MAY include a test-only `key` to stabilize the extension ID
- **AND** test-only keep-alive logic MAY be active in the background Service Worker
  as long as it is excluded from production builds
