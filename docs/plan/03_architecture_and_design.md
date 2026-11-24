# 03. アーキテクチャと設計

## 全体アーキテクチャ (Manifest V3)

本拡張機能は、Manifest V3のアーキテクチャに準拠して構築される。主要なコンポーネントは以下の通り。

- **Service Worker (background.js)**
  - イベント駆動で動作するバックグラウンドプロセス。
  - `chrome.tabs`, `chrome.bookmarks`, `chrome.storage` などのブラウザAPIを操作するビジネスロジックの中核を担う。
  - UIからのメッセージを受け取り、状態の変更や非同期処理を実行する。
  - パフォーマンスのため、長時間の処理や状態の保持は行わず、イベントがないときは速やかに休止状態に入るように設計する。

- **Side Panel (panel.html)**
  - 主なUIが表示される領域。垂直タブ、スペース一覧、お気に入りボックスなどがここに配置される。
  - Reactで構築され、ユーザー操作に応じてService Workerと通信する。
  - Service Workerが起動したタイミングで`chrome.sidePanel`の可否を判定し、非対応ブラウザではフォールバック用の表示手段に切り替える。

- **Options Page (options.html)**
  - 拡張機能の詳細な設定を行うためのページ。
  - ここでの変更は`chrome.storage.sync`に保存され、他のデバイスとも同期される。

- **Content Script**
  - Webページに注入され、「ページ内フローティングUI」や「ホットゾーン」を実現するために使用する。
  - ページのDOMを操作するが、その影響は最小限に留め、UIはShadow DOM内にレンダリングしてスタイル競合を防ぐ。
  - フォールバックモードでは、`chrome.sidePanel`が使えないブラウザ向けに、必要な箇所のみ簡易UI（ミニサイドバーやオーバーレイ）を提供する。

## UI表示モードの切り替え

1. **サイドパネルモード**（優先）
   - `chrome.sidePanel`が存在する場合は、Manifest V3のサイドパネルをメインUIとして使用する。
   - Reactアプリを `side_panel.default_path` で提供し、Service Worker を介したメッセージ通信で状態同期を行う。

2. **ツールバーポップアップ / 独立ウィンドウフォールバック**
   - `chrome.sidePanel` が未実装の場合は、`chrome.action` の `default_popup` として同一のReactアプリを読み込み、必要に応じて `chrome.windows.create({ type: 'popup' })` で独立ウィンドウを開く。
   - Service Worker が UI モードを判定し、ユーザー操作（キーボードショートカットやコンテキストメニュー）に対して適切な表示方法を選択する。

3. **ページ内フローティングUI**
   - ブラウザがポップアップの固定表示に制限を持つ場合、コンテンツスクリプトが Shadow DOM 内にコンパクトなフローティングUI を挿入する。
   - `chrome://` や拡張機能ページのようにコンテンツスクリプトが動作しないページでは、ポップアップ UI を案内する。

## データモデル

主要なデータ構造はTypeScriptのインターフェースとして定義し、型安全性を確保する。

- **`Space`**: ユーザーが作成する作業コンテキスト。タブの集合やブックマークフォルダと関連付けられる。
  ```typescript
  interface Space {
    id: string;
    name: string;
    color?: string;
    bookmarkFolderId?: string;
  }
  ```

- **`SearchItem`**: コマンドパレットで表示される検索結果の統一フォーマット。
  ```typescript
  interface SearchItem {
    id: string;
    kind: 'space' | 'tab' | 'history' | 'bookmark';
    title: string;
    subtitle?: string;
  }
  ```

## 状態管理 (Zustand)

- **採用理由**: 軽量でありながら、セレクタによるパフォーマンス最適化やミドルウェアのサポートなど、必要な機能が揃っているため、本プロジェクトの規模に最適と判断。Reduxとの併用は不要。
- **設計**:
  - **スライス分割**: `settingsSlice`, `spacesSlice`, `tabsSlice`のように、関心事ごとにストアを分割して管理する。
  - **セレクタ**: UIコンポーネントは、`useStore(state => state.someValue)`のようにセレクタを使い、必要なデータのみを購読することで、不要な再レンダリングを防ぐ。
  - **永続化**: 設定など、永続化が必要なデータは`chrome.storage` APIと連携する。Zustandのミドルウェアを使うか、ストアのアクション内で直接APIを呼び出す。

## 設定システム

ユーザーが多様なカスタマイズを行えるように、柔軟な設定システムを設計する。

- **スキーマ定義 (Zod)**: 設定の型とバリデーションルールを`zod`ライブラリで一元管理する。これにより、不正な設定値によるエラーを防ぎ、将来のマイグレーションを容易にする。
  ```typescript
  import { z } from 'zod';

  const FavoritesSettingsSchema = z.object({
    layout: z.enum(['grid', 'list']).default('grid'),
    itemSize: z.enum(['sm', 'md', 'lg']).default('md'),
  });
  ```

- **優先順位**: 設定は以下の優先順位で適用される。これにより、全体の設定をしつつ、特定のスペースだけ見た目を変えるといったカスタマイズが可能になる。
  1.  **セッション上書き**: 一時的な変更（クイック設定など）。
  2.  **スペース単位の上書き**: 特定のスペースにのみ適用される設定。
  3.  **グローバル設定**: アプリ全体のデフォルト設定。

- **UI**: 詳細な設定はオプションページで、頻繁に変更する項目（レイアウトやサイズなど）はサイドパネル内の「クイック設定」ポップアップで変更できるようにする。
