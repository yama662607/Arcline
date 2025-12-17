## Why
To replicate the "Arc-like" premium feel and allow user customization, we need a robust theming and animation strategy. The legacy extension used raw CSS, but the new version will leverage modern React ecosystems.

## What Changes
- **Design System Update**: Extend `tailwind.config.ts` with "Arc-like" tokens.
- **Theming Engine**: Implement dynamic theming using **CSS Variables** managed by a `ThemeContext`. This allows runtime color switching without Tailwind recompilation.
- **Animations**: Use **`framer-motion`** for all complex interactions (Sidebar collapse, Tab hover, Page transitions) to ensure 60fps smooth animations.

## Impact
- **Specs**: `theme`
- **Code**:
    - `extension/tailwind.config.ts`
    - `extension/src/ui/theme/*`
    - `extension/src/styles.css`
    - `extension/src/ui/components/*`
