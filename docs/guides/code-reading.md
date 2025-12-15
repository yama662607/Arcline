# Arcline コードリーディングガイド

Arcline (React/TypeScript 版) の設計意図とコードを読み進める際のポイントをまとめたガイドです。旧 Arcify (バニラ JS) との対応関係にも触れ、どのファイルがどの責務を担当するかを俯瞰できるようにしています。

## 1. 全体構成の把握

```
extension/
├── manifest.config.ts      # Manifest V3 を生成する設定 (CRXJS)
├── src
│   ├── background/         # Service Worker (Manifest V3)
│   ├── shared/             # サービス間で共有する型定義
│   ├── lib/                # フロントエンド用ヘルパー (UI mode, tabs API 等)
│   ├── store/              # Zustand ストア (spaces, tabs, settings) + chrome.storage 永続化
│   └── ui/                 # React コンポーネント (SpaceList, TabList など)
└── vite.config.ts          # Vite + React + CRXJS のビルド設定

legacy/arcify/              # 旧バニラ実装 (参考用に保管)
```

- **背景**: Arcify は `background.js` と `sidebar.js` にロジックが集中していたため、Arcline では責務ごとに分割し、テスト・拡張しやすい構造に改めています。
- **ワークスペース**: `pnpm` のワークスペースで管理。新コードは `extension` に置き、legacy は `legacy/arcify` として参照用に残しています。

## 2. Service Worker (background)

### 2.1 `manifest.config.ts`

- CRXJS の `defineManifest` で Chrome 拡張の Manifest V3 を生成。
- sidePanel / popup フォールバックを切り替えられるようにする土台。

### 2.2 `src/background/index.ts`

- 旧 Arcify の `background.js` を TypeScript 化・再構成したもの。
- 主な責務:
  - ブラウザ起動時に UI モード (`side-panel` or `popup`) を判定し、`chrome.storage.local` に保存。
  - `runtime.onMessage` で UI からのリクエストを受け、サービス層 (`services/browser.ts`) を呼び出す。
  - タブ/ウィンドウ/タブグループのイベントを監視し、スペーススナップショットを `runtime.sendMessage` でブロードキャスト。

### 2.3 `src/background/services/browser.ts`

- Chrome API をラップする層。旧 Arcify の `utils.js` や `LocalStorage` 相当の機能を TypeScript/Promise ベースで整理。
- 主なメソッド:
  - `getSpacesSnapshot()` : タブグループ + タブ情報を `SpaceSnapshot` に変換。
  - `toggleTabPinned`, `moveTabToSpace`, `createSpace`, `removeSpace`, `closeTab`, `activateTab` などタブとスペース操作。
  - `broadcastSpacesSnapshot()` : スナップショットを UI に通知。
- 今後の移植対象: ブックマーク同期、アーカイブ、タブ名上書きなど。

## 3. フロントエンド (React UI)

### 3.1 Zustand ストア (`src/store/`)

- `spacesSlice.ts`: サイドパネルのスペース状態を管理。Service Worker から受け取った `SpaceSnapshot` を保持し、アクティブスペースを追跡。
- `tabsSlice.ts`, `settingsSlice.ts`: 将来的なタブ操作やオプション画面に向けたストア。`chrome.storage` と同期するため `persist.ts` がラッパーとして提供される。
- `persist.ts`: `chrome.storage.local` を利用可能な場合はそこで永続化し、無い場合は `localStorage` もしくはメモリにフォールバック。

### 3.2 ヘルパー (`src/lib/`)

- `ui-mode.ts`: UI モード (`side-panel` or `popup`) を Service Worker から問い合わせ、存在しない場合はデフォルト。
- `spaces.ts`: 初期ロードや Service Worker から push されたスペース情報を受け取る。
- `tabs.ts`: フロントエンドからタブ操作を発火するメッセージ送信ラッパー。
- `utils.ts`: ランタイム存在チェックなど小さなユーティリティ。

### 3.3 UI コンポーネント (`src/ui/`)

