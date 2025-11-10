# Design Brief: React/TypeScript Migration

## Overview
- React + TypeScript + Vite + Tailwind + Headless UI を採用し、Manifest V3 拡張として Atlas/Arc/Chrome に対応した共通 UI 基盤を構築する。
- Zustand によるストアと `services/browser` モジュールで business logic / API 呼び出しを分離し、UI から直接 Chrome API を叩かない構成にする。
- React Hook Form + Zod Resolver でフォームと設定を型安全に扱う。shadcn/ui は必要なコンポーネントから段階的に取り込む。
- UI 表示モードは Service Worker で判定し、sidePanel・popup・window・floating フォールバックの 4 モードを同一 React アプリで運用する。

## Architecture
```
apps/extension
├── manifest.config.ts (環境ごとにフィーチャーフラグを注入)
├── src/
│   ├── background/
│   │   ├── index.ts           # Service Worker エントリ
│   │   └── services/
│   │       └── browser.ts     # tabs / tabGroups / bookmarks ラッパー
│   ├── ui/
│   │   ├── main-sidepanel.tsx # sidePanel 用エントリ
│   │   ├── main-popup.tsx     # popup/window 用エントリ
│   │   ├── components/        # Tailwind + Headless UI ベースのコンポーネント群
│   │   ├── hooks/
│   │   └── styles/
│   ├── content/
│   │   └── floating-ui.tsx    # Shadow DOM ベースのミニサイドバー
│   └── store/
│       ├── index.ts
│       ├── tabsSlice.ts
│       ├── spacesSlice.ts
│       └── settingsSlice.ts
└── tests/
    ├── unit/
    └── e2e/
```

## Key Decisions
- **Bridge レイヤー**: Service Worker から UI へは `chrome.runtime.sendMessage` / `chrome.runtime.onMessage` を用いたイベント駆動で同期。UI 側は custom hook (`useChromeBridge`) を経由してストア更新。
- **Storage Sync**: Zustand ミドルウェアで `chrome.storage.sync`/`local` へ永続化し、タブ情報など volatile データはメモリストアのみで管理。非同期データ取得が複雑になった段階で TanStack Query を追加し、Service Worker ブリッジ経由でキャッシュ/API 呼び出しを扱う。
- **Feature Detection**: Service Worker 初期化時に `chrome.sidePanel` の有無を判定し、`storage.local` に UI モードを保存。UI エントリポイントはモードに応じて読み分ける。
- **Testing**:
  - Unit: Vitest + React Testing Library。
  - Integration: Playwright を用いて sidePanel / popup / window / floating をシミュレート。
  - Manual: Atlas / Arc / Chrome / Brave で週次スモークテスト。

## Outstanding Topics
- フローティング UI の UX 最適化（Atlas でのホットゾーン仕様との衝突を避ける）。
- Tailwind CSS を採用し、`@tailwindcss/forms`, `@tailwindcss/typography`, `clsx` / `tailwind-merge` などでユーティリティクラス管理を行う。
- Headless UI, Radix UI, Framer Motion などのモダンライブラリをコンポーネント/アニメーションに活用する可能性を検討。
- Atlas の AI エージェント API が公開された場合のモジュール分割。
- ビルド出力のサイズ監視とコード分割戦略（React.lazy + dynamic import など）。
