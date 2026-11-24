## Context

Floating UI は content script 内の DOM に埋め込まれており、タブ切替と同時に UI が切り替わるため、Arc のような連続アニメーションをそのまま再現できない。現状はジェスチャー検出とタブ切替が即時に発火するため、操作意図の判定と遷移タイミングの一貫性が不足している。

## Goals / Non-Goals

- Goals:
  - Arc に近い操作感（指離しで確定、単一スペース移動、意図ロック）を実現する
  - DOM 埋め込みの制約内で連続的に見える遷移アニメを再現する
  - 状態管理を簡潔にし、ジェスチャーとアニメーションの責務を分離する
  - Bottom Space Bar からの切替も同じ遷移体験に統一する

- Non-Goals:
  - Side Panel での連続アニメーション実装（今回は対象外）
  - 複数スペースの連続移動（1スワイプ=隣接1つのみ）
  - ネイティブ UI の完全再現（擬似連続に留める）

## Decisions

- Decision: ジェスチャー入力は「意図ロック + 指離し確定」の単純な状態機械で扱う
  - 状態: idle → tracking → locked(horizontal|vertical) → committing → cooldown
  - 最初の有意な速度ベクトルで方向ロックし、逆軸成分は無視する
  - 指離しは「入力停止から短いタイムアウト（60〜80ms）」で判定する

- Decision: 進捗と方向をハンドオフ情報として扱う
  - 停止型は「切替直前の進捗率」と「方向」を保存し、移動先で残りアニメを再生
  - フリック型は「移動前にアニメ完了」→完了時に切替を発火
  - ハンドオフ情報は背景で短時間保持し、移動先が取得できなければ破棄する

- Decision: アニメーション対象は Space Header / Pinned / Temporary / NewTabButton
  - SearchBar / FavoritesBar / BottomSpaceBar は固定領域として残す
  - SpaceContentView はこの範囲を単一のスライド対象にする

- Decision: Bottom Space Bar からの切替はフリック型の挙動に統一する
  - UI 側で「フリック型遷移」を起動 → 完了後に切替コマンドを送る

## Alternatives considered

- 代替1: 切替直前に新タブへ pre-open して完全に連続させる
  - 制約: content script の起動遅延が大きく、連続性より不安定さが目立つ
- 代替2: スワイプ中は切替せず、常に旧タブで完了後に切替
  - 制約: 停止型の「途中位置から続き」感が出せない

## Risks / Trade-offs

- ハンドオフ情報が届かない場合、遷移の連続感が欠ける
  - Mitigation: タイムアウトで graceful degrade（通常の切替）
- ジェスチャー意図ロックが強すぎると、水平スクロールの意図が誤判定される
  - Mitigation: 最初のベクトル判定に閾値を設ける

## Migration Plan

- 既存の `floating-gestures` のイベント処理を段階的に置き換える
- UI アニメーション範囲を再構成し、旧挙動は段階的に廃止
- 仕様確認後に `just check` で品質ゲートを通す

## Open Questions

- 指離し判定のタイムアウト閾値を固定値にするか、UI モード別に調整するか
- ハンドオフ情報のTTL（例: 400〜600ms）の妥当性
