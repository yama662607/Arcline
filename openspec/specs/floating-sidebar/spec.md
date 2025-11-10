# Floating Sidebar Specification

## Requirements

### Requirement: Floating hotzone shall expose accessible interaction states
The floating sidebar hotzone SHALL provide visible and programmatic feedback for pointerおよびキーボード操作、並びにスクリーンリーダー利用者に対して役割と状態を通知すること。

#### Scenario: Pointer activation feedback
- **WHEN** ユーザーがマウスまたはタッチでホットゾーンを押下する
- **THEN** ホットゾーンは押下状態のスタイル（例: 色/陰影の変化）を表示し
- **AND** aria-pressed 属性が現在のピン留め状態を反映する

#### Scenario: Keyboard focus and activation
- **WHEN** ユーザーがキーボードでホットゾーンにフォーカスし Space/Enter を押下する
- **THEN** フォーカスリングなどの視覚的インジケータが表示され
- **AND** ピン留め状態がトグルされ、aria-pressed が更新される

#### Scenario: Assistive technology announcement
- **WHEN** スクリーンリーダーがホットゾーンを読み上げる
- **THEN** ラベルとロールが「ボタン」として報告され
- **AND** 現在のピン留め状態が `pressed` として伝達される
