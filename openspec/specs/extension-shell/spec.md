# Extension Shell Specification

## Requirements

### Requirement: Static assets SHALL live under the Vite public tree
拡張機能で配布するアイコンや静的ファイルは `apps/extension/public/` 配下に置かれ、ビルド時にルートへコピーされなければならない (SHALL move with zero transforms)。

#### Scenario: Manifest references public icons
- **GIVEN** `public/icons/icon16.png` などが存在し
- **WHEN** manifest をビルドする
- **THEN** `action.default_icon` と `icons` は `icons/icon16.png` のように public ルート相対で参照され
- **AND** Chrome で読み込んだ際に 404 が発生しない

### Requirement: Popup entrypoint SHALL be defined as a dedicated HTML page
Popup UI は `public/popup.html` から `src/popup/index.tsx` を読み込み、`@crxjs` が生成するバンドルに含まれなければならない (SHALL keep a single entry)。

#### Scenario: Popup loads React bundle from root script tag
- **GIVEN** Vite dev server またはビルド成果物
- **WHEN** popup を開く
- **THEN** `<script type="module" src="/src/popup/index.tsx">` が読み込まれ
- **AND** `#app` へ `PopupApp` がマウントされる

### Requirement: Options page SHALL exist as an accessible React surface
拡張機能は `public/options.html` + `src/options/index.tsx` を提供し、manifest の `options_page` で遷移できる必要がある (SHALL expose an options surface)。

#### Scenario: Options page renders settings shell
- **GIVEN** ユーザーが chrome://extensions 経由で「拡張機能のオプション」を開く
- **WHEN** options.html がロードされる
- **THEN** 基本的な React/Tailwind レイアウト（ヘッダー、設定セクション、フォームプレースホルダ）が表示され
- **AND** フォーム送信ハンドラは `preventDefault` で保護されたダミー実装として存在する
