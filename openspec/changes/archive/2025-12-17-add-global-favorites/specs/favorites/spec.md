## ADDED Requirements

### Requirement: Favorites バーの表示

システムは全スペース共通の Favorites バーをサイドバー最上部に表示しなければならない (SHALL display)。

#### Scenario: ピン留めタブがある場合

- **WHEN** ユーザーがピン留めタブを持っている
- **THEN** Favorites バーにファビコングリッドが表示される
- **AND** 各ファビコンはクリック可能である

#### Scenario: ピン留めタブがない場合

- **WHEN** ユーザーがピン留めタブを持っていない
- **THEN** プレースホルダーが表示される
- **AND** "Drag to add Favorites"のガイドテキストが表示される

### Requirement: Favorites へのタブ追加

ユーザーはタブを Favorites に追加できなければならない (MUST be able to add)。

#### Scenario: ドラッグ&ドロップで追加

- **WHEN** ユーザーがタブを Favorites エリアにドラッグ&ドロップする
- **THEN** タブがピン留めされる
- **AND** Favorites バーにファビコンが追加される

#### Scenario: コンテキストメニューから追加

- **WHEN** ユーザーがタブを右クリックし"Add to Favorites"を選択する
- **THEN** タブがピン留めされる
- **AND** Favorites バーにファビコンが追加される

### Requirement: Favorites からのタブ削除

ユーザーは Favorites からタブを削除できなければならない (MUST be able to remove)。

#### Scenario: ドラッグで削除

- **WHEN** ユーザーが Favorites エリアからファビコンをドラッグアウトする
- **THEN** タブのピン留めが解除される
- **AND** Favorites バーからファビコンが削除される

#### Scenario: コンテキストメニューから削除

- **WHEN** ユーザーが Favorites 内のタブを右クリックし"Remove from Favorites"を選択する
- **THEN** タブのピン留めが解除される
- **AND** Favorites バーからファビコンが削除される

### Requirement: Favorites タブのアクティブ化

ユーザーは Favorites バーからタブをアクティブ化できなければならない (MUST be able to activate)。

#### Scenario: ファビコンクリック

- **WHEN** ユーザーが Favorites バー内のファビコンをクリックする
- **THEN** 対応するタブがアクティブになる
- **AND** ブラウザがそのタブにフォーカスする

### Requirement: 視覚的フィードバック

システムはドラッグ&ドロップ操作中に視覚的フィードバックを提供しなければならない (SHALL provide)。

#### Scenario: ドラッグ中のハイライト

- **WHEN** ユーザーがタブを Favorites エリア上にドラッグする
- **THEN** Favorites エリアがハイライト表示される
- **AND** ドロップ可能であることが視覚的に示される

#### Scenario: ホバー時のツールチップ

- **WHEN** ユーザーが Favorites 内のファビコンにホバーする
- **THEN** タブのタイトルと URL がツールチップで表示される

### Requirement: 全 UI モード対応

Favorites 機能は全ての UI モードで動作しなければならない (MUST work in all UI modes)。

#### Scenario: Side Panel モード

- **WHEN** ユーザーが Side Panel モードを使用していて
- **THEN** Favorites バーがパネル最上部に表示される
- **AND** 全ての操作が正常に動作する

#### Scenario: Popup モード

- **WHEN** ユーザーが Popup モードを使用している
- **THEN** Favorites バーがポップアップ最上部に表示される
- **AND** 全ての操作が正常に動作する

#### Scenario: Floating モード

- **WHEN** ユーザーが Floating モードを使用している
- **THEN** Favorites バーがフローティングサイドバー最上部に表示される
- **AND** 全ての操作が正常に動作する
