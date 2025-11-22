## ADDED Requirements

### Requirement: MV3 background testability for E2E

The system SHALL provide a stable background environment for MV3 E2E tests without affecting production behavior.

#### Scenario: Test environment keep-alive

- **WHEN** the extension runs under the `test` environment used by E2E tests
- **THEN** the background Service Worker periodically performs a lightweight Chrome API activity
  to avoid premature termination during active tests
- **AND** this behavior is clearly guarded by build-time or runtime checks
  so that it is disabled in production builds

#### Scenario: No keep-alive in production

- **WHEN** the extension runs in the production environment
- **THEN** the background Service Worker follows the default MV3 lifecycle
- **AND** no artificial keep-alive loop is active
