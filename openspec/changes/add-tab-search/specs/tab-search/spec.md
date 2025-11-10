## ADDED Requirements

### Requirement: タブ検索機能
The extension SHALL provide a cross-space tab search feature that allows users to quickly find and navigate to tabs using fuzzy search.

#### Scenario: 検索パネルを開く
- **GIVEN** the user is viewing any UI mode (side panel, popup, or floating)
- **WHEN** the user presses Ctrl/Cmd+K
- **THEN** a search dialog SHALL appear with focus on the search input field
- **AND** the dialog SHALL display a placeholder text "Search tabs..."

#### Scenario: ファジー検索でタブを検索
- **GIVEN** the search dialog is open
- **WHEN** the user types a search query
- **THEN** the extension SHALL search across all tabs in all spaces
- **AND** the results SHALL match against tab title, URL, and domain name
- **AND** the results SHALL be scored and sorted by relevance
- **AND** the search SHALL update in real-time as the user types (with debounce)

#### Scenario: 検索結果からタブをアクティブ化
- **GIVEN** search results are displayed
- **WHEN** the user selects a result (Enter key or click)
- **THEN** the extension SHALL activate the selected tab
- **AND** the search dialog SHALL close
- **AND** if the tab is in a different space, the extension SHALL switch to that space

#### Scenario: 空の検索結果
- **GIVEN** the search dialog is open
- **WHEN** no tabs match the search query
- **THEN** the dialog SHALL display "No tabs found" message
- **AND** the user SHALL still be able to close the dialog or modify the query

#### Scenario: 検索結果のキーボードナビゲーション
- **GIVEN** search results are displayed
- **WHEN** the user presses Arrow Up/Down keys
- **THEN** the selection SHALL move to the previous/next result
- **AND** the selected result SHALL be visually highlighted

#### Scenario: 検索ダイアログを閉じる
- **GIVEN** the search dialog is open
- **WHEN** the user presses Escape or clicks outside the dialog
- **THEN** the dialog SHALL close
- **AND** the search query SHALL be cleared

### Requirement: 検索パフォーマンス
The tab search SHALL perform efficiently even with large numbers of tabs.

#### Scenario: 大量タブでの検索
- **GIVEN** the user has 200+ tabs across multiple spaces
- **WHEN** the user performs a search
- **THEN** the search results SHALL appear within 100ms
- **AND** the UI SHALL remain responsive during typing
- **AND** search queries SHALL be debounced (300ms) to avoid excessive computation
