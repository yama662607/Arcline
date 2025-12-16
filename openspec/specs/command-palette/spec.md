# command-palette Specification

## Purpose
TBD - created by archiving change integrate-legacy-features. Update Purpose after archive.
## Requirements
### Requirement: Tech Stack
The Command Palette SHALL be implemented using the `cmdk` library for unstyled, accessible, and composable command menu components.

#### Scenario: Library Check
- **WHEN** reviewing `CommandPalette.tsx`
- **THEN** `cmdk` components (`Command`, `Command.Input`, `Command.List`) are used

### Requirement: Web Search Integration
The Command Palette SHALL support web searching when the input does not match any open tabs or bookmarks.

#### Scenario: Search Fallback
- **WHEN** user types "unknown query"
- **THEN** a "Search Web for 'unknown query'" option appears

### Requirement: New Tab Mode
The Command Palette SHALL support a "New Tab" mode.

#### Scenario: Activation
- **WHEN** activated via specific shortcut
- **THEN** `Command.Input` placeholder changes
- **AND** generic searches default to opening in a new tab