- `SpaceList`: スペース一覧（タブグループ）を表示。Zustand から `spaces` と `activeSpaceId` を購読。
- `TabList`: ピン留め／一時タブをそれぞれ描画。`@tanstack/react-virtual` で大量タブでも高速に描画。右クリックで `TabContextMenu` を表示。
- `TabContextMenu`: ピン切替、スペース移動、タブクローズ、アクティブ化などを Service Worker 経由で実行。これにより、旧 Arcify の DOM ベースのコンテキストメニューを React で再現。
- 今後予定: DnD (`@dnd-kit/core`)、アニメーション（Framer Motion）、Headless UI / shadcn/ui の導入。

### 3.4 `App.tsx`

- サイドパネル UI のプレースホルダ。今後、スペース切替トグルや検索、クイックアクションなどを追加。
- 現段階では:
  - 起動時に UI モードを問い合わせ。
  - スペーススナップショットを Service Worker から受信して Zustand に反映。
  - アクティブスペースのタブ一覧を `TabList` で表示。

## 4. Legacy (Arcify) との対応表

| Arcify (旧)               | Arcline (新)                                                     |
| ------------------------- | ---------------------------------------------------------------- |
| `background.js`           | `src/background/index.ts` + `services/browser.ts`                |
| `sidebar.js`              | `src/App.tsx`, `ui/components/`, `store/`                        |
| `utils.js`                | `services/browser.ts`, `lib/tabs.ts`, 今後 `lib/bookmarks.ts` 等 |
| `localstorage.js`         | 未移植 (今後 `services/bookmarks.ts` 等へ分割予定)               |
| DOM イベント＋ HTML       | React コンポーネント＋ Tailwind ＋ Headless UI                   |
| `Arcify` ブックマーク同期 | 今後フェーズ 6 で TypeScript 化予定                              |
| 自動アーカイブ            | 今後フェーズ 6 で移植予定                                        |

## 5. 行動指針（コードリーディング手順）

1. **Service Worker から読む**

   - `manifest.config.ts` → `background/index.ts` → `background/services/browser.ts`
   - どのメッセージがどの Chrome API ラッパーを叩くかを把握する。

2. **React UI でのデータフローを確認**

   - `lib/spaces.ts` でスナップショット取得 → `store/spacesSlice.ts` → `SpaceList`/`TabList` で表示。
   - `TabContextMenu` → `lib/tabs.ts` → Service Worker のコマンド呼び出しという往復を追う。

3. **Zustand ストアの設計意図を理解**

   - `persist.ts` を通して `chrome.storage` と連携。ステートの最小永続化 (activeSpace など) を確認。
   - 今後設定フォームやアーカイブ移植時に同じパターンを拡張する予定。

4. **未移植機能の洗い出しを並行してメモ**

   - `openspec/changes/refactor-react-migration/tasks.md` のステータスで進行中のタスクを確認。
   - フェーズ 6 (ブックマーク同期・アーカイブ) やフェーズ 7 (コンテキストメニュー/ショートカット) との対応付けを意識する。

5. **Legacy との参照**
   - `legacy/arcify/` の同名ファイルを開き、ロジックやデータ構造を照らし合わせる。
   - 例: `legacy/arcify/domManager.js` のタブ操作 → `TabList`/`TabContextMenu` の移植内容。

## 6. 今後の実装観点

- **ブックマーク連携**: `chrome.bookmarks` API を TypeScript 化し、Arcify の `LocalStorage` ロジックを分割して再実装する。
- **自動アーカイブ**: `Utils.addArchivedTab` などの処理を `services/archive.ts` 等に切り出す予定。
- **フォーム／設定 UI**: React Hook Form + Zod, Headless UI を使った設定画面を作る予定。
- **DnD & アニメーション**: `@dnd-kit/core`, Framer Motion を導入し、Arc の滑らかな UX に近づける。
- **フォールバック UI**: sidePanel が使えないブラウザのために popup/window/floating UI を実装する。

---

このガイドを踏まえ、`background`→`store`→`ui` の順に読み進めるとデータフローと責務が理解しやすくなります。legacy との比較を適宜行い、移行済み／未移行のロジックを把握しながら学習を進めてください。
