# Contributing to Arcline

Thank you for your interest in contributing to Arcline!

## Principles

1. **Zero webpage overhead**: Do not add `<all_urls>` content scripts or heavy runtime dependencies.
2. **Pure core, central writer**: Keep domain derivation and parsers pure under `extension/src/core/` (zero `chrome.*` imports). Route all Chrome mutations through `Engine`'s `SerialQueue` in `extension/src/background/engine.ts`.
3. **Bookmarks as source of truth**: Persistent user data (Favorites, Spaces, Pinned tabs, Folders) lives in `chrome.bookmarks` so uninstalls or browser restarts never lose links.

## Workflow

1. Create a dedicated branch (`feature/<topic>` or `fix/<topic>`).
2. Run quality gates before opening a PR:
   ```bash
   just fix
   just check
   just build
   ```
3. Add unit tests under `extension/src/core/tests/` for pure logic and integration tests in `extension/src/background/engine.test.ts` for new engine commands.
4. Use [Conventional Commits](https://www.conventionalcommits.org/).
