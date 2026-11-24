## ADDED Requirements

### Requirement: Workspace navigation SHALL be Arc-style without primary tabs

拡張機能のメインワークスペースは、`Spaces / Archive / Settings` のような一次タブ UI によるページ切り替えを提供せず、通常状態では常に Spaces（タブ管理サーフェス）を表示しなければならない (SHALL keep Spaces as the primary surface)。

#### Scenario: Spaces is always visible

- **WHEN** ユーザーが Arcline UI（sidepanel または floating）を開く
- **THEN** 初期表示は Spaces（タブ管理サーフェス）である
- **AND** Archive/Settings は一次タブとしては表示されない

### Requirement: Workspace SHALL provide a More menu entrypoint

拡張機能は `…`（More）メニューを提供し、Settings / Archive / Bookmark Import に到達できなければならない (SHALL provide a More entrypoint)。

#### Scenario: Open Settings from More menu

- **GIVEN** ユーザーが Arcline UI を開いている
- **WHEN** ユーザーが `…`（More）メニューを開き、Settings を選択する
- **THEN** Settings がウィンドウ（モーダル）として表示される

#### Scenario: Open Archive from More menu

- **GIVEN** ユーザーが Arcline UI を開いている
- **WHEN** ユーザーが `…`（More）メニューを開き、Archive を選択する
- **THEN** Archive がウィンドウ（モーダル）として表示される

#### Scenario: Open Bookmark Import from More menu

- **GIVEN** ユーザーが Arcline UI を開いている
- **WHEN** ユーザーが `…`（More）メニューを開き、Bookmark Import を選択する
- **THEN** Bookmark Import がウィンドウ（モーダル）として表示される

### Requirement: Modal windows SHALL be closable

Settings / Archive / Bookmark Import のウィンドウ（モーダル）は、Escape または背景クリックで閉じられなければならない (SHALL be dismissible)。

#### Scenario: Dismiss modal

- **GIVEN** ユーザーが Settings/Archive/Bookmark Import のいずれかのモーダルを開いている
- **WHEN** ユーザーが Escape を押す
- **THEN** モーダルは閉じる
