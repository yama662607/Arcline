#!/bin/bash

# Arcline プレコミットフック
# Git コミット前に品質チェックを実行

set -e

# 色付け定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 プレコミット品質チェック${NC}"
echo "=================================="

# ステージされたファイルのチェック
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$' || true)

if [ -z "$STAGED_FILES" ]; then
  echo -e "${YELLOW}⚠️ ステージされたTypeScript/JavaScriptファイルがありません${NC}"
  exit 0
fi

echo -e "${YELLOW}📝 ステージされたファイル:${NC}"
echo "$STAGED_FILES"
echo ""

# 1. Lint チェック（ステージされたファイルのみ）
echo -e "${YELLOW}🔍 Lint チェック実行中...${NC}"
if echo "$STAGED_FILES" | xargs pnpm exec biome check --reporter=compact; then
  echo -e "${GREEN}✅ Lint チェック通過${NC}"
else
  echo -e "${RED}❌ Lint エラーが見つかりました${NC}"
  echo -e "${YELLOW}💡 'pnpm lint' で自動修正を試みてください${NC}"
  exit 1
fi

# 2. 型チェック
echo -e "${YELLOW}🔧 型チェック実行中...${NC}"
if pnpm typecheck; then
  echo -e "${GREEN}✅ 型チェック通過${NC}"
else
  echo -e "${RED}❌ 型エラーが見つかりました${NC}"
  exit 1
fi

# 3. 単体テスト（関連ファイルのみ）
echo -e "${YELLOW}🧪 単体テスト実行中...${NC}"

# 変更されたファイルに関連するテストファイルを見つける
TEST_PATTERNS=""
for file in $STAGED_FILES; do
  # ソースファイルに対応するテストファイルを探す
  if [[ "$file" =~ ^apps/extension/src/ ]]; then
    # src/ 以下のファイルの場合、対応するテストファイルを探す
    test_file=$(echo "$file" | sed 's|apps/extension/src/|apps/extension/src/|' | sed 's/\.\(ts\|tsx\)$/.test.\1/')
    if [ -f "$test_file" ]; then
      TEST_PATTERNS="$TEST_PATTERNS $test_file"
    fi

    # 同じディレクトリのテストファイルも含める
    dir=$(dirname "$file")
    test_files=$(find "$dir" -name "*.test.*" -o -name "*.spec.*" 2>/dev/null || true)
    TEST_PATTERNS="$TEST_PATTERNS $test_files"
  fi
done

if [ -n "$TEST_PATTERNS" ]; then
  echo -e "${BLUE}関連テストファイル: $TEST_PATTERNS${NC}"
  if pnpm test --run "$TEST_PATTERNS"; then
    echo -e "${GREEN}✅ 単体テスト通過${NC}"
  else
    echo -e "${RED}❌ 単体テスト失敗${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}⚠️ 関連するテストファイルがありません。すべてのテストを実行します...${NC}"
  if pnpm test; then
    echo -e "${GREEN}✅ 単体テスト通過${NC}"
  else
    echo -e "${RED}❌ 単体テスト失敗${NC}"
    exit 1
  fi
fi

# 4. ビルドチェック（重要な変更の場合）
IMPORTANT_FILES=$(echo "$STAGED_FILES" | grep -E '\.(ts|tsx)$' | grep -v '\.test\.' | grep -v '\.spec\.' || true)

if [ -n "$IMPORTANT_FILES" ]; then
  echo -e "${YELLOW}🏗️ ビルドチェック実行中...${NC}"
  if pnpm build; then
    echo -e "${GREEN}✅ ビルド成功${NC}"
  else
    echo -e "${RED}❌ ビルド失敗${NC}"
    exit 1
  fi
fi

# 5. コミットメッセージチェック
echo -e "${YELLOW}📝 コミットメッセージチェック実行中...${NC}"

# コミットメッセージを取得
COMMIT_MSG_FILE=".git/COMMIT_EDITMSG"
if [ -f "$COMMIT_MSG_FILE" ]; then
  COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

  # Conventional Commits チェック
  if [[ ! "$COMMIT_MSG" =~ ^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?: .+ ]]; then
    echo -e "${YELLOW}⚠️ コミットメッセージが Conventional Commits 形式ではありません${NC}"
    echo -e "${YELLOW}💡 推奨形式: type(scope): description${NC}"
    echo -e "${YELLOW}例: feat(ui): add new tab management feature${NC}"
    echo -e "${YELLOW}例: fix: resolve tab rendering issue${NC}"

    # 厳格モードの場合は拒否
    if [ "$1" = "--strict" ]; then
      echo -e "${RED}❌ 厳格モード: コミットメッセージの形式が正しくありません${NC}"
      exit 1
    fi
  else
    echo -e "${GREEN}✅ コミットメッセージ形式OK${NC}"
  fi
fi

echo ""
echo -e "${GREEN}🎉 プレコミットチェック完了！${NC}"
echo -e "${GREEN}✨ コミットしてもOKです！${NC}"
