# Background Services Specification

## Requirements

### Requirement: getSpacesSnapshot SHALL be covered by deterministic unit tests
The system SHALL verify the `getSpacesSnapshot` tab aggregation logic with deterministic unit tests that mock the Chrome API. These tests SHALL provide fixtures covering grouped, pinned, and ungrouped tabs.

#### Scenario: Groups and pinned tabs
- **WHEN** the test sets up grouped, pinned, and ungrouped tabs
- **THEN** `getSpacesSnapshot` classifies each tab into the expected `SpaceSnapshot`
- **AND** the returned snapshots remain sorted by group ID in ascending order

#### Scenario: No tab groups available
- **WHEN** the tabGroups API is mocked to be unavailable or to return an empty array
- **THEN** `getSpacesSnapshot` returns only the `Ungrouped` space
- **AND** the behavior matches the expected fallback in environments without tab groups

#### Scenario: Error handling fallback
- **WHEN** the Chrome API mock throws an exception
- **THEN** `getSpacesSnapshot` returns an empty array and records a warning log entry
