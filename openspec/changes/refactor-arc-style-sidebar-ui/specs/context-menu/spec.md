## ADDED Requirements

### Requirement: Pinned item context menu SHALL support moving items to another space

拡張機能は pinned item（Pinned Tab / Pinned Folder）に対してコンテキストメニューを提供し、`Move to Space >` により別スペースへ移動できなければならない (SHALL support move to another space)。

移動先は、選択したスペースの pinned items ルートとする（A 案）。

#### Scenario: Move pinned tab to another space

- **GIVEN** ユーザーが pinned tab を右クリックしてコンテキストメニューを開いている
- **WHEN** ユーザーが `Move to Space >` を開き、移動先スペースを選択する
- **THEN** pinned tab は選択したスペースの pinned items ルートへ移動する

#### Scenario: Move pinned folder to another space

- **GIVEN** ユーザーが pinned folder を右クリックしてコンテキストメニューを開いている
- **WHEN** ユーザーが `Move to Space >` を開き、移動先スペースを選択する
- **THEN** pinned folder は選択したスペースの pinned items ルートへ移動する

## MODIFIED Requirements

### Requirement: Space Context Menu

The system SHALL provide a custom context menu when right-clicking on a space.

#### Scenario: Options

- **WHEN** right-clicking a space
- **THEN** show: "Rename", "Change Color", "Delete"
- **AND** show: "Settings...", "Archive...", "Bookmark Import..." (or equivalent entrypoints)
