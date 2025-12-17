# Playwright + dnd-kit ドラッグ＆ドロップテストガイド

このドキュメントでは、Playwright を使用して dnd-kit のドラッグ＆ドロップ機能をテストする方法を記録します。

## 背景と課題

Arcline 拡張機能では、dnd-kit ライブラリを使用してタブのドラッグ＆ドロップ機能を実装しています。当初、Playwright の `locator.dragTo()` を使用したテストが `test.fixme` でスキップされていました。

### 問題点

- dnd-kit は HTML Drag and Drop API ではなく、独自の PointerSensor を使用
- Playwright の `dragTo()` はネイティブ HTML D&D 向けで、dnd-kit では動作しない
- アクティベーション制約（distance: 8px）を超える移動が必要

## 解決策

### dnd-kit の PointerSensor の動作理解

dnd-kit の PointerSensor は以下のイベントシーケンスを監視します：

1. **`pointerdown`** - ドラッグ開始の可能性
2. **`pointermove`** - 移動を監視、アクティベーション制約をチェック
3. **`pointerup`** - ドラッグ完了

重要：`distance` 制約（デフォルト 8px）を超える移動がないとドラッグが開始されません。

### Playwright での正しい実装

```typescript
async function dragAndDrop(page: Page, dragLocator: Locator, dropLocator: Locator) {
  // 要素の座標を取得
  const dragBox = await dragLocator.boundingBox()
  const dropBox = await dropLocator.boundingBox()

  if (!dragBox || !dropBox) {
    throw new Error('Could not get bounding boxes for drag elements')
  }

  // 1. ドラッグ元の中心に移動
  await page.mouse.move(dragBox.x + dragBox.width / 2, dragBox.y + dragBox.height / 2)

  // 2. マウスダウン（ドラッグ開始）
  await page.mouse.down()

  // 3. アクティベーション距離を超えて移動
  // steps で pointermove イベントを複数回発火させる
  await page.mouse.move(
    dragBox.x + dragBox.width / 2,
    dragBox.y + dragBox.height / 2 + 15, // 15px > 8px activation distance
    { steps: 5 }
  )

  // 4. ドロップ先に移動
  await page.mouse.move(dropBox.x + dropBox.width / 2, dropBox.y + dropBox.height / 2, {
    steps: 10,
  })

  // 5. マウスアップ（ドロップ完了）
  await page.mouse.up()
}
```

### 重要なポイント

#### 1. `steps` オプションの使用

`page.mouse.move()` に `steps` を指定すると、中間点でも `pointermove` イベントが発火します。これにより dnd-kit が適切にドラッグを検知できます。

#### 2. アクティベーション距離の考慮

dnd-kit の `distance` 制約（SpacesWorkspace.tsx では 8px に設定）を超える移動が必要です。

#### 3. DndContext のあるページを使用

ドラッグ＆ドロップ機能は `DndContext` でラップされたコンポーネントでのみ動作します：

- `popup.html` → `PopupApp` → DndContext なし
- `index.html` → `App.tsx` → `SpacesWorkspace` → DndContext あり

#### 4. floatingContext と aria-label

`EnhancedTabList` は `floatingContext` がある場合のみ `aria-label` を設定します：

```typescript
// floating variant のみ aria-label が設定される
if (isFloatingVariant) {
  return (
    <div
      role="region"
      aria-label={dropZoneAriaLabel} // "Pinned tabs drop zone" など
    >
```

## 実装例

### pinned-tabs.spec.ts の修正

```typescript
test('should move tab between sections via drag and drop', async ({ page }) => {
  // index.html を使用（DndContext があるため）
  await page.goto(`chrome-extension://${extensionId}/index.html`)

  // floating variant なので aria-label region が存在
  const pinnedZone = page.getByRole('region', { name: 'Pinned tabs drop zone' })
  const temporaryZone = page.getByRole('region', { name: 'Temporary tabs drop zone' })

  const sourceTab = temporaryZone.getByRole('button', { name: 'Example Tab' })
  const pinnedTab = pinnedZone.getByRole('button', { name: 'Pinned Tab' })

  // dnd-kit 互換のドラッグ＆ドロップ実行
  const sourceBox = await sourceTab.boundingBox()
  const targetBox = await pinnedTab.boundingBox()

  if (sourceBox && targetBox) {
    // 上記の dragAndDrop 関数と同じ実装
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2 + 15,
      { steps: 5 }
    )
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 10,
    })
    await page.mouse.up()
  }

  // 検証
  await expect(page.getByRole('button', { name: 'Example Tab' })).toBeVisible()
})
```

## 結果

| 項目    | 修正前 | 修正後 |
| ------- | ------ | ------ |
| Passed  | 20     | **27** |
| Skipped | 7      | **0**  |
| Failed  | 0      | 0      |

全 27 テストが成功し、スキップされたテストはゼロになりました。

## 参考資料

- [dnd-kit Documentation - Pointer Sensor](https://docs.dndkit.com/api-documentation/sensors/pointer)
- [Playwright Documentation - Mouse](https://playwright.dev/docs/api/class-mouse)
- [Reflect - Testing drag-and-drop with Playwright](https://reflect.run/articles/how-to-test-drag-and-drop-interactions-in-playwright/)

## まとめ

dnd-kit のようなカスタムドラッグ＆ドロップライブラリをテストする場合：

1. ライブラリのイベント処理モデルを理解する
2. ネイティブ API ではなく、ライブラリの要件に合わせた実装を行う
3. `steps` オプションで適切なイベント発火を保証する
4. アクティベーション制約などのライブラリ固有の設定を考慮する
