## Why
The legacy version of Arcify had several critical features (Context Menu, Onboarding, Advanced Shortcuts) that are missing in the current Arcline implementation. To provide a complete "Arc-like" experience, these features must be ported and adapted to the new React/Tailwind architecture.

## What Changes
- **Add Context Menus**: Implement a custom right-click menu for tabs and spaces using Radix UI, supporting Pin/Unpin, Move to Space, and Rename.
- **Add Onboarding Flow**: Create a welcome experience for new users to explain the extension's features.
- **Enhance Command Palette**: Add support for Web Search and "New Tab" vs "Current Tab" context modes.
- **Add Navigation Shortcuts**: Implement `Next/Prev Tab in Space` keyboard shortcuts.

## Impact
- **Specs**: `context-menu`, `onboarding`, `command-palette`, `navigation`
- **Code**:
    - `src/ui/components/context-menu/*` (New)
    - `src/ui/onboarding/*` (New)
    - `src/floating/CommandPalette.tsx` (Update)
    - `src/background/index.ts` (Update command listeners)
    - `manifest.config.ts` (Update commands)
