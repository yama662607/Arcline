# Design: Playwright Chrome Extension Fixtures

## Goals
1. **Deterministic storage state** before any `page.goto` so that content scripts always read `UI_MODE_KEY=floating` (or another desired mode) when initializing.
2. **Web-first interaction helpers** that hide Shadow DOM traversal details and ensure Playwright auto-waiting + actionability.
3. **Observability hooks** (service worker console/crash + trace artifacts) with minimal overhead and opt-in debug verbosity.
4. **Composable fixtures** so future specs (TanStack Query sync, fallback UI) can reuse the setup without duplicating boilerplate.

## Fixture Topology
```
apps/extension/playwright/
├── fixtures.ts (shared by all tests)
├── fixtures/extension.ts (new helper that:
│   - launches persistent context
│   - ensures dist/ exists
│   - waits for service worker and exposes helper APIs
│   - injects deterministic storage state & clears leftovers
│   - wires console/crash listeners)
├── helpers/locators.ts (Shadow DOM aware locators)
└── e2e/*.spec.ts
```
- The base `test` exported from `../fixtures` will be extended with a custom `extension` fixture providing:
  - `ensureFloatingMode(): Promise<void>` to set `chrome.storage.local` via `serviceWorker.evaluate`.
  - `openExtensionPage(path)` to reuse `chrome-extension://<id>/...` URLs while guaranteeing state.
  - `logServiceWorker(message)` sink that prefixes `[SW]` for CLI/CI readability.

## Deterministic State Flow
1. `test.beforeEach(async ({ extension }) => await extension.resetUiMode('floating'))`.
2. Reset uses `context.serviceWorkers()`; if empty, waits for `'serviceworker'` event.
3. Once worker handle is available, run `await serviceWorker.evaluate(({ key, value }) => chrome.storage.local.set({ [key]: value }), { key: 'UI_MODE_KEY', value: 'floating' });`.
4. Optionally clear other keys (localStorage, caches) via `context.clearCookies()` and `page.addInitScript` for data islands.

## Locator & Assertion Helpers
- Provide `getFloatingRoot(page)` and `getByTestId(page, id)` wrappers that automatically pierce open Shadow DOM, optionally using `testIdAttribute = 'data-testid'` in `playwright.config.ts`.
- Replace manual `dispatchEvent` with `await page.getByTestId('arcline-floating-hotzone').hover()` and `await expect(page.getByTestId('arcline-floating-panel')).toBeVisible()`.

## Observability
- After retrieving worker handle, attach listeners:
  ```ts
  serviceWorker.on('console', (msg) => test.info().annotations.push({ type: 'sw-log', description: `${msg.type()} ${msg.text()}` }));
  serviceWorker.on('crash', () => test.info().annotations.push({ type: 'sw-crash', description: 'Service worker crashed' }));
  ```
- Configure `use.trace = process.env.CI ? 'retain-on-failure' : 'on'` and always call `test.info().attach('trace', { path })` when produced.
- Extend docs with instructions to run `npx playwright show-trace` against artifacts.

## Alternatives Considered
- **Mocking `chrome.runtime.sendMessage` via `page.addInitScript`:** Powerful but hides bugs in service worker logic. Kept as last-resort fallback documented in spec.
- **Global setup script** to seed storage: rejected because service worker lifetime is tied to context; doing it per test ensures isolation.
- **New Playwright project per UI mode**: adds duplication; instead we parameterize fixture methods so tests can opt into other modes when needed.
