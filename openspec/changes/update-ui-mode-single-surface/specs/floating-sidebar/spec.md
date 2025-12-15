## MODIFIED Requirements

### Requirement: Floating UI mounts only when enabled

The floating sidebar SHALL mount only when the current UI mode is `floating`.

#### Scenario: Mode becomes floating

- **WHEN** a tab receives `{ command: "currentUiMode", mode: "floating" }`
- **THEN** the content script prepares the floating host and can mount the React UI on demand

#### Scenario: Mode becomes non-floating

- **WHEN** a tab receives `{ command: "currentUiMode", mode }` where `mode != "floating"`
- **THEN** the content script tears down the floating host and unmounts the React UI

## ADDED Requirements

### Requirement: Avoid duplicate workspace rendering

The system MUST avoid rendering the workspace UI simultaneously in both floating UI and extension page UI.

#### Scenario: Floating default

- **WHEN** the current UI mode is `floating`
- **THEN** the workspace UI is rendered only in floating UI
