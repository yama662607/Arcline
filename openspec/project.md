# Project Context

## Purpose
Arcline is a Chrome extension that recreates Arc Browser's vertical tab "spaces" for Chromium-based browsers. It provides a side panel UI and floating UI to organize tabs into named spaces, pin frequently used pages, archive idle tabs automatically, and deliver a modern vertical tab management experience.

## Tech Stack
- Chrome Extension (Manifest V3) targeting modern Chromium browsers (Chrome 116+, Atlas, Arc, Edge, Brave)
- React 19 + TypeScript for all UI components
- Vite 7 for bundling with `@crxjs/vite-plugin` for extension development
- Zustand for client state management
- TanStack Query for server state and data synchronization with Service Worker
- Tailwind CSS 4 for styling with Radix UI and shadcn/ui components
- React Hook Form + Zod for form validation
- Framer Motion for animations and transitions
- pnpm workspace monorepo structure

## Project Conventions

### Code Style
- TypeScript with strict mode enabled
- React functional components with hooks (no class components)
- ES module syntax with named exports
- Biome for linting and formatting (replaces ESLint/Prettier)
- Prefer `const`/`let`, arrow functions, and async/await
- Two-space indentation (Biome default)
- Tailwind CSS for styling (utility-first approach)

### Architecture Patterns
- **Service Worker** (`apps/extension/src/background/`): Manifest V3 service worker that manages Chrome APIs, messaging, and auto-archive alarms
  - `background/index.ts`: Main entry point, handles commands, messaging, UI mode detection
  - `background/services/browser.ts`: Chrome API wrappers (tabs, tabGroups, bookmarks, storage)
- **React UI** (`apps/extension/src/ui/`): Main vertical tab UI with components
  - Entry points: `main.tsx` (side panel), `popup/index.tsx` (popup), `options/index.tsx` (options page)
  - Components in `ui/components/`: TabList, SpaceManager, SettingsPanel, ArchiveManager, etc.
  - All components use Tailwind CSS and shadcn/ui
- **Floating UI** (`apps/extension/src/floating/`): Content script-based floating sidebar for Atlas
  - `floating/mount.tsx`: Shadow DOM mounting and hotzone interaction
  - `floating/FloatingApp.tsx`: React app rendered in floating panel
- **State Management**:
  - Zustand store (`src/store/`): Client-side state (spaces, settings)
  - TanStack Query (`src/hooks/use-spaces-query.ts`): Data fetching and synchronization
  - Service Worker Bridge (`src/lib/service-worker-bridge.ts`): Communication layer
- **Styling**: Tailwind CSS with custom configuration, Radix UI primitives, shadcn/ui components

### Testing Strategy
- **Unit Tests**: Vitest with React Testing Library for component and logic tests
  - Located in `src/**/*.test.ts` and `src/**/*.spec.ts`
  - Chrome API mocking with `vi.fn()`
  - Run with `pnpm test` or `pnpm test:watch`
- **E2E Tests**: Playwright for browser extension testing
  - Located in `playwright/e2e/*.spec.ts`
  - Tests floating UI, popup, and core interactions
  - Run with `pnpm test:e2e`
- **Manual Testing**: Accessibility verification, browser compatibility testing
  - Documented in `docs/TESTING.md`
  - Keyboard navigation, screen reader testing
  - Multi-browser testing (Chrome, Atlas, Arc, Edge, Brave)
- **CI/CD**: GitHub Actions runs lint, typecheck, unit tests, build, and E2E tests on every push

### Git Workflow
- Feature work follows OpenSpec workflow: proposal → implementation → archive
- Commits follow Conventional Commits format in Japanese (e.g., `feat: タブ検索機能を追加`)
- Changes are validated with `pnpm openspec validate <change-id> --strict`
- Pull requests require passing CI (lint, typecheck, tests)
- Release process documented in `docs/RELEASE.md`

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

### Runtime Dependencies
- React 19 + React DOM: UI framework
- Zustand: Client state management
- TanStack Query: Data fetching and synchronization
- TanStack Virtual: Virtual scrolling for large tab lists
- Framer Motion: Animations and transitions
- Radix UI: Accessible UI primitives
- React Hook Form + Zod: Form validation
- Tailwind CSS: Utility-first styling
- clsx + tailwind-merge: Class name utilities

### Development Dependencies
- TypeScript: Type safety
- Vite + @crxjs/vite-plugin: Build tool and extension development
- Vitest + React Testing Library: Unit testing
- Playwright: E2E testing
- Biome: Linting and formatting
- pnpm: Package manager
- Turbo: Monorepo task runner

### Chrome Extension APIs
- tabs, tabGroups, bookmarks, storage, sidePanel, alarms, commands, runtime, windows
