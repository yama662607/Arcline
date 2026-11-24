# sidebar-interaction Specification

## Purpose
TBD - created by archiving change integrate-legacy-features. Update Purpose after archive.
## Requirements
### Requirement: Tech Stack
The implementation SHALL use `@dnd-kit` for all drag-and-drop interactions.
- Use `SortableContext` for tab lists.
- Use `useDraggable`/`useDroppable` for complex cross-container movements if necessary.
- Ensure accessible keyboard support.

#### Scenario: Developer Usage
- **WHEN** reviewing the codebase
- **THEN** imports from `@dnd-kit/core` and `@dnd-kit/sortable` are found
- **AND** no usage of `react-beautiful-dnd` or native HTML5 drag events

### Requirement: Drag and Drop Organization
The sidebar SHALL allow users to reorder tabs and move them between folders/spaces using Drag and Drop.

#### Scenario: Reorder Tabs
- **WHEN** user drags a tab within the same list
- **THEN** other items shift to make room (visual feedback)
- **WHEN** dropped
- **THEN** the new order is persisted

#### Scenario: Drag to Folder
- **WHEN** user drags a tab over a Folder
- **THEN** the folder highlights
- **WHEN** dropped
- **THEN** the tab is moved inside the folder

