## Why
The legacy version of Arcify had several critical features (Context Menu, Onboarding, Advanced Shortcuts, Drag & Drop Organization) that are missing in the current Arcline implementation. To provide a complete "Arc-like" experience, these features must be ported and adapted to the new React implementation using modern libraries.

## What Changes
- **Add Sidebar Interactions**: Implement robust Drag & Drop for tabs and spaces using `@dnd-kit`. Replicate the "Space > Folder > Tab" hierarchy.
- **Add Context Menus**: Implement a custom right-click menu for tabs and spaces using `@radix-ui/react-context-menu`.
- **Enhance Command Palette**: Rewrite the Command Palette using `cmdk` to support "New Tab" mode, Web Search, and fuzzy filtering.
- **Add Onboarding Flow**: Create a welcome experience for new users using `framer-motion` for smooth transitions.
- **Add Navigation Shortcuts**: Implement `Next/Prev Tab in Space` keyboard shortcuts.

## Impact
- **Specs**: `context-menu`, `onboarding`, `command-palette`, `navigation`, `sidebar-interaction`
- **Code**:
    - `src/ui/components/context-menu/*` (New)
    - `src/ui/sidebar/*` (Update with dnd-kit)
    - `src/floating/CommandPalette.tsx` (Update with cmdk)
    - `src/background/index.ts` (Update command listeners)
    - `manifest.config.ts` (Update commands)
