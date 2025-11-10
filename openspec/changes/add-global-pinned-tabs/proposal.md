## Why
ユーザーがピン留めしたタブを全スペースで共有表示することで、重要なタブへのアクセス性を向上し、スペース切り替え時の利便性を向上させる。

## What Changes
- ピン留めタブのグローバル管理機能を追加
- 全スペースでピン留めタブを共通表示する仕組みを実装
- ピン留めタブの同期・管理ロジックをbackground-servicesに拡張
- UIコンポーネントでピン留めタブを特別表示

## Impact
- Affected specs: background-services, floating-sidebar
- Affected code: 
  - apps/extension/src/background/services/browser.ts
  - apps/extension/src/components/floating/
  - apps/extension/src/background/index.ts
