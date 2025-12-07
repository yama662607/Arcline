#!/bin/bash

# Arcline 品質チェックスクリプト
# 使用方法: ./scripts/quality-check.sh [options]

set -e

# 色付け定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# オプション解析
STRICT=false
COVERAGE=false
E2E=false
HELP=false

for arg in "$@"; do
  case $arg in
    --strict)
      STRICT=true
      ;;
    --coverage)
      COVERAGE=true
      ;;
    --e2e)
      E2E=true
      ;;
    --all)
      STRICT=true
      COVERAGE=true
      E2E=true
      ;;
    --help|-h)
      HELP=true
      ;;
  esac
done

# ヘルプ表示
if [ "$HELP" = true ]; then
  echo "Arcline 品質チェックスクリプト"
  echo ""
  echo "使用方法: $0 [options]"
  echo ""
  echo "オプション:"
  echo "  --strict    厳格モードでチェックを実行"
  echo "  --coverage  カバレッジレポートを生成"
  echo "  --e2e       E2Eテストを実行"
  echo "  --all       すべてのチェックを実行"
  echo "  --help      このヘルプを表示"
  echo ""
  exit 0
fi

echo -e "${BLUE}🔍 Arcline 品質チェック開始${NC}"
echo "=================================="

# スクリプト開始時間
START_TIME=$(date +%s)

# 1. 依存関係チェック
echo -e "${YELLOW}📦 依存関係をチェック中...${NC}"
if ! command -v pnpm &> /dev/null; then
  echo -e "${RED}❌ pnpm がインストールされていません${NC}"
  exit 1
fi

if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js がインストールされていません${NC}"
  exit 1
fi

echo -e "${GREEN}✅ 依存関係は正常です${NC}"

# 2. パッケージインストール
echo -e "${YELLOW}📥 依存関係をインストール中...${NC}"
pnpm install --frozen-lockfile
echo -e "${GREEN}✅ 依存関係がインストールされました${NC}"

# 3. Lint チェック
echo -e "${YELLOW}🔍 Lint チェック実行中...${NC}"
if pnpm lint; then
  echo -e "${GREEN}✅ Lint チェック通過${NC}"
else
  echo -e "${RED}❌ Lint エラーが見つかりました${NC}"
  if [ "$STRICT" = true ]; then
    exit 1
  fi
fi

# 4. フォーマットチェック
echo -e "${YELLOW}📝 フォーマットチェック実行中...${NC}"
if pnpm format; then
  echo -e "${GREEN}✅ フォーマットチェック通過${NC}"
else
  echo -e "${RED}❌ フォーマットエラーが見つかりました${NC}"
  if [ "$STRICT" = true ]; then
    exit 1
  fi
fi

# 5. 型チェック
echo -e "${YELLOW}🔧 型チェック実行中...${NC}"
if pnpm typecheck; then
  echo -e "${GREEN}✅ 型チェック通過${NC}"
else
  echo -e "${RED}❌ 型エラーが見つかりました${NC}"
  if [ "$STRICT" = true ]; then
    exit 1
  fi
fi

# 6. 単体テスト
echo -e "${YELLOW}🧪 単体テスト実行中...${NC}"
if [ "$COVERAGE" = true ]; then
  if pnpm test; then
    echo -e "${GREEN}✅ 単体テスト通過${NC}"
  else
    echo -e "${RED}❌ 単体テスト失敗${NC}"
    if [ "$STRICT" = true ]; then
      exit 1
    fi
  fi
else
  if pnpm test; then
    echo -e "${GREEN}✅ 単体テスト通過${NC}"
  else
    echo -e "${RED}❌ 単体テスト失敗${NC}"
    if [ "$STRICT" = true ]; then
      exit 1
    fi
  fi
fi

# 7. ビルドチェック
echo -e "${YELLOW}🏗️ ビルドチェック実行中...${NC}"
if pnpm build; then
  echo -e "${GREEN}✅ ビルド成功${NC}"
else
  echo -e "${RED}❌ ビルド失敗${NC}"
  if [ "$STRICT" = true ]; then
    exit 1
  fi
fi

# 8. E2Eテスト（オプション）
if [ "$E2E" = true ]; then
  echo -e "${YELLOW}🎭 E2Eテスト実行中...${NC}"
  if pnpm test:e2e:headless; then
    echo -e "${GREEN}✅ E2Eテスト通過${NC}"
  else
    echo -e "${RED}❌ E2Eテスト失敗${NC}"
    if [ "$STRICT" = true ]; then
      exit 1
    fi
  fi
fi

# 9. セキュリティチェック
echo -e "${YELLOW}🔒 セキュリティチェック実行中...${NC}"
if command -v audit-ci &> /dev/null; then
  if audit-ci --moderate; then
    echo -e "${GREEN}✅ セキュリティチェック通過${NC}"
  else
    echo -e "${YELLOW}⚠️ セキュリティ警告があります${NC}"
  fi
else
  echo -e "${YELLOW}⚠️ audit-ci がインストールされていません。セキュリティチェックをスキップします。${NC}"
fi

# 10. バンドルサイズチェック
echo -e "${YELLOW}📊 バンドルサイズチェック実行中...${NC}"
if [ -d "apps/extension/dist" ]; then
  BUNDLE_SIZE=$(du -sh apps/extension/dist | cut -f1)
  echo -e "${GREEN}✅ バンドルサイズ: $BUNDLE_SIZE${NC}"

  # サイズ警告（10MB超過 - macOS対応）
  SIZE_BYTES=$(du -sk apps/extension/dist | cut -f1)
  if [ "$SIZE_BYTES" -gt 10240 ]; then
    echo -e "${YELLOW}⚠️ バンドルサイズが大きいです: $BUNDLE_SIZE${NC}"
  fi
else
  echo -e "${RED}❌ ビルド成果物が見つかりません${NC}"
fi

# 終了時間計算
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# 結果サマリー
echo ""
echo "=================================="
echo -e "${GREEN}🎉 品質チェック完了！${NC}"
echo -e "${BLUE}実行時間: ${DURATION}秒${NC}"

if [ "$COVERAGE" = true ]; then
  echo -e "${BLUE}📊 カバレッジレポート: apps/extension/coverage/index.html${NC}"
fi

if [ "$E2E" = true ]; then
  echo -e "${BLUE}🎭 E2Eレポート: apps/extension/playwright-report/index.html${NC}"
fi

echo -e "${GREEN}✨ すべてのチェックが完了しました！${NC}"
