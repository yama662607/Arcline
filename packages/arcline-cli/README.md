# Arcline CLI

Arcline 1.0.0 local workspace tools for Node.js 22+. No runtime dependencies or build step.

From the repository root:

```sh
node packages/arcline-cli/bin/arcline.mjs --help
node packages/arcline-cli/bin/arcline.mjs doctor --json
node --test packages/arcline-cli/test/cli.test.mjs
```

The executable package bin is `arcline`. Once the package is installed or linked by your package manager, the examples below work directly. Otherwise replace `arcline` with the Node invocation above. The package also supports `pnpm --dir packages/arcline-cli test`.

```sh
arcline spaces --browser brave --profile Default --json
arcline search 'paper' --browser brave --profile Default --history --limit 20 --json
arcline add-pin --browser brave --profile Default --space Research --url https://example.com --folder Reading --json
arcline export --browser brave --profile Default --out workspace.json --json
arcline import-arc --file /path/to/StorableSidebar.json --out arc-workspace.json --json
arcline open 'quantum physics' --browser chrome --json
arcline open --browser brave --json
```

Use `--bookmarks /path/to/Bookmarks` for custom locations or copied profiles. Standard macOS, Linux (including Chromium Snap/Flatpak) and Windows paths are discovered automatically; Arc Windows package directories are supported. Profile selection prefers existing Arcline roots and rejects multiple matches. `--profile` takes a directory name, not a display name.

JSON success output is `{ok:true,command,data,warnings}`. Failure output is `{ok:false,command,error:{code,message},warnings}` with exit status 1. Export and import commands without `--json` print the portable document; with `--json`, it is in `data`. `--out` writes just the document, adds an `out` field to JSON responses, and refuses to overwrite any existing file. Output and backup files use private permissions.

Portable documents contain `format: "arcline"`, `version: "1.0.0"`, `favorites`, `spaces`, and `stats`. Each Space has `name` and `pinned`; nodes have `kind: "pin"`, `title`, `url`, or `kind: "folder"`, `title`, `children`. Arc import also retains available Space icons and reports skipped items. It handles Arc's interleaved ID/object arrays and cyclic references. It cleans empty folders, duplicates within a Space, unsafe URLs, broken mobile file paths and Google search tabs. It does not write imported data to a browser. Themes, extension-local settings, and temporary tabs are outside this format.

Search is a literal substring match over titles, URLs, Space names and folder paths. Results contain bookmarks first, then history from the last 30 days ordered newest first, with one combined limit. History uses a stable temporary copy of the database and WAL, never a SQLite connection to the live database. A changing file or active rollback journal causes a retryable diagnostic. If history is unavailable, bookmark results still return, with `data.history.searched: false` and a warning. Early Node.js 22 installations without built-in SQLite require a `sqlite3` executable supporting `-json`. History's SQLite lowercase matching is ASCII case-insensitive; bookmark matching also supports Unicode lowercase.

Quit the browser before `add-pin`. The command refuses to write when a browser process is running or its status is unknown, unless `--force` is explicitly given. Detection is conservative across profiles. Writes use a CLI lock, unique backup, checksums, flushed temporary file, concurrent-content check, and atomic rename. A browser starting or writing after that final check can still overwrite edits; `--force` cannot prevent this. Restore the returned backup with the browser closed if needed. Pins are added to existing Spaces; folder paths can create folders, and repeat calls can create duplicate pins. Exported bookmarklets remain data; writes and launches reject executable URL schemes.

`open` starts Brave or Chrome with literal arguments and no shell. Without a query it opens the browser's New Tab page and honors any installed override. The current extension exposes no external Command Bar activation endpoint; use its configured shortcut for that UI. macOS uses Launch Services; Linux uses browser executables on PATH; Windows checks standard application locations. Platform launch plans and discovery paths are unit tested; native browser launches are not exercised by the tests.

`doctor` reports profiles, the Arcline bookmark root, Arc sidebar availability and repository-relative `extension/dist` files. Build readiness is a file/manifest check, not proof that the extension is loaded. A standalone installed package may not have the sibling extension directory.

The dedicated agent instructions are in `skills/arcline/SKILL.md` at the repository root and mirrored to the user's local skill directory. Fixtures are synthetic; tests never edit real browser data or open browser windows.
