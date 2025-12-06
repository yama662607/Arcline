## Why

Legacy arcify の"Favorites"機能を再現し、全スペース共通のグローバルピン留めタブをサイドバー最上部に配置することで、ユーザーが頻繁にアクセスするサイトへの素早いアクセスを実現する。

## What Changes

- サイドバー最上部に Favorites バー（ファビコングリッド表示）を追加
- ドラッグ&ドロップでタブを Favorites に追加/削除
- 右クリックメニューから"Add to Favorites"操作を追加
- 空状態のプレースホルダー UI 実装
- 全 UI モード（side-panel, popup, floating）で動作

## Impact

- Affected specs: favorites (新規), platform
- Affected code:
  - apps/extension/src/ui/components/FavoritesBar.tsx (新規)
  - apps/extension/src/ui/components/GlobalPinnedTabs.tsx (リファクタ)
  - apps/extension/src/ui/components/TabContextMenu.tsx
  - apps/extension/src/App.tsx
  - apps/extension/src/floating/FloatingApp.tsx
  - apps/extension/src/popup/PopupApp.tsx
