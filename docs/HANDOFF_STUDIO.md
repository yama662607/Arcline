# Arcline — Mac Studio 引き継ぎドキュメント

**作成日**: 2026-11-24  
**ブランチ**: `main`（`origin/main` へ push 済み。今後の新機能開発は `main` から都度ブランチを切って実施）  
**リポジトリ**: `https://github.com/yama662607/Arcline`（現在 PRIVATE、完成後に OSS 公開予定）  
**バージョン表記ポリシー**: `v2` 等の表記は一切使わず、素の **Arcline (`1.0.0`)** としてリポジトリ名・アプリ名・フォルダ名・コード全体を統一する  
**対象ブラウザ**: **Brave Browser**（ネイティブタブ完全 0px 非表示対応）＋ Chrome / Chromium 互換

---

## 1. ミッションとプロダクト要件（確定事項）

Arc Browser の唯一無二のサイドバー体験を、**超軽量・低メモリ・一流エンジニアが見ても妥協のない OSS 品質** の Manifest V3 拡張機能としてゼロから作り上げたものが **Arcline**。

1. **全 Space 共通 Global Favorites Grid**: どの Space からでもアクセスできる 4 列×48px タイル（`Other Bookmarks/Arcline/Favorites` に永続化）。
2. **Space 別ピン留めタブ＆ネストフォルダ**: Space ごとのブックマークツリー、折りたたみフォルダ内の開いているタブ表示、インラインリネーム、元 URL 復元、ピン留めを残したアンロード、フル D&D（並び替え・フォルダ移動・Space 間移動）。
3. **一時タブ（Today）＋自動アーカイブ**: ネイティブ Tab Groups で Space 分離＋MV3 `chrome.alarms` による自動アーカイブ＆検索復元。
4. **左端ホバー自動表示（オートハイド）＋ネイティブ Side Panel ハイブリッド**:
   - 通常は完全非表示（0px）。
   - `http(s)://` ページでは超軽量 Vanilla JS（**`3.18 kB gzip`、React ゼロ、ES import ゼロの IIFE**）が左端ホバーを検知し、初回ホバー時のみ拡張オリジン `iframe`（`sidepanel.html?mode=overlay`）を遅延ロードしてすりガラス表示（`backdrop-filter: blur(28px)`）。バックグラウンドタブは 400ms 後に自動アンロードして RAM を解放。
   - `chrome://`・`brave://`・New Tab ページではネイティブ `chrome.sidePanel` へフォールバック。
5. **本物の Arc 実画面忠実 UI ＆ パワーアップ版 Space テーマスタジオ**:
   - マットチャコール（`Main`）＋低彩度スモーキーグラデーション＋プロシージャル SVG `feTurbulence` フィルム粒子ノイズ。
   - 1〜3 色マルチノード 2D カラーオービット、調和モード（自由／類似色／補色／3色調和）、Hex 直接入力、波型「鮮やかさ」スライダー、回転式ドット「粒子」ダイヤル、Space 別外観（自動／ライト／ダーク）、1 クリックプリセット。
6. **1 クリック Arc `StorableSidebar.json` インポーター**:
   - Top Apps → Favorites、Spaces（名前・テーマグラデーション・`noiseFactor`・`intensityFactor`・`light/dark`・`iconType`）・ピン留め・フォルダを一括取り込み。空フォルダ・Google 検索 URL・重複 URL・壊れた iOS ローカルパスを自動整理。
7. **AI 完全自動検証（実機手動デバッグからの脱却）**:
   - 静的解析 + Vitest + 実機 Brave 158 `chrome.developerPrivate` 0 エラー診断（ライブ reload 2 回）+ Playwright 実マウス E2E（全 11 ケース）+ 本物 `StorableSidebar.json` 自動ビジュアル比較撮影（`just visual-arc`）。

---

## 2. Mac Studio での最速環境セットアップ（1〜2 分）

