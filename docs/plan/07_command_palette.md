# Phase 5: Command Palette Implementation

## Objective
Implement a centralized, "Spotlight-style" Command Palette to provide keyboard-centric navigation and control, emulating the Arc browser experience (Cmd+T / Cmd+L). This feature will act as the primary interface for searching tabs, history, and executing browser commands.

## Key Features

1.  **Unified Search Interface**:
    *   Search across **Open Tabs** (Navigate).
    *   Search **Pinned Items** (Navigate).
    *   Search **Browsing History** (Open).
    *   Search **Bookmarks** (Open).
    *   Direct URL entry (Navigation).

2.  **Action Execution**:
    *   "New Tab"
    *   "New Space" / "Switch Space"
    *   "Split View" (Future)
    *   "Archive Tab" / "Close Tab"
    *   "Pin Tab"

3.  **UI/UX**:
    *   Centered floating modal.
    *   Glassmorphism design (matching Sidebar).
    *   Keyboard navigation (Arrow keys, Enter, Esc).
    *   Global keyboard shortcut activation (Default: `Cmd+Shift+K` or `Cmd+E` since `Cmd+T` is reserved by Chrome unless replaced).

## Technical Architecture

1.  **Library Selection**:
    *   **UI**: `cmdk` (Radix UI based) is recommended for accessibility and composability.
    *   **Fuzzy Search**: `fuse.js` or `command-score` for high-performance client-side filtering.

2.  **Component Structure**:
    *   `src/floating/CommandPalette.tsx`: Main component using `cmdk`.
    *   `src/floating/mount.tsx`: Update to support a "Command Palette Mode" (overlaying the page properly, distinct from Sidebar).

3.  **State Management**:
    *   `useCommandStore`: Zustand store to manage visibility and query state.
    *   `useSearchIndex`: Hook to aggregate data from `tabs`, `bookmarks`, `history` efficiently.

## Implementation Steps

### Step 1: Infrastructure & Dependencies
*   Install `cmdk` and `fuse.js`.
*   Update `manifest.json` to register a global command (e.g., `_execute_action` or custom shortcut) if needed, or rely on Content Script key listener for in-page injection.

### Step 2: Data Aggregation Hook
*   Create `useUniversalSearch()` hook.
*   Combine `spaces` (tabs), `chrome.history`, `chrome.bookmarks` into a normalized `SearchResult` format.
*   Implement async filtering.

### Step 3: Command Palette UI
*   Create `CommandPalette` component using `cmdk`.
*   Style with Tailwind to match Arcline aesthetic (Dark mode, transparent borders).

### Step 4: Integration with Floating Mount
*   Modify `FloatingUiroot` in `mount.tsx`.
*   Add visual state for "Command Palette Open" vs "Sidebar Open".
*   Ensure focus management trap (critical for keyboard users).

### Step 5: Action Handlers
*   Implement handlers for `onSelect`:
    *   If Tab: `activateTab(id)`.
    *   If URL: `window.location.href = url` (or `chrome.tabs.create`).
    *   If Command: Execute function (e.g., toggle pinned).

## Success Metrics
*   Palette opens instantly on shortcut.
*   Search results appear within <100ms.
*   Keyboard navigation is glitch-free.
