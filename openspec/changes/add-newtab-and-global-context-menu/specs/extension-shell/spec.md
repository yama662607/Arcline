## ADDED Requirements

### Requirement: New Tab override SHALL be provided as a dedicated HTML entry

拡張機能は `chrome_url_overrides.newtab` を用いて、ブラウザの新規タブを Arcline の新規タブページへ置き換えなければならない (SHALL provide a new tab integration)。
新規タブページは `public/newtab.html` + React エントリポイント（例: `src/newtab/index.tsx`）として提供されなければならない (SHALL be a dedicated entry)。

#### Scenario: New tab opens Arcline surface

- **GIVEN** 拡張機能がインストールされている
- **WHEN** ユーザーが新規タブを開く
- **THEN** Arcline の新規タブページが表示される
- **AND** React アプリが `#app`（または同等の root）にマウントされる

#### Scenario: New tab entry is accessible and loads without console errors

- **GIVEN** ユーザーが新規タブページを開く
- **WHEN** 画面がレンダリングされる
- **THEN** キーボード操作で主要 UI にフォーカス可能である
- **AND** 致命的なエラーで UI が崩壊しない

### Requirement: New Tab surface SHALL provide a home UI that can launch Command Palette

新規タブページは、最初から Command Palette を強制表示するのではなく、ホーム画面を表示し、ユーザーが Command Palette を起動できる導線を提供しなければならない (SHALL provide a home-first new tab experience)。

#### Scenario: Home page launches Command Palette

- **GIVEN** ユーザーが新規タブページを開いている
- **WHEN** ユーザーがホーム画面の導線（ボタン/ショートカット）で Command Palette を起動する
- **THEN** Command Palette が表示される

### Requirement: New Tab override SHALL be user-configurable

拡張機能は新規タブ統合をユーザーが有効/無効にできる設定を提供しなければならない (SHALL be configurable)。

#### Scenario: User disables new tab override

- **GIVEN** ユーザーが設定で新規タブ統合を無効にする
- **WHEN** ユーザーが新規タブを開く
- **THEN** Arcline の新規タブページが表示されない
- **AND** フォールバック動作（既定の新規タブ相当）が成立する

#### Scenario: Fallback navigates to the default new tab page

- **GIVEN** ユーザーが設定で新規タブ統合を無効にする
- **AND** ユーザーが Arcline の新規タブページを開いている
- **WHEN** 新規タブページがフォールバックを要求する
- **THEN** background が現在タブを `chrome://new-tab-page/` へ遷移させる
- **AND** 必要に応じて互換フォールバック（例: `chrome-search://local-ntp/local-ntp.html`）を試行する
