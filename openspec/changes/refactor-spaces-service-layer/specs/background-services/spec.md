## ADDED Requirements

### Requirement: Background SHALL maintain SpaceState as the single source of truth

The background layer SHALL maintain an internal `SpaceState[]` structure in `chrome.storage.local` representing spaces, their colors, and tab membership.

#### Scenario: Persisted SpaceState

- **WHEN** a space is created, removed, or updated via background operations
- **THEN** the background SHALL update `SpaceState[]` in storage
- **AND** subsequent calls to `getSpacesSnapshot` MUST reflect the updated state

### Requirement: Background SHALL expose space management operations

The background service SHALL expose the following operations callable via the Service Worker bridge:

- `getSpacesSnapshot`
- `createSpace(SpaceCreateRequest)`
- `removeSpace(spaceId)`
- `moveTabToSpace(TabMoveRequest & { pinned?: boolean })`
- `toggleTabPinned(tabId, pinned?)`

#### Scenario: Create space

- **WHEN** `createSpace` is called with a unique name and color
- **THEN** the background MUST create a new Chrome tab group and a corresponding SpaceState entry
- **AND** `getSpacesSnapshot` MUST include this space in subsequent results

#### Scenario: Move tab to space

- **WHEN** `moveTabToSpace` is invoked for a tabId and spaceId
- **THEN** the tab MUST be moved into the target Chrome tab group
- **AND** the tab MUST be associated with either `spaceBookmarks` or `temporaryTabs` in SpaceState depending on the pinned flag

## MODIFIED Requirements

### Requirement: getSpacesSnapshot SHALL be covered by deterministic unit tests

The system SHALL verify the `getSpacesSnapshot` tab aggregation logic with deterministic unit tests that mock the Chrome API and the Spaces storage layer. These tests SHALL provide fixtures covering grouped, pinned, and ungrouped tabs, and the mapping from `SpaceState[]` to `SpaceSnapshot[]`.

#### Scenario: Groups and pinned tabs

- **WHEN** the test sets up grouped, pinned, and ungrouped tabs and a predefined `SpaceState[]`
- **THEN** `getSpacesSnapshot` classifies each tab into the expected `SpaceSnapshot`
- **AND** the returned snapshots remain sorted by group ID in ascending order

#### Scenario: No tab groups available

- **WHEN** the tabGroups API is mocked to be unavailable or to return an empty array
- **THEN** `getSpacesSnapshot` returns only the `Ungrouped` or default space as defined by the Spaces specification

#### Scenario: Error handling fallback

- **WHEN** the Chrome API mock throws an exception
- **THEN** `getSpacesSnapshot` returns an empty array
- **AND** records a warning log entry
