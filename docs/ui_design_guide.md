# Arc風UIデザイン微調整ガイド

現在のFloating UIのデザインを手動でカスタマイズするためのガイドです。
主に「Favorites（お気に入り）」「Pinned Items（ピン留めリスト）」「全体のレイアウト」の3箇所について変更方法を解説します。

---

## 1. Favorites（お気に入りアイコン）の調整

対象ファイル: `extension/src/ui/components/FavoritesBar.tsx`

このファイルで、グリッド状に並ぶアイコンのサイズや形を変更できます。

### アイコン（画像）のサイズを変える
61行目付近にある `iconSize` の数値を変更します。

```tsx
// 32から大きくするとアイコンが強調されます。小さくすると控えめになります。
const iconSize = 32;
```

### ボタンの形（角丸・スクircle）を変える
65行目付近の `className` 内にある `rounded-[20px]` を調整します。

```tsx
<div
  ref={ref}
  className={`group relative ... rounded-[20px] ...`} // ← ここ！
  // rounded-xl      : 少し丸い
  // rounded-[20px]  : Arcっぽいスクircle
  // rounded-full    : 完全な円
```

### ボタンの背景色・透明度を変える
同じく65行目付近の `bg-white/10` (常時表示) や `hover:bg-white/20` (ホバー時) を変更します。

```tsx
// bg-white/10 は「白の不透明度10%」です。15や20にすると白っぽくなります。
bg-white/10 hover:bg-white/20
```

---

## 2. Folder・Pinned Item（リスト項目）の調整

対象ファイル: `extension/src/ui/components/PinnedItemRows.tsx`

このファイルで、フォルダやタブのリスト行のデザインを変更できます。

### 行の高さ・余白を変える
`PinnedFolderRow` (46行目付近) と `PinnedTabRow` (129行目付近) の両方に同じ設定があります。
`py-1.5` (上下の余白) を調整してください。

```tsx
<div
  className={`... px-3 py-1.5 ...`} // ← py-1.5 を py-2 にすると行が高くなります
```

### フォルダアイコンの色を変える
70行目付近でアイコンの色を指定しています。

```tsx
<div className="flex-shrink-0 text-white/70 ..."> {/* ← white/70 を white/50 にすると暗くなる */}
  {isOpen ? <FolderOpen ... /> : <Folder ... />}
</div>
```

### インデント幅（階層の深さ）を変える
リストの階層が深くなった時の右へのズレ幅は、`style` 属性で計算されています。
`(level * 12 + 12)px` の `12` を大きくすると、階層ごとの段差が大きくなります。

```tsx
// 52行目付近 (Folder) と 138行目付近 (Tab)
style={{ paddingLeft: `${level * 12 + 12}px` }}
```

---

## 3. New Tabボタン・全体のレイアウト調整

対象ファイル: `extension/src/ui/components/SpacesWorkspace.tsx`

### 全体の余白（パディング）を変える
`SpacesWorkspace` 内のコンテンツエリアのパディング設定です。
314行目付近の `space-y-4 px-4` を調整します。

```tsx
<div className="space-y-4 px-4 pb-4 pt-4">
{/* px-4 を px-6 にすると左右の余白が増え、より「Airy」になります */}
```

### New Tabボタンのデザインを変える
408行目付近、リストの最後に追加されたボタンです。

```tsx
<button
  className="... text-white/60 hover:text-white ..." // 文字色
>
   <div className="... rounded bg-white/10 ..."> {/* プラスアイコンの背景 */}
      <Plus className="h-3 w-3" />
   </div>
   <span className="text-[13px] font-medium">+ New Tab</span> {/* 文字サイズ */}
</button>
```

---

### Tips: Tailwind CSS のクラスについて

*   **色と透明度**: `text-white/50` (文字色:白50%), `bg-blue-500/20` (背景:青20%)
*   **サイズ**: `w-4` (1rem = 16px), `h-[34px]` (34px固定)
*   **角丸**: `rounded`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`
*   **余白**: `px` (左右), `py` (上下), `pt` (上), `pb` (下), `pl` (左), `pr` (右), `gap` (要素間隔)

このガイドを参考に、数値を少しずつ変えて `just dev` で変化を確認してみてください！
