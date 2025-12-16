## 1. Context Menu Implementation
- [ ] 1.1 Install `@radix-ui/react-context-menu`: `npm install @radix-ui/react-context-menu`.
- [ ] 1.2 Create `ContextMenu` wrapper components in `src/ui/components/context-menu`.
- [ ] 1.3 Implement `TabContextMenu` with actions (Pin, Archive, Move).
- [ ] 1.4 Implement `SpaceContextMenu`.

## 2. Command Palette Enhancements (`cmdk`)
- [ ] 2.1 Refactor `src/floating/CommandPalette.tsx` to use `cmdk` components.
- [ ] 2.2 Implement "New Tab" mode state and placeholder logic.
- [ ] 2.3 Implement Web Search fallback item in `Command.List`.

## 3. Sidebar Drag & Drop (`dnd-kit`)
- [ ] 3.1 Setup `DndContext` in `Sidebar` root.
- [ ] 3.2 Wrap tab lists in `SortableContext`.
- [ ] 3.3 Implement `onDragEnd` logic to handle reordering and moving between folders.

## 4. Navigation & Onboarding
- [ ] 4.1 Implement `NextTabInSpace` logic in background.
- [ ] 4.2 Create `Onboarding` flow using `framer-motion` for slide transitions.
