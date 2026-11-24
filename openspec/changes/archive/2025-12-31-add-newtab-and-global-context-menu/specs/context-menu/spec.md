## ADDED Requirements

### Requirement: Global context menu SHALL provide Arcline entrypoints

拡張機能は `chrome.contextMenus` を用いて、ページ上の右クリック（グローバルコンテキストメニュー）から Arcline の主要操作へ到達できる項目を提供しなければならない (SHALL provide global entrypoints)。

#### Scenario: Menu items exist

- **WHEN** ユーザーが任意のページで右クリックする
- **THEN** Arcline のメニュー項目が表示される

#### Scenario: Open Side Panel

- **GIVEN** ユーザーが右クリックメニューを開いている
- **WHEN** ユーザーが "Open Arcline"（または同等の名称）をクリックする
- **THEN** Arcline Side Panel が開く

#### Scenario: Toggle Command Palette

- **GIVEN** ユーザーが右クリックメニューを開いている
- **WHEN** ユーザーが "Command Palette"（または同等の名称）をクリックする
- **THEN** Command Palette が表示される

#### Scenario: Quick Pin toggle

- **GIVEN** ユーザーが右クリックメニューを開いている
- **WHEN** ユーザーが "Quick Pin"（または同等の名称）をクリックする
- **THEN** アクティブタブの Pin 状態が切り替わる
