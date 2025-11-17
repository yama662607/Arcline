## ADDED Requirements

### Requirement: Broadcasts UI mode to all controlled tabs

The background service SHALL broadcast the active `UiMode` to every tab controlled by the extension whenever the mode changes or is requested.

#### Scenario: Successful broadcast to multiple tabs

- **WHEN** `applyUiMode` updates the mode to `floating`
- **THEN** `broadcastUiMode` queries all tabs and sends `{ command: 'currentUiMode', mode: 'floating' }`
- **AND** tabs acknowledge the message without surfacing runtime errors

#### Scenario: Tabs missing content scripts

- **WHEN** `broadcastUiMode` sends a message to a tab where the content script is not yet injected
- **THEN** chrome runtime errors are suppressed and the broadcast continues for remaining tabs
- **AND** the failure is logged with the `[Arcline]` prefix for diagnostics

### Requirement: Swipe gestures navigate spaces and refresh snapshots

Swipe gestures detected in the background context SHALL invoke space navigation and force downstream UI refreshes.

#### Scenario: Swipe succeeds and updates UI

- **WHEN** `subscribeToSwipe` receives `direction: 'forward'`
- **THEN** `navigateSpace('forward')` returns true
- **AND** `broadcastSpacesSnapshot` sends the latest space list to connected clients

#### Scenario: Navigation fails gracefully

- **WHEN** `navigateSpace` rejects or returns false
- **THEN** the handler logs `[Arcline] Swipe navigation failed`
- **AND** no further broadcasts are attempted for that gesture

### Requirement: Command handlers validate inputs and report structured errors

Each `commandHandler` SHALL validate incoming payloads, respond asynchronously, and provide structured `{ ok, error }` or `{ id, error }` responses when preconditions fail.

#### Scenario: Missing required payload

- **WHEN** `toggleTabPinned` is invoked without a numeric `tabId`
- **THEN** the handler immediately returns `sendResponse({ ok: false, error: 'tabId is required' })`
- **AND** it returns `false` so the runtime knows the request finished synchronously

#### Scenario: Asynchronous failure

- **WHEN** `createSpace` throws inside `respondAsync`
- **THEN** the catch block logs `Failed to create space`
- **AND** `sendResponse({ ok: false, error: message })` is dispatched before resolving the promise

#### Scenario: Bridge-style request/response pairing

- **WHEN** `getSpacesSnapshot` is invoked with an `id` from the ServiceWorkerBridge
- **THEN** the handler responds with `{ id, data }` on success
- **AND** `{ id, error }` on failure so the bridge can reject the pending promise deterministically
