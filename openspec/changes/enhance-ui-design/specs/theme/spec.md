## ADDED Requirements
### Requirement: Dynamic Theme Support (CSS Variables)
The system SHALL use CSS variables for all theme-dependent colors.

#### Scenario: Variable Definition
- **WHEN** inspecting `styles.css`
- **THEN** variables like `--theme-primary` are defined
- **AND** `tailwind.config.ts` references these variables

### Requirement: Animations (Framer Motion)
The system SHALL use `framer-motion` for UI transitions.

#### Scenario: Sidebar Collapse
- **WHEN** sidebar is toggled
- **THEN** use `<AnimatePresence>` and `motion.div` to smoothly animate width and opacity.
- **AND** use specific easings (e.g., `easeOutCirc`) for a premium feel.

#### Scenario: Tab Hover
- **WHEN** hovering a tab
- **THEN** use `whileHover` prop to scale element slightly (e.g., 1.02) and adjust background.
