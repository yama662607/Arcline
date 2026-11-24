## 1. Context Menu Implementation
- [x] 1.1 Install `@radix-ui/react-context-menu`: `npm install @radix-ui/react-context-menu`.
- [x] 1.2 Create `ContextMenu` wrapper components in `src/ui/components/context-menu`.
- [x] 1.3 Implement `TabContextMenu` with actions (Pin, Archive, Move).
- [x] 1.4 Implement `SpaceContextMenu`.

## 2. Sidebar Drag & Drop (`dnd-kit`)
- [x] 2.1 Set up `DndContext` in `SpacesWorkspace`.
- [x] 2.2 Create `SortableTabRow` wrapper.
- [x] 2.3 Integrate `SortableContext` into `EnhancedTabList`.
- [x] 2.4 Implement reordering logic (mutations) for Pinned/Temporary tabs and moving between folders.

## 3. Navigation & Onboarding
- [x] 3.1 Implement `NextTabInSpace` logic in background.
- [x] 3.2 Create `Onboarding` flow using `framer-motion` for slide transitions.
