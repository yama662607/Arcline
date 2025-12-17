## ADDED Requirements

### Requirement: dnd-kit ドラッグ＆ドロップ E2E テスト

Playwright E2E テストスイートは dnd-kit の PointerSensor を使用したドラッグ＆ドロップ機能をテストできる SHALL。

#### Scenario: ピン留めタブのドラッグ＆ドロップ

- **WHEN** ユーザーが一時タブをピン留めセクションにドラッグ＆ドロップする
- **THEN** タブがピン留めされ、UI に正しく表示される
- **AND** テストは dnd-kit のアクティベーション制約を尊重する

#### Scenario: お気に入りへのドラッグ＆ドロップ

- **WHEN** ユーザーがタブをお気に入りバーにドラッグ＆ドロップする
- **THEN** タブがお気に入りに追加される
- **AND** Playwright は steps オプションで適切に pointermove イベントをシミュレートする

#### Scenario: アクティベーション距離の考慮

- **WHEN** ドラッグ操作が dnd-kit の distance 制約（8px）を超える
- **THEN** ドラッグが正しく開始される
- **AND** テストは steps パラメータで中間イベントを保証する

## MODIFIED Requirements

### Requirement: E2E テストカバレッジ

E2E テストスイートは全てのコア機能をカバーし、100% の成功率を達成する SHALL。

#### Scenario: 全テスト実行

- **WHEN** 全ての E2E テストを実行する
- **THEN** 27 件全てが合格する
- **AND** スキップされたテストは 0 件となる

#### Scenario: CommandPalette テスト

- **WHEN** コマンドパレットのテストを実行する
- **THEN** index.html（App.tsx）を使用して正しくテストされる
- **AND** キーボードショートカットと検索機能が検証される
