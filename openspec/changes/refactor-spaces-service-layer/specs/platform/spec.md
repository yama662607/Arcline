## MODIFIED Requirements

### Requirement: Legacy 機能の再実装

The extension MUST reintroduce Arcify's core behaviors (tab context menu, bookmark synchronization, auto-archive, and space-based tab grouping) using the new architecture.

#### Scenario: Spaces as tab-group backed entities

- **WHEN** the user creates, renames, or deletes a space via the React UI
- **THEN** the extension MUST create, update, or remove the corresponding Chrome tab group and SpaceState entry
- **AND** `getSpacesSnapshot` MUST reflect the change within a bounded time frame

#### Scenario: Space-aware tab context menu

- **WHEN** the user uses the tab context menu to move a tab between spaces
- **THEN** the UI MUST send a background request to move the tab between tab groups
- **AND** the background MUST update SpaceState and broadcast an updated spaces snapshot so the UI stays in sync

#### Scenario: Bookmark synchronization for pinned tabs

- **WHEN** the user pins or unpins a tab within a space
- **THEN** the extension MUST update the corresponding Arcify bookmark folder to reflect the pinned state
- **AND** duplicate folders under the Arcify root MUST be merged to maintain a single source of truth
