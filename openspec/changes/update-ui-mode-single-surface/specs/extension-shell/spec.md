## MODIFIED Requirements

### Requirement: Extension UI is single-surface aware

The extension page UI SHALL not render the primary workspace UI when the current UI mode is `floating`.

#### Scenario: Side panel opened while mode is floating

- **WHEN** the extension page is opened AND the current UI mode is `floating`
- **THEN** the UI displays a lightweight disabled screen (no workspace rendering)

#### Scenario: Mode is side-panel

- **WHEN** the extension page is opened AND the current UI mode is `side-panel`
- **THEN** the UI renders the workspace UI