```bash
# 1. リポジトリ取得（既存なら pull）
cd ~/Code/Projects
git clone https://github.com/yama662607/Arcline.git  # 既存ならスキップ
cd ~/Code/Projects/Arcline
git pull origin main

# 2. 依存導入＆参考 OSS リポジトリ（refs/ は gitignore 済み）を取得
pnpm install
just setup-refs

# 3. 全品質ゲート＆実機 Brave 検証を実行
just check             # Biome format/lint + tsc + Vitest (25 tests)
just build             # MV3 ビルド -> extension/dist/
just check-extension   # 実機 Brave 0 エラー診断 + ライブ reload 2 回
just e2e               # 実機 Brave Playwright E2E (11/11)

# 4. （Mac Studio に Arc の StorableSidebar.json がある場合）実データ比較スクショ撮影
just visual-arc
# 画面に Brave ウィンドウを出して動きを見たい場合:
ARCLINE_HEADED=1 just visual-arc
```

> **注意**: Brave が Mac Studio に未インストールの場合は `brew install --cask brave-browser` で導入するか、Chromium で検証する場合は `pnpm --dir extension exec playwright install chromium && ARCLINE_BROWSER=chromium just e2e` で実行できます。

### Brave 側での読み込み＆ 0px ネイティブタブ非表示手順
1. `brave://extensions` → デベロッパーモード ON →「パッケージ化されていない拡張機能を読み込む」→ `~/Code/Projects/Arcline/extension/dist` を選択。
2. `brave://settings/appearance`:
   - **サイドバー → サイドバーを表示**: **「しない（Never）」**
   - **タブ → 垂直タブを使用**: **ON**
   - **最小化時に完全に隠す（Hide completely when minimized）**: **ON**
   - **右側に表示（Show on the right）**: **ON**（※Brave の仕様で「最小化時に完全に隠す」を ON にするとホバー展開が強制 ON になるため、ネイティブ垂直タブを右端 0px に逃がすことで左端を 100% Arcline 専用にする）
   - （推奨）**垂直タブ使用時にタイトルバーを表示（Show title bar）**: **OFF**
   - **サイドパネル配置**: **「左」**
3. 左上の緑ボタン（全画面ボタン）のすぐ右隣にある **最小化（折りたたみ）ボタン `◧`** をクリック → ネイティブタブバーが完全 0px になります。

### 生 Brave タブへ AI から直接繋ぐ（`playwright-extension` MCP）
- Brave に Chrome ウェブストアの **Playwright MCP Bridge**（`https://chromewebstore.google.com/detail/playwright-mcp-bridge/mmlmfjhmonkocbjadbfplnigmagldckm`）を入れると、Antigravity の `playwright-extension` MCP から常用 Brave の任意タブに直接接続してホバー操作・撮影・コンソール検査ができます。

---

## 3. アーキテクチャ全体像

