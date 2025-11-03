# Project Context

## Purpose
Arcify is a Chrome extension that recreates Arc Browser's vertical tab "spaces" for Chromium-based browsers. It provides a side panel UI to organize tabs into named spaces, pin frequently used pages, archive idle tabs automatically, and surface onboarding/help content for new users.

## Tech Stack
- Chrome Extension (Manifest V3) targeting modern Chromium browsers
- JavaScript (ES2020) modules with async/await, no framework or TypeScript
- Vite 6 for bundling with a custom plugin plus `vite-plugin-web-extension`
- Vanilla HTML/CSS for the sidebar, options, and onboarding surfaces
- Node-based tooling scripts using `fs-extra`, `archiver`, and the npm release workflow

## Project Conventions

### Code Style
- ES module syntax with named exports (e.g., `export function`, `export const`)
- Prefer `const`/`let`, arrow functions, and async/await wrappers around Chrome callback APIs
- Four-space indentation; trailing semicolons kept for consistency; abundant `console.log` tracing for diagnostics
- DOM nodes accessed via IDs/templates defined in HTML; dataset attributes (`data-`) used for tab IDs and states

### Architecture Patterns
- `background.js` runs as the Manifest V3 service worker: registers commands/context menus, manages messaging, and drives the auto-archive alarm loop
- `sidebar.js` owns the side panel experience: maintains in-memory `spaces` state, orchestrates Chrome tab/group events, and delegates UI updates
- `domManager.js` encapsulates DOM mutations (space activation, context menus, archived tab popup, quick pin listener wiring)
- `utils.js` centralizes shared behaviors (bookmark syncing, archived tab persistence with a 100 item cap, tab name overrides, settings access)
- `localstorage.js` manages the bookmark folder hierarchy under a top-level `Arcify` folder, including duplicate-folder merge logic
- `chromeHelper.js` provides small async wrappers for opening tabs and grouping them; `icons.js` hosts inline SVG assets
- `options.html/js` and `onboarding.html/js` reuse `utils.js` for settings and keep supporting views modular

### Testing Strategy
- No automated test harness today; validation happens manually by running `npm run dev`, loading `dist-dev/` via `chrome://extensions`, and exercising flows in DevTools
- Release readiness is verified by the build + zip scripts (`npm run build`, `npm run build:zip`) and manual smoke tests in Chrome

### Git Workflow
- Feature work typically lives on topic branches (e.g., `feature/<name>`) and is merged after manual validation
- Versioning is automated through `npm run release <patch|minor|major|x.y.z>` which bumps `package.json` and `manifest.json`, runs the build, produces a zip, commits, tags, and pushes
- GitHub Actions (triggered by tags) publish releases; contributors follow the README guideline of meaningful commit messages and documentation updates

## Domain Context
- Spaces map directly to Chrome tab groups; each space tracks pinned (`spaceBookmarks`) versus temporary tabs and remembers the last active tab
- Pinned tabs synchronize with browser bookmarks inside an `Arcify/<Space>` folder; bookmark titles can override tab titles
- Keyboard shortcuts (default `Ctrl/Command+E` for the side panel, `Ctrl/Command+D` for Quick Pin) and context menus integrate with Chrome commands messaging
- Automatic tab archiving respects per-space bookmarks, ignores audible/active tabs, and stores archived entries with timestamps for later restoration
- Assets (GIF screenshots, icons) support onboarding and marketing surfaces embedded in the extension

## Important Constraints
- Must adhere to Manifest V3 constraints: background logic runs in the service worker, APIs are asynchronous, and HMR is disabled for extension builds
- Requires the declared Chrome permissions (`tabs`, `tabGroups`, `sidePanel`, `storage`, `bookmarks`, `alarms`, `commands`, `favicon`); features assume these permissions are granted
- Archived tab storage is capped at 100 entries to avoid unbounded `chrome.storage.local` growth
- Bookmark operations assume the `Arcify` root folder exists; duplicate spaces are merged via `LocalStorage.mergeDuplicateSpaceFolders`
- Build output keeps deterministic filenames (no hashes for main scripts/CSS) to satisfy Chrome extension loading rules

## External Dependencies
- Chrome Extension APIs (tabs, tabGroups, bookmarks, storage, sidePanel, alarms, commands, favicon retrieval)
- npm dev dependencies: `vite`, `vite-plugin-web-extension`, `fs-extra`, `archiver`
- Node.js runtime for developer tooling (`scripts/release.js`, `scripts/zip.js`, `scripts/build-info.js`), and GitHub Actions for automated release packaging
