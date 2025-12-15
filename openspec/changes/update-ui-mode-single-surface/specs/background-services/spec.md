## MODIFIED Requirements

### Requirement: UI mode resolution is controlled by background

The background service SHALL be the single source of truth for the current UI mode.

#### Scenario: Default to floating

- **WHEN** the UI mode setting is missing or invalid
- **THEN** the background service sets the current UI mode to `floating`

#### Scenario: Side panel unsupported fallback

- **WHEN** the user preference is `side-panel` AND the runtime does not support `chrome.sidePanel`
- **THEN** the background service falls back to `floating`

### Requirement: Broadcast UI mode changes

The background service SHALL broadcast UI mode changes to all tabs.

#### Scenario: Broadcast to content scripts

- **WHEN** the UI mode changes
- **THEN** content scripts receive `{ command: "currentUiMode", mode }`

## ADDED Requirements

### Requirement: Enforce single active UI surface

The background service MUST enforce that only one UI surface is active at a time.

#### Scenario: Floating selected

- **WHEN** the current UI mode is set to `floating`
- **THEN** the background service attempts to close the side panel UI (if available)
