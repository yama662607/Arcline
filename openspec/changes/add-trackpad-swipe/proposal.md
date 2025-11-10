## Why
トラックパッドのスワイプジェスチャーでスペースを直感的に切り替えられるようにし、ユーザーの生産性と操作性を向上させる。

## What Changes
- トラックパッドスワイプジェスチャー検出機能を追加
- スワイプ方向に応じたスペース切り替えロジックを実装
- ジェスチャー設定と無効化オプションを提供
- スワイプ感度と閾値の調整機能を実装

## Impact
- Affected specs: background-services, floating-sidebar
- Affected code: 
  - apps/extension/src/background/services/gestures.ts (新規)
  - apps/extension/src/components/floating/
  - apps/extension/src/background/index.ts