```text
Arcline/
├── assets/icon-master.png                    # 生成マスターアイコン (1254x1254 RGBA, git管理)
├── docs/HANDOFF_STUDIO.md                    # 本引き継ぎ書
├── justfile                                  # check / fix / build / check-extension / e2e / visual-arc / setup-refs
├── README.md / PRIVACY.md / CONTRIBUTING.md  # OSS 公開向けドキュメント
├── .github/workflows/ci.yml                  # CI (Biome + tsc + Vitest + Chromium check-extension + E2E)
└── extension/
    ├── public/
    │   ├── manifest.json                     # MV3 (version 1.0.0; sidePanel, tabs, tabGroups, bookmarks, storage, alarms, favicon)
    │   └── icons/icon-{16,32,48,128}.png     # 生成アイコン（左サイドバー rail + arc デザイン）
    ├── vite.config.ts                        # Side Panel + Service Worker (ES module)
    ├── vite.overlay.config.ts                # overlay.js 専用 IIFE ビルド（ES import ゼロ、3.18 kB gzip）
    ├── scripts/
    │   ├── check-extension.mjs               # chrome.developerPrivate 0エラー診断 + ライブ reload 2回
    │   └── visual-arc-compare.mjs            # 本物 StorableSidebar.json 自動インポート＆2x Retina 比較撮影
    ├── tests/e2e/
    │   ├── fixtures.ts                       # Brave 158 / Chromium 自動選択・ローカルテストサーバ
    │   ├── edge-hover.spec.ts                # 実マウスホバー 6 ケース（0ペイント・誤通過・OOPIF・ドラッグ抑止・ロック・リサイズ・攻撃CSS・自動アンロード）
    │   ├── sidebar-workflows.spec.ts         # Arc JSON取込・Favorite/Space/Folder・コンテキストメニュー境界・⌘K・Theme Studio
    │   └── resilience.spec.ts                # CDP SW強制終了復旧・プロファイル再起動重複ゼロ・実sidePanel.open・メモリリーク境界
    └── src/
        ├── core/                             # chrome.* 依存ゼロの純粋ロジック（Vitest 100%カバー）
        │   ├── types.ts                      # SidebarState, SpaceTheme, Settings, Command
        │   ├── colors.ts                     # NEUTRAL_HUE (-1), SPACE_PRESETS, OKLCH/TabGroupColor 変換
        │   ├── space-theme.ts                # 2Dオービット変換・調和計算・多層ラジアル/リニアCSS生成・Arc windowTheme パーサ
        │   ├── edge-hover.ts                 # EdgeHoverMachine 純粋ステートマシン
        │   ├── derive.ts                     # Snapshot -> SidebarState 派生 & O(1) live tab patch
        │   ├── snapshot.ts                   # ブックマーク・グループ照合ヘルパ
        │   ├── settings.ts                   # DEFAULT_SETTINGS & clamp バリデーション
        │   ├── archive.ts                    # 自動アーカイブ対象抽出＆マージ
        │   └── arc-import.ts                 # Arc StorableSidebar.json パーサ（色・粒子・アイコン・整理オプション対応）
        ├── background/                       # 単一書き込み層（Service Worker）
        │   ├── queue.ts                      # SerialQueue + Chrome タブドラッグロック自動リトライ
        │   ├── storage.ts                    # session bindings / local prefs・spaceMeta・archive
        │   ├── root.ts                       # Other Bookmarks/Arcline/Favorites 自動確保
        │   ├── groups.ts / context.ts        # Native Tab Groups 同期
        │   ├── reconcile.ts                  # 再起動後の冪等な tab <-> bookmark バインディング復旧
        │   ├── engine.ts                     # 全 Command 実行エンジン
        │   └── index.ts                      # MV3 イベント登録・O(1) tab-hidden 通知・toggle-sidebar ハイブリッド分岐
        ├── content/
        │   └── overlay.ts                    # ~3KB gzip Vanilla JS 左端ホバーオーバーレイ（Shadow DOM + 遅延iframe + リサイズ + SPA自己修復）
        └── sidepanel/                        # React 19 + Tailwind v4 UI
            ├── styles.css                    # Arc パレット・OKLCH @property --space-hue・SVG feTurbulence 粒子・Native Popover/Dialog
            ├── api.ts                        # ?windowId= / tabs.getCurrent() / O(1) tabs.onUpdated パッチ購読
            ├── App.tsx                       # URL/検索ピル・Favorites・PinnedTree・TemporaryTabs・SpaceSwitcher・全モーダル統合
            └── components/
                ├── Favicon.tsx               # _favicon API + Arc風角丸グレーフォールバック
                ├── FavoritesGrid.tsx         # 4列x48px 枠線ゼロマットタイル + ホバー閉じるボタン + 再生バッジ
                ├── PinnedTree.tsx            # SpaceGlyph(Arcアイコン対応) + Arc専用SVGフォルダ + 36px行 + 折りたたみ内開タブ表示
                ├── TemporaryTabs.tsx         # ↓ Clear + 角丸 + New Tab ピル + ドメイン2行表示
                ├── SpaceSwitcher.tsx         # Archive左 | Spaceアイコン/ドット中央 | ⚙・＋右
                ├── SpaceThemeModal.tsx       # パワーアップ版 Arc テーマスタジオ（2Dオービット・調和・Hex・波型スライダー・回転式粒子ダイヤル）
                ├── SpaceModal.tsx            # Space 新規作成・名前/アイコン編集
                ├── ContextMenu.tsx           # Native Popover API + CSS Anchor Positioning
                └── SettingsModal.tsx         # 一般（外観・左端ホバー設定・自動アーカイブ・Brave 0pxガイド）/ アーカイブ / Arc移行＆JSON出力
```

