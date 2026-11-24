# Arcline — Release & Chrome Web Store Publishing Guide (`1.0.0`)

## 1. Pre-Release Quality Gate

Run all automated quality gates before packaging or tagging a release:

```bash
just check            # Biome format/lint + TypeScript strict typecheck + Vitest unit & engine tests
just build            # Production Manifest V3 bundle -> extension/dist/
just check-extension  # Real-browser chrome.developerPrivate 0-error diagnostics + 2x live reload
just e2e              # Real-browser Playwright E2E test suite (14 scenarios)
just package          # Validates manifest/icons/IIFE and builds release/arcline-1.0.0-cws.zip
```

## 2. Chrome Web Store Submission

1. Run `just package` to generate the clean submission archive at `release/arcline-1.0.0-cws.zip`.
   - `extension/scripts/package-cws.mjs` verifies that `manifest_version` is `3`, `description` is `<= 132` characters, all icon sizes exist, `overlay.js` is a pure IIFE with zero ES `import`/`export` statements, and no sourcemaps or dev files are included.
2. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. Upload `release/arcline-1.0.0-cws.zip`.
4. Copy the store listing text, single-purpose statement, permission justifications, privacy disclosures, and screenshot captions directly from [CHROMEWEBSTORE.md](../CHROMEWEBSTORE.md).
5. Set the Privacy Policy URL to `https://github.com/yama662607/Arcline/blob/main/PRIVACY.md` (or your GitHub Pages equivalent).

## 3. GitHub Release (`1.0.0`)

1. Ensure `main` is up to date and GitHub Actions CI is green.
2. Tag and push `1.0.0`:
   ```bash
   git tag 1.0.0
   git push origin main --tags
   ```
3. Attach `release/arcline-1.0.0-cws.zip` to the GitHub Release so users who prefer unpacked / manual installation can download the prebuilt bundle directly.

## 4. Support & Issue Tracking

- GitHub Repository: https://github.com/yama662607/Arcline
- Issue Tracker: https://github.com/yama662607/Arcline/issues
