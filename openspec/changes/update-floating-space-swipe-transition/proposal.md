## Why

Floating UI でのスペース移動が Arc 本家の操作感と一致せず、トラックパッド操作時の「指を離した瞬間に隣スペースへ移動する」体験や、ページ送りに見える連続アニメーションが再現できていない。DOM 埋め込み型の制約下でも、意図判定・遷移タイミング・アニメーション継続を整理し、体感品質を引き上げたい。

## What Changes

- Floating UI のスペース移動ジェスチャーを Arc 互換の意図ロック＋確定ルールに刷新する
  - 初期ベクトルで水平/垂直の意図をロックし、ロック後は逆軸成分を無視する
  - 指を離した瞬間に確定し、慣性は無視する
  - 速度が 0 でない場合は必ず隣スペースへ移動、停止時は 50% 以上で移動を確定する
- 連続的に見える移動アニメーションを擬似的に再現する
  - 停止型: 移動直後に次タブへ切り替え、移動先で残りアニメーションを継続する
  - フリック型: 現タブ内でアニメーションを完了し、完了後に切り替える
  - Bottom Space Bar のスペース切替はフリック型と同じ挙動に統一する
- アニメーション対象領域を「Space Header / Pinned / Temporary / NewTabButton」に限定する
  - SearchBar / FavoritesBar / BottomSpaceBar は固定のまま残す

## Impact

- Affected specs:
  - `floating-sidebar`（ジェスチャー意図ロック、確定ルール、遷移アニメーション範囲）

- Affected code (予定):
  - `extension/src/content-scripts/floating-gestures.ts`（意図ロック・指離し確定・進捗管理）
  - `extension/src/content-scripts/floating-ui.ts`（ハンドオフ情報の受信/適用）
  - `extension/src/background/services/space-navigation.ts`（ハンドオフ連携、切替タイミング）
  - `extension/src/ui/components/SpacesWorkspace.tsx`（アニメーション対象領域の再構成）
  - `extension/src/ui/components/SpaceContentView.tsx`（継続アニメーション対応）
  - `extension/src/ui/components/BottomSpaceBar.tsx`（フリック型の切替挙動）
  - `extension/src/lib/useSpacesSync.ts`（切替通知の一貫化）

## Open Questions

- 指離し判定を「入力停止からのタイムアウト」で行う場合の閾値（例: 60〜80ms）をどこまで厳密に詰めるか
- フリック型のアニメーション時間を現行 SpaceContentView の遷移時間と合わせるか、別の専用設定にするか
