## Context

本 Change は `apps/extension` の責務分離を目的としたリファクタである。特に Service Worker（`src/background/index.ts`）の肥大化と、`chrome.*` 依存の散在が、変更影響範囲の拡大とテスト容易性の低下を招いている。

本 Change は進行中の別 Change（Spaces 層整理、UI mode single surface、MV3 E2E 安定化）と衝突しやすいため、「挙動は維持しつつ構造を整える」ことにスコープを限定する。

## Goals / Non-Goals

- Goals:

  - Service Worker エントリポイントを薄くし、ルーティング/イベント購読/handler 定義/初期化をモジュール分割できる状態にする
  - `chrome.*` 依存を adapter 境界に寄せられるようにし、ユニットテストでの差し替えが容易な構造にする
  - content script の責務境界を明確化し、注入/DOM 操作と React マウントを分離できる構造にする

- Non-Goals:
  - 仕様（振る舞い）の変更
  - Spaces ドメイン設計の再構成
  - UI mode single surface の仕様変更
  - MV3 E2E の拡張 ID 固定・keep-alive 方針の変更

## Decisions

- Decision: 「挙動維持」を優先し、段階移行（小さな移動単位）で分割する

  - Rationale: 進行中 Change との衝突を避け、回帰を抑えたまま構造改善を進めるため

- Decision: `chrome.*` は一括抽象化ではなく、最小の adapter 導入から始める

  - Rationale: 既存コードの依存箇所が多く、一度に置換すると差分が肥大化してレビュー/回帰リスクが増えるため

- Decision: 設定（Settings）の永続化は `chrome.storage.local` を正とし、`chrome.storage.sync` 依存を排除する

  - Rationale: 端末間同期を非ゴールとし、クォータ・反映遅延・デバッグ難度の増加を避けるため

- Decision: 設定変更は `chrome.storage.onChanged`（local）を起点に副作用（UI mode / auto-archive）を即時反映する

  - Rationale: MV3 のサービスワーカーライフサイクル下でも、設定変更の反映漏れを減らすため

- Decision: ログ/エラーの文言や出力箇所は互換性要件に含めない
  - Rationale: 構造変更に付随する差分として許容し、機能的挙動の維持を主眼とする

## Risks / Trade-offs

- リファクタによる import/初期化順序の変化で、イベント購読や broadcast タイミングが変わるリスク

  - Mitigation: 変更単位を小さくし、既存テストと E2E で回帰検出する

- 進行中 Change と同一ファイルに触れることでコンフリクトが増えるリスク
  - Mitigation: entrypoint 分割を先に行い、以後の作業での衝突面積を減らす

## Migration Plan

- 既存の外部 I/F（Bridge メッセージ/command）を維持したまま内部構造を分割する
- 1PR 内での差分を小さく保ち、段階的に移行する
- 設定について、既存ユーザーのデータ保護のため初回のみ `chrome.storage.sync` → `chrome.storage.local` の移行を許容する

## Open Questions

- adapter 層の粒度（runtime/tabs/storage 等）をどこまで初回に含めるか
- content script 側の分割を今回どこまで行い、UI mode single surface の Change とどう切り分けるか