---

## 4. ハマりポイント＆設計上の重要知見（必読）

1. **MV3 `content_scripts` は ES `import` 不可**: `overlay.js` は必ず `extension/vite.overlay.config.ts` で独立 IIFE としてビルドする。`vite.config.ts` のマルチエントリに混ぜると Rollup が共有チャンク `import` を吐いて即 `SyntaxError` になる。
2. **OOPIF（クロスオリジン拡張 iframe）ホバー境界**: `http(s)` ページ上の `.arcline-panel` から拡張オリジン `iframe` へマウスが入る際、Chromium は親側 `panel` で `pointerleave` を発火することがある。`App.tsx` からの `arcline:overlay-enter` / `leave` postMessage と左ガター許容の両方で防いでいる。
3. **`.arcline-grain-layer` と `position: fixed` アンカー**: `.arcline-shell > *` に一括で `position: relative` を付けると、Native Popover コンテキストメニューの `.menu-anchor`（`position: fixed`）が上書きされて画面外へ飛び出す。粒子オーバーレイは `z-index: 20; pointer-events: none; mix-blend-mode: overlay` 単体で乗せること。
4. **Brave `Preferences` の書き戻し**: Brave 起動中に `Default/Preferences` を書き換えても終了時に上書きされる。GUI（`brave://settings/appearance`）で変更するのが最も確実。
5. **Arc `StorableSidebar.json` の実データ仕様**:
   - 音符アイコン名は `musicNote` ではなく **`musicalNote`**。未知の英語識別子が下部バーへ文字列として漏れないよう `SpaceGlyph` にガードを入れ済み。
   - `Main` Space の `blendedSingleColor` は `rgb(0,0,0)`。そのまま暗くミックスすると `#070708` の真っ黒になるため、`space-theme.ts` でニュートラルダークの下限を Arc 本家マットチャコール（`#222224 → #1c1c1e`）に保っている。
   - フォルダ要素は `data: { list: {} }` または `data: { itemContainer: {} }` を持つ。
6. **W3C `color-scheme` × `iframe` 透過仕様**: 親ページと `iframe` 内の `:root` `color-scheme`（`light` / `dark`）が不一致だと、Chromium は透明ではなく不透明な `Canvas` 背景を描画する。`App.tsx` から `arcline:overlay-scheme` で `resolvedScheme` を送信し、`overlay.ts` 側で `iframe.style.colorScheme` を常に同期することで全画面ステージ展開時の透過を保証している。
7. **macOS Chromium `popover="auto"` × 右クリック競合**: macOS では `contextmenu` が `mousedown` 時に発火するため、直後の `mouseup` が `popover="auto"` を即座に light-dismiss してしまう。`ContextMenu.tsx` では `popover="manual"` + 次 tick 登録のメニュー外 `pointerdown` / `Escape` 監視を使い、Top Layer・CSS Anchor Positioning・アニメーションを保ちつつ安定動作させている。
8. **二本指横スワイプとブラウザ戻る／進むの非競合**: サイドバー側ルートに `overscroll-behavior-x: none`（ホストページは `auto` のまま無変更）＋ `window` への非パッシブ `wheel` リスナー（`preventDefault()`）＋ `SpaceSwipeMachine` の慣性（140ms）吸収により、Space 切替と Web ページの戻る／進むを完全分離している。
9. **プライベートデータの扱い**: OSS 公開予定のため、ユーザーの `StorableSidebar.json`・実データスクショ（`extension/test-results/`）・参考リポジトリ（`refs/`）は **絶対に git にコミットしない**（`.gitignore` で除外済み）。
   - `docs/screenshots/` の 4 枚は `extension/scripts/capture-readme-shots.mjs` が 100% 合成ダミーデータで生成した公開用スクショ。

