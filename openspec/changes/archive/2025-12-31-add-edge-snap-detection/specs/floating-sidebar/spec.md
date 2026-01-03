## ADDED Requirements

### Requirement: Floating sidebar edge detection shall infer left-edge arrival even when pointer events are lost

Floating sidebar のエッジ検知は、高速移動やブラウザ UI の介入で pointermove が取得できない場合でも、左向きの速度・screenX と window.screenX の差分・pointerleave の発生を組み合わせてユーザーの意図を推論し、ホットゾーン通過と同等に扱わなければならない。推論条件は調整可能な定数として公開し、デバッグ UI から変更できること。

#### Scenario: Pointerleave inference triggers floating sidebar

- **WHEN** ユーザーが clientX=60px 付近から左向きに高速移動し pointerleave (relatedTarget = null) が発生する
- **AND** screenX - window.screenX が推論閾値未満である
- **THEN** システムは floating sidebar を hover 起動し、ホットゾーンに入った場合と同じ状態遷移を実行する

#### Scenario: Debug UI exposes live thresholds

- **WHEN** 開発モードで Edge Detection Debug ウィンドウを表示する
- **THEN** 現在の閾値（velocity, distance など）と実測値（screenX, velocityX, state 等）がリアルタイムに表示され
- **AND** UI 上の操作または入力で閾値を変更すると、その場で content script の検知ロジックに反映される
