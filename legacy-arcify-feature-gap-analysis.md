# Legacy Arcify → Arcline 機能ギャップ分析

> **Note**: `legacy/arcify` was updated to the latest upstream version on 2025-12-16. This analysis is based on that version vs current `extension` implementation.

## 調査対象
- `legacy/arcify/` (Upstream latest)
- `extension/` (Current implementation)

---

## 🚨 未実装・不完全な重要機能

### 1. **コンテキストメニュー**
**実装状況**: ❌ 未実装 (Current)
**詳細**:
- `extension/manifest.config.ts` に `contextMenus` 権限はあるが、`src/background/index.ts` に実装コードが皆無。
- Legacy (`legacy/arcify/background.js`) には `chrome.contextMenus.create` や `onClicked` のロジックが存在する（ただし Legacy の `manifest.json` では権限が欠落しており、実際には動作していない可能性が高い）。
- **推奨**: Legacy のロジックを参考に、Tab, Link, Selection 等へのコンテキストメニューを Current に正式実装する。

### 2. **オンボーディング画面**
**実装状況**: ❌ 未実装
**詳細**:
- Legacy には `onboarding.html`, `installation-onboarding.html` があり、インストール時にガイドを表示するフローがある。
- Current の `background/index.ts` では `onInstalled` で `initializeUiMode` 等を行うのみで、UI を開く処理がない。

### 3. **コマンドパレット (Spotlight) の機能不足**
**実装状況**: ⚠️ 部分的実装
**詳細**:
- **Legacy**: `spotlight/` ディレクトリ配下に独立した UI (`overlay.js`, `newtab.html`) を持ち、Google 検索連携、計算機機能、Suggestions (Autocomplete) を `background.js` 経由で提供。
- **Current**: `src/floating/CommandPalette.tsx` が存在するが、検索対象は内部リソース（Tabs, Bookmarks, History, Spaces）に限定されている。Web 検索 (`chrome.search`) 連携や、"New Tab" モード vs "Current Tab" モードの使い分けが欠落している。

### 4. **キーボードショートカットの欠落**
**実装状況**: ⚠️ 一部欠落
**詳細**:
- Legacy に存在し Current にないもの:
    - `NextTabInSpace` / `PrevTabInSpace` (スペース内タブ循環)
    - `toggleSpotlightNewTab` (Spotlight を新しいタブモードで開く)
    - `copyCurrentUrl`
- Current の `manifest.config.ts` は `quickPinToggle`, `toggleCommandPalette`, `_execute_action` のみ。

### 5. **スペースの高度な管理 (フォルダ)**
**実装状況**: ⚠️ Backendのみ実装の可能性
**詳細**:
- Current の `shared/types.ts` (`PinnedFolder`) や `commandHandlers` (`createPinnedFolder`) はフォルダ構造をサポートしているように見える。
- しかし、UI 側 (`ui/`, `floating/`) でフォルダ作成やドラッグ＆ドロップでの整理を行う機能が明示的に見当たらない（Legacy `sidebar.js` 相当の複雑なD&Dロジック）。

---

## ✅ 実装が進んでいる機能 (Backend)

- **自動アーカイブ**: `background/services/auto-archive.ts` に実装済み。
- **スペース/タブ管理**: `background/services/browser.ts` に `createSpace`, `moveTabToSpace` 等のコアロジックは実装済み。
- **設定管理**: `settings` 関連は移植されている。

---

## 📋 実装優先度提案 (改訂版)

### 🔥 Phase 1: コア体験の補完
1. **コンテキストメニューの実装**: ユーザー操作の起点として必須。Legacy のコード (`background.js`) を `extension/src/background/handlers/context-menu-handlers.ts` (新規作成) へ移植。
2. **ショートカットの追加**: `Next/PrevTabInSpace` は操作性に直結するため優先的に追加。

### 🚧 Phase 2: 機能の深化
3. **Command Palette の Web 検索統合**: 単なるタブスイッチャーからランチャーへ進化させる。
4. **オンボーディングの実装**: 新規ユーザー向けの導入フロー作成。

### 🎨 Phase 3: UI/UX リッチ化
5. **スペース内フォルダ管理 UI**: Backend 機能を UI に繋ぎこむ。

---

## 🛠 技術スタックと開発フィロソフィの比較

### 1. Legacy (`arcify`)
- **Core**: Vanilla JavaScript (ES Modules), 直接的な DOM 操作 (`document.getElementById`, `innerHTML`).
- **Build**: Vite (Basic).
- **Architecture**:
    - **Monolithic**: `sidebar.js` (180KB+) にビジネスロジックとイベントハンドリングが集中。
    - **Imperative**: UI の状態更新を手続き的に記述。複雑化するとバグの温床になりやすい。
- **Quality**: テストコードなし。型安全性なし (JS)。

### 2. Current (`Arcline`)
- **Core**: React 19, TypeScript, Tailwind CSS.
- **Libraries**:
    - **State**: `Zustand` (Global State), `TanStack Query` (Async Data).
    - **UI**: `Radix UI` (Headless/Accessible), `Framer Motion` (Animation), `Lucide` (Icons).
    - **Utils**: `cmdk` (Command Palette), `dnd-kit` (Drag & Drop), `zod` (Validation).
- **Architecture**:
    - **Component-Based**: UI を小さな再利用可能な部品 (`components/`) に分割。
    - **Declarative**: React による宣言的 UI。State と View の同期が自動化され、堅牢。
    - **Type Safe**: TypeScript による静的解析で、コンパイル時にエラーを排除。
- **Quality**:
    - **Lint/Format**: `Biome`.
    - **Tests**: `Vitest` (Unit), `Playwright` (E2E), `Lighthouse CI` (Performance).

### 💡 結論と方針
**Arcline (Current) のアーキテクチャを採用・維持する。**
Legacy コードは「仕様書」「ロジックの参考書」としてのみ利用し、コードベースとしての採用は行わない。
特に `sidebar.js` のような巨大なファイルを移植するのではなく、その中のロジック（例: Chrome API の呼び出し順序、エッジケースの処理）を抽出し、React Hooks や Service Worker の分離されたモジュールとして再実装する。