---

## 5. 参考 OSS リポジトリ（`just setup-refs` で `refs/` に取得）

| リポジトリ | 主に参考にした設計 |
| --- | --- |
| `pierregoutheraud/volet` | OKLCH `@property --space-hue` 遷移、純粋 `deriveState`、SerialQueue 書き込み、Playwright `chrome.developerPrivate` 診断 |
| `lophas/arc-sidebar-chrome` | 実マウス左端ホバー検証パターン（rAF 0ペイント検査・graze 棄却・ドラッグ抑止・YouTube 10px / Reddit `:not(:defined)` 耐性・SPA 自己修復） |
| `winzipsdo/sidearc` | 繊細なタイポグラフィ・スクロールフェード・ホバー時の小さな閉じる丸ボタン |
| `nisargkolhe/arcify` | Bookmarks 永続化モデルと Arc 移行 UX |
| `Tanvir-rahman/spaces-plus` | Tab Groups を使った Space 分離と再起動復旧 |

---

## 6. Mac Studio での次の作業候補（優先順）

1. **実機 Brave での操作感ブラッシュアップ**:
   - 左端ホバーの感度・アニメーション速度・幅リサイズ・マルチディスプレイ左端エッジでの挙動を実機で確認し微調整。
   - ドラッグ＆ドロップ（Favorites 並べ替え、ピン留め ↔ フォルダ移動、一時タブ → Favorite / ピン留め、Space アイコンへのドロップ）の実機確認＋必要に応じて視覚的なドロップインジケータ強化。
2. **UI のさらなる Arc 忠実化（お好みで）**:
   - Space ヘッダーのダブルクリックリネーム／スペースアイコン変更ピッカー（`Change Space Icon...` で絵文字＋Arc アイコン一覧から選択）。
   - Space コンテキストメニューに「この Space に新規フォルダ」「Space を JSON エクスポート」等を追加。
   - トラックパッド横スワイプでの Space 切替（`wheel` 水平ジェスチャー）。
   - Favorite タイル／ピン留め行でのライブタイトル・未読／音声再生表現のさらなる磨き込み。
3. **OSS 公開前チェックリスト**:
   - `git log` に個人情報・トークン・スクショが一切混入していないことを最終確認。
   - `README.md` にダミーデータ版の綺麗なスクリーンショット／GIF を追加。
   - `main` の GitHub Actions CI（Linux Chromium 上での `check` + `check-extension` + `e2e`）が緑になることを確認してからリポジトリを Public 化。

---

## 7. 最新の検証ステータス（すべて exit code 0）

- `just check`: Biome format/lint 0 errors・0 warnings / TypeScript strict 0 errors / **Vitest 9 files, 31 tests passed**
- `just build`: `dist/sidepanel.html` + `dist/background.js` (6.49 kB gzip) + **`dist/overlay.js` (4.14 kB gzip, IIFE, ES import 0)**
- `just check-extension`: 実機 Brave にて `ok: true`（manifestErrors / runtimeErrors / consoleErrors / consoleWarnings / pageErrors すべて 0、ライブ reload 2 回）
- `just e2e`: 実機 Brave にて **13 / 13 passed**（ウィンドウ中央設定モーダル・二本指横スワイプ＆戻る/進む非競合・サイドバー外展開コンテキストメニュー・Space リネーム＆アイコンピッカー含む）
- `just visual-arc`: 本物 `StorableSidebar.json` インポート＋2x Retina 比較撮影完了
- OSS 公開準備: `docs/screenshots/` に 100% 合成ダミーデータによる 2x スクショ 4 枚を整備、`git log` 個人情報／トークン／`v2` 表記ゼロ監査済み
