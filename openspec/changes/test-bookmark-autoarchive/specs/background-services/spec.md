## ADDED Requirements

### Requirement: ブックマーク同期機能 SHALL be covered by comprehensive unit tests
The system SHALL verify the bookmark synchronization functionality with unit tests that mock the Chrome bookmarks API. These tests SHALL cover folder creation, space synchronization, and duplicate handling.

#### Scenario: Arcify folder creation
- **WHEN** getOrCreateArcifyFolder is called with no existing Arcline folder
- **THEN** it creates a new "Arcline" folder in the bookmarks bar
- **AND** returns the created folder object

#### Scenario: Space folder synchronization
- **WHEN** syncSpaceToBookmarks is called with space name and tabs
- **THEN** it creates or updates the space folder with current tabs
- **AND** removes outdated bookmarks
- **AND** adds new bookmarks for current tabs

#### Scenario: Duplicate folder merging
- **WHEN** multiple folders with the same space name exist
- **THEN** mergeDuplicateSpaceFolders combines all bookmarks
- **AND** removes duplicate folders
- **AND** preserves the most recent folder

### Requirement: 自動アーカイブ機能 SHALL be covered by comprehensive unit tests
The system SHALL verify the auto-archive functionality with unit tests that mock the Chrome alarms and tabs APIs. These tests SHALL cover alarm setup, tab activity tracking, and archive logic.

#### Scenario: Auto-archive alarm setup
- **WHEN** setupAutoArchiveAlarm is called with enabled=true and idleMinutes=30
- **THEN** it creates a repeating alarm with 30-minute intervals
- **AND** clears any existing auto-archive alarms

#### Scenario: Inactive tab archiving
- **WHEN** archiveInactiveTabs is called with tabs inactive for 30 minutes
- **THEN** it archives eligible inactive tabs
- **AND** excludes pinned, active, and audible tabs
- **AND** updates tab activity tracking

#### Scenario: Tab activity tracking
- **WHEN** a tab becomes active or updated
- **THEN** updateTabLastActivity records the current timestamp
- **AND** the activity is stored for auto-archive decisions

### Requirement: 統合テスト SHALL verify end-to-end functionality
The system SHALL provide integration tests that verify the complete workflow from space creation through bookmark synchronization to auto-archive behavior.

#### Scenario: Space creation to bookmark sync
- **WHEN** a new space is created with tabs
- **THEN** createSpace calls syncSpaceToBookmarks
- **AND** bookmarks are created in the correct folder structure
- **AND** the sync status is updated

#### Scenario: Settings change to auto-archive behavior
- **WHEN** auto-archive settings are changed via options UI
- **THEN** the alarm is updated with new settings
- **AND** auto-archive behavior reflects the new configuration

#### Scenario: Error handling and recovery
- **WHEN** Chrome API calls fail during bookmark operations
- **THEN** appropriate error messages are logged
- **AND** the system continues functioning with degraded capabilities
