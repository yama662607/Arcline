## Context

This change simplifies the repository layout by moving the only application package from `apps/extension` to `extension/` at the repository root. The project explicitly does not plan to add more applications under `apps/`, so the existing structure increases path depth and cognitive overhead without providing value.

## Goals / Non-Goals

### Goals

- Reduce path depth and improve navigability (`apps/extension/...` -> `extension/...`).
- Make the primary product (browser extension) obvious from the repository root.
- Preserve current toolchain and workflows (pnpm workspace, justfile, turbo, Playwright, Vite, OpenSpec).
- Preserve Git history for moved files.

### Non-Goals

- Do not change runtime behavior of the extension.
- Do not change package name (`arcline-extension`) or the dependency graph.
- Do not introduce additional applications.

## Decisions

### Decision: Keep monorepo tooling, but move the app directory

- Keep the root tooling (`justfile`, `turbo.json`, `openspec/`, `scripts/`) and pnpm workspace.
- Move only the extension package directory to `extension/`.

### Alternatives considered

- Keep `apps/extension` (status quo): lowest risk but does not meet the simplicity goals.
- Fully flatten to single-package repo (move `src/` etc to repository root): maximizes simplicity but increases collision risk with tooling/docs and causes larger path refactors.

## Migration Plan

1. Create and approve this OpenSpec change.
2. Move directory using `git mv apps/extension extension`.
3. Update workspace definition (`pnpm-workspace.yaml`) and any path-based tooling (`justfile`, CI).
4. Update OpenSpec documentation references (`openspec/project.md`) and affected specs.
5. Validate with `just check` and `just e2e`.

## Rollback Plan

- Roll back using `git revert` of the move commit(s).
- Re-run `just check` and `just e2e` to ensure the repository returns to a green state.

## Risks / Trade-offs

- Tooling that assumes `apps/extension` by path may break (CI scripts, docs, local developer habits).
- Local Chrome extension unpacked-load path changes (`apps/extension/dist` -> `extension/dist`).
- Cache keys (turbo/playwright) may change because paths changed; first run may be slower.

## Open Questions

- Should the now-empty `apps/` directory be removed entirely? (default: remove)
