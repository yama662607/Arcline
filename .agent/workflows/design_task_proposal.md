## Why
The user explicitly requested to replicate the "Arc-like" design aesthetic (colors, animations, layout) and requested a theming system where users can select colors/designs. The current implementation uses basic Tailwind utility classes, but lacks the sophisticated, fluid, and customizable nature of the original Arc (and legacy Arcify) design.

## What Changes
- **Design System Update**: Extend `tailwind.config.ts` with "Arc-like" tokens (colors, gradients, shadows, animations).
- **Theming Engine**: Implement a dynamic theming system using CSS variables and a React context (`ThemeProvider`) to allow runtime switching of themes (e.g., "Space Colors", "Dark/Light Mode").
- **UI Components**: Create reusable, styled components (Buttons, Inputs, Cards) that adhere to the new design system.
- **Layout Refinement**: Update the Sidebar and Floating UI layouts to match the specific "Arc" feel (glassmorphism, padding, rounded corners).

## Impact
- **Specs**: `theme` (New)
- **Code**:
    - `extension/tailwind.config.ts` (Major update)
    - `extension/src/ui/theme/*` (New directory for theme logic)
    - `extension/src/styles.css` (Update global variables)
    - `extension/src/ui/components/*` (Update visuals)
