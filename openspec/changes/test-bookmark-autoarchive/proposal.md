## Why
ブックマーク連携と自動アーカイブ機能の実装が完了したため、これらの新機能が正しく動作することを保証する包括的なテストスイートが必要です。

## What Changes
- ブックマーク同期機能の単体テストを追加
- 自動アーカイブ機能の単体テストを追加  
- E2Eテストで機能連携を検証
- テストカバレッジを80%以上に向上

## Impact
- Affected specs: background-services
- Affected code: src/background/services/bookmarks.ts, src/background/services/auto-archive.ts, src/background/services/browser.ts
