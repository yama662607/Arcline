## MODIFIED Requirements

### Requirement: Static assets SHALL live under the Vite public tree

拡張機能で配布するアイコンや静的ファイルは `extension/public/` 配下に置かれ、ビルド時にルートへコピーされなければならない (SHALL move with zero transforms)。

#### Scenario: Manifest references public icons

- **GIVEN** `public/icons/icon16.png` などが存在し
- **WHEN** manifest をビルドする
- **THEN** `action.default_icon` と `icons` は `icons/icon16.png` のように public ルート相対で参照され
- **AND** Chrome で読み込んだ際に 404 が発生しない

#### Scenario: Source tree path is updated after moving extension directory

- **GIVEN** the repository moves the extension package from `apps/extension/` to `extension/`
- **WHEN** developers place icons and static files in the Vite public tree
- **THEN** the canonical path MUST be `extension/public/` (not `apps/extension/public/`)
