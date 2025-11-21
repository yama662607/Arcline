# Spaces Specification (Delta)

## ADDED Requirements

### Requirement: Spaces SHALL represent first-class tab groups

Spaces MUST represent logical groupings of tabs backed by Chrome tab groups and persisted SpaceState. Each space SHALL have:

- A unique identifier (backed by a tab group ID)
- A human-readable name
- A color compatible with Chrome tab group colors
- Distinct pinned and temporary tab membership

#### Scenario: Default space initialization

- **WHEN** the extension initializes in a window with no existing tab groups
- **THEN** the system SHALL create a default space and associate all non-pinned tabs with it
- **AND** SpaceState MUST be persisted to storage

### Requirement: Spaces SHALL expose pinned and temporary sections

Each SpaceSnapshot MUST expose separate pinned and temporary collections so that the UI can render Arc-style sections.

#### Scenario: Pinned and temporary separation

- **WHEN** a space contains both long-lived (pinned) and short-lived (temporary) tabs
- **THEN** the corresponding SpaceSnapshot MUST expose these as `pinnedTabs` and `temporaryTabs`
- **AND** the combined `tabs` collection MUST remain consistent with their union

### Requirement: Active space switching MUST change the visible context

Switching the active space MUST change the visible context in a way similar to Arc's Spaces: only one space is "foreground" at a time for the user.

#### Scenario: Active space switch

- **WHEN** the user selects a different space in the UI
- **THEN** the background MUST ensure that the corresponding tab group is expanded or focused
- **AND** other tab groups MAY be collapsed to reduce visual noise
- **AND** the UI MUST update to show the pinned and temporary tabs for the active space only
