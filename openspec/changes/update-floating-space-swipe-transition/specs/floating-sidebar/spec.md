## ADDED Requirements

### Requirement: Floating space swipe navigation SHALL lock intent and commit on release
The system SHALL treat the initial swipe vector as the gesture intent and ignore orthogonal motion until the gesture ends. Navigation MUST commit on input release, and each gesture MUST move at most one adjacent space.

#### Scenario: Horizontal intent lock
- **WHEN** the first meaningful swipe vector is horizontal
- **THEN** the gesture is locked to horizontal navigation
- **AND** vertical deltas are ignored for the remainder of the gesture

#### Scenario: Vertical intent lock
- **WHEN** the first meaningful swipe vector is vertical
- **THEN** the gesture is locked to vertical scrolling
- **AND** horizontal deltas are ignored for the remainder of the gesture

#### Scenario: Commit rules on release
- **WHEN** the gesture is horizontal and the user releases input
- **THEN** navigation commits to the adjacent space in the swipe direction if release velocity is non-zero
- **AND** if release velocity is zero, navigation commits only when progress reaches at least 50% of the content width

#### Scenario: Single-space movement
- **WHEN** a horizontal swipe is committed
- **THEN** the active space moves at most one position in the direction of the swipe

### Requirement: Floating space transition SHALL appear continuous across tabs
The floating UI SHALL present a continuous-looking transition even when the underlying tab changes.

#### Scenario: Stop-and-release continuation
- **WHEN** the user stops mid-swipe and releases with zero velocity
- **THEN** the tab switch happens immediately
- **AND** the destination floating UI continues the remaining animation from the captured progress

#### Scenario: Flick completion before switch
- **WHEN** the user performs a flick with non-zero release velocity
- **THEN** the current tab completes the full page-turn animation
- **AND** the tab switch happens only after the animation completes

#### Scenario: Bottom space bar switch
- **WHEN** the user selects a space from the bottom space bar
- **THEN** the same full animation completes before switching tabs

### Requirement: Transition scope SHALL be limited to the workspace content
The floating UI transition SHALL move only the workspace content area and keep global UI elements fixed.

#### Scenario: Fixed and moving regions
- **WHEN** a space transition animation runs
- **THEN** the moving region includes the Space Header, pinned list, temporary list, and New Tab button
- **AND** the Search Bar, Favorites Bar, and Bottom Space Bar remain fixed
