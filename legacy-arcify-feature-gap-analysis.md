# Legacy Arcify → Arcline 機能ギャップ分析

## 調査対象
- `legacy/arcify/` ディレクトリ以下の全ファイル
- `apps/extension/` の現在実装済み機能との比較

---

## 🚨 未実装の重要機能

### 1. **コンテキストメニュー**
**実装状況**: ❌ 未移植
**詳細**:
- 右クリックメニューからのタブ操作
- "Add to Favorites" / "Pin Tab" / "Unpin Tab"
- "Move to Space" サブメニュー
- "Archive Tab" / "Restore Tab"
- スペース削除機能

**根拠**:
- Legacy では `chrome.contextMenus` を `background.js` の起動時に登録しているのに対し、`apps/extension` では型定義以外の `chrome.contextMenus` 呼び出しが存在しない。

---

### 2. **オンボーディング画面**
**実装状況**: ❌ 未移植
**詳細**:
- インストール時に `onboarding.html` を開き、設定ガイドやFAQ/更新情報を案内

**根拠**:
- Legacy の `manifest.json` に `onboarding.html` / `onboarding.js` が含まれ、インストール時に起動しているが、`apps/extension` には `onboarding` 関連のエントリーやファイルが存在しない。

---

### 3. **スペースの高度なフォルダ/色管理**
**実装状況**: ⚠️ 部分的に未移植
**詳細**:
- スペース内フォルダ作成とドラッグ＆ドロップ整理
- フォルダ・スペースごとのカラー変更
- スペース名/色のインライン編集

**根拠**:
- Legacy の `sidebar.html` と `domManager.js` ではフォルダ作成・色変更UIがあるが、`apps/extension/src/ui` にフォルダや色編集に関するコンポーネント/ハンドラは見当たらない。

---

## ✅ Legacy から移植済みの主な機能

- **自動アーカイブ**: Alarms ベースのアイドル検出と設定 UI を Service Worker と React 側で実装済み。
- **ブックマーク連携**: スペースごとのフォルダ作成、重複フォルダのマージ、復元 API を `apps/extension/src/background/services/bookmarks.ts` に実装済み。
- **ピン留め/お気に入り/ドラッグ&ドロップ付きのタブ管理**: React UI と Service Worker 経由で移植済み。

---

## 📋 実装優先度提案

### 🔥 高優先度（必須機能）
1. **コンテキストメニュー** - 右クリック経由の操作導線を再現
2. **オンボーディング画面** - 初回体験と設定ガイドを提供
3. **スペースのフォルダ/色管理** - 情報整理と視覚的区別を拡充
