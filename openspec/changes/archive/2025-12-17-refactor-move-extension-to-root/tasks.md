## 1. Proposal Approval Gate

- 1.1 Review `proposal.md` / `design.md` / spec deltas
- 1.2 Approve the change before implementation begins

## 2. Implementation

- 2.1 Inventory path dependencies
  - `rg -n "apps/extension" .` and list every hit (code/config/docs/spec)
  - Identify scripts that reference `../scripts/*` from the extension package (relative path behavior changes after move)
- 2.2 Move the package directory with history preserved
  - `git mv apps/extension extension`
  - If `apps/` becomes empty, remove it (or replace with minimal placeholder only if needed)
- 2.3 Update workspace definitions
  - Update `pnpm-workspace.yaml` to include `extension` and remove `apps/*`
  - Confirm `pnpm -w install` still resolves `arcline-extension`
- 2.4 Update root tooling
  - Update `justfile` paths (e.g. `clean` targets)
  - Update root `package.json` scripts only if they contain path assumptions (filters should continue to work)
  - Update `turbo.json` only if any path-based outputs or task references break
- 2.5 Update CI (if present)
  - Update GitHub Actions workflow paths from `apps/extension/...` to `extension/...`
- 2.6 Update OpenSpec docs
  - Update `openspec/project.md` references from `apps/extension/...` to `extension/...`
  - Ensure spec deltas cover any path requirements (e.g. `extension-shell`)

## 3. Verification

- 3.1 Run quality gates
  - `just check`
  - `just e2e`
- 3.2 Validate OpenSpec
  - `pnpm openspec validate refactor-move-extension-to-root --strict`
- 3.3 Manual smoke test
  - Load unpacked extension from `extension/dist` in `chrome://extensions`
  - Open popup and confirm UI renders

## 4. Rollback

- 4.1 If any critical breakage is found, rollback via `git revert` of the move commits
- 4.2 Re-run `just check` and `just e2e` after rollback
