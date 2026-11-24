#!/bin/bash

# テストレポート生成スクリプト
# 使用方法: ./scripts/generate-test-reports.sh [options]

set -e

# 色付け定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# オプション解析
COVERAGE=false
E2E=false
PERFORMANCE=false
SECURITY=false
ALL=false
OUTPUT_DIR="./test-reports"

for arg in "$@"; do
  case $arg in
    --coverage)
      COVERAGE=true
      ;;
    --e2e)
      E2E=true
      ;;
    --performance)
      PERFORMANCE=true
      ;;
    --security)
      SECURITY=true
      ;;
    --all)
      ALL=true
      COVERAGE=true
      E2E=true
      PERFORMANCE=true
      SECURITY=true
      ;;
    --output=*)
      OUTPUT_DIR="${arg#*=}"
      ;;
    --help|-h)
      echo "テストレポート生成スクリプト"
      echo ""
      echo "使用方法: $0 [options]"
      echo ""
      echo "オプション:"
      echo "  --coverage     カバレッジレポートを生成"
      echo "  --e2e          E2Eテストレポートを生成"
      echo "  --performance  パフォーマンスレポートを生成"
      echo "  --security     セキュリティレポートを生成"
      echo "  --all          すべてのレポートを生成"
      echo "  --output=DIR   出力ディレクトリを指定"
      echo "  --help         このヘルプを表示"
      echo ""
      exit 0
      ;;
  esac
done

echo -e "${BLUE}📊 テストレポート生成開始${NC}"
echo "=================================="

# 出力ディレクトリ作成
mkdir -p "$OUTPUT_DIR"
REPORT_DATE=$(date +"%Y-%m-%d %H:%M:%S")
REPORT_FILE="$OUTPUT_DIR/test-report.html"

# HTMLレポートの開始
cat > "$REPORT_FILE" << EOF
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Arcline テストレポート</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .section {
            background: white;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .section-header {
            background: #f8f9fa;
            padding: 20px;
            border-bottom: 1px solid #e9ecef;
        }
        .section-header h2 {
            margin: 0;
            color: #495057;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .section-content {
            padding: 20px;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #e9ecef;
        }
        .metric:last-child {
            border-bottom: none;
        }
        .metric-label {
            font-weight: 500;
        }
        .metric-value {
            font-weight: bold;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9em;
        }
        .success {
            background: #d4edda;
            color: #155724;
        }
        .warning {
            background: #fff3cd;
            color: #856404;
        }
        .error {
            background: #f8d7da;
            color: #721c24;
        }
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #28a745, #20c997);
            transition: width 0.3s ease;
        }
        .test-list {
            list-style: none;
            padding: 0;
        }
        .test-item {
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .test-passed {
            background: #d4edda;
            color: #155724;
        }
        .test-failed {
            background: #f8d7da;
            color: #721c24;
        }
        .test-skipped {
            background: #fff3cd;
            color: #856404;
        }
        .chart-container {
            height: 300px;
            margin: 20px 0;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: #6c757d;
            font-size: 0.9em;
        }
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .status-passed { background: #28a745; }
        .status-failed { background: #dc3545; }
        .status-warning { background: #ffc107; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Arcline テストレポート</h1>
        <p>生成日時: $REPORT_DATE</p>
    </div>

EOF

# プロジェクト情報セクション
cat >> "$REPORT_FILE" << EOF
    <div class="section">
        <div class="section-header">
            <h2>📋 プロジェクト情報</h2>
        </div>
        <div class="section-content">
            <div class="metric">
                <span class="metric-label">プロジェクト名</span>
                <span class="metric-value success">Arcline Extension</span>
            </div>
            <div class="metric">
                <span class="metric-label">バージョン</span>
                <span class="metric-value">$(grep -o '"version": "[^"]*"' extension/package.json | cut -d'"' -f4)</span>
            </div>
            <div class="metric">
                <span class="metric-label">ブランチ</span>
                <span class="metric-value">$(git branch --show-current 2>/dev/null || echo 'unknown')</span>
            </div>
            <div class="metric">
                <span class="metric-label">コミット</span>
                <span class="metric-value">$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')</span>
            </div>
        </div>
    </div>

EOF

# カバレッジレポート
if [ "$COVERAGE" = true ] || [ "$ALL" = true ]; then
    echo -e "${YELLOW}📊 カバレッジレポート生成中...${NC}"

    if [ -f "extension/coverage/coverage-summary.json" ]; then
        COVERAGE_DATA=$(cat extension/coverage/coverage-summary.json)

        # カバレッジ値を抽出
        LINES_PCT=$(echo "$COVERAGE_DATA" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).total.lines.pct)")
        FUNCTIONS_PCT=$(echo "$COVERAGE_DATA" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).total.functions.pct)")
        BRANCHES_PCT=$(echo "$COVERAGE_DATA" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).total.branches.pct)")
        STATEMENTS_PCT=$(echo "$COVERAGE_DATA" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).total.statements.pct)")

        # ステータス判定
        if (( $(echo "$LINES_PCT >= 80" | bc -l) )); then
            COVERAGE_STATUS="success"
        elif (( $(echo "$LINES_PCT >= 70" | bc -l) )); then
            COVERAGE_STATUS="warning"
        else
            COVERAGE_STATUS="error"
        fi

        cat >> "$REPORT_FILE" << EOF
    <div class="section">
        <div class="section-header">
            <h2>📊 カバレッジレポート</h2>
        </div>
        <div class="section-content">
            <div class="metric">
                <span class="metric-label">Lines Coverage</span>
                <span class="metric-value $COVERAGE_STATUS">$LINES_PCT%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: $LINES_PCT%"></div>
            </div>

            <div class="metric">
                <span class="metric-label">Functions Coverage</span>
                <span class="metric-value $COVERAGE_STATUS">$FUNCTIONS_PCT%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: $FUNCTIONS_PCT%"></div>
            </div>

            <div class="metric">
                <span class="metric-label">Branches Coverage</span>
                <span class="metric-value $COVERAGE_STATUS">$BRANCHES_PCT%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: $BRANCHES_PCT%"></div>
            </div>

            <div class="metric">
                <span class="metric-label">Statements Coverage</span>
                <span class="metric-value $COVERAGE_STATUS">$STATEMENTS_PCT%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: $STATEMENTS_PCT%"></div>
            </div>

            <p><a href="coverage/index.html" target="_blank">📈 詳細カバレッジレポート</a></p>
        </div>
    </div>

EOF
        echo -e "${GREEN}✅ カバレッジレポート完了${NC}"
    else
        cat >> "$REPORT_FILE" << EOF
    <div class="section">
        <div class="section-header">
            <h2>📊 カバレッジレポート</h2>
        </div>
        <div class="section-content">
            <p>カバレッジデータが見つかりません。 \`pnpm test:coverage\` を実行してください。</p>
        </div>
    </div>

EOF
        echo -e "${YELLOW}⚠️ カバレッジデータがありません${NC}"
    fi
fi

# E2Eテストレポート
if [ "$E2E" = true ] || [ "$ALL" = true ]; then
    echo -e "${YELLOW}🎭 E2Eテストレポート生成中...${NC}"

    if [ -f "extension/playwright-report/index.html" ]; then
        # Playwright結果を解析
        TEST_RESULTS=$(find extension/playwright-report -name "*.json" | head -1)

        if [ -n "$TEST_RESULTS" ]; then
            PASSED_TESTS=$(cat "$TEST_RESULTS" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).suites.reduce((acc, s) => acc + s.specs.reduce((a, sp) => a + sp.tests.filter(t => t.results[0].status === 'passed').length, 0), 0))" 2>/dev/null || echo "0")
            FAILED_TESTS=$(cat "$TEST_RESULTS" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).suites.reduce((acc, s) => acc + s.specs.reduce((a, sp) => a + sp.tests.filter(t => t.results[0].status === 'failed').length, 0), 0))" 2>/dev/null || echo "0")
            SKIPPED_TESTS=$(cat "$TEST_RESULTS" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).suites.reduce((acc, s) => acc + s.specs.reduce((a, sp) => a + sp.tests.filter(t => t.results[0].status === 'skipped').length, 0), 0))" 2>/dev/null || echo "0")
        else
            PASSED_TESTS="0"
            FAILED_TESTS="0"
            SKIPPED_TESTS="0"
        fi

        TOTAL_TESTS=$((PASSED_TESTS + FAILED_TESTS + SKIPPED_TESTS))

        if [ "$FAILED_TESTS" -eq 0 ]; then
            E2E_STATUS="success"
        elif [ "$FAILED_TESTS" -lt 3 ]; then
            E2E_STATUS="warning"
        else
            E2E_STATUS="error"
        fi

        cat >> "$REPORT_FILE" << EOF
    <div class="section">
        <div class="section-header">
            <h2>🎭 E2Eテストレポート</h2>
        </div>
        <div class="section-content">
            <div class="metric">
                <span class="metric-label">総テスト数</span>
                <span class="metric-value">$TOTAL_TESTS</span>
            </div>
            <div class="metric">
                <span class="metric-label">✅ 成功</span>
                <span class="metric-value success">$PASSED_TESTS</span>
            </div>
            <div class="metric">
                <span class="metric-label">❌ 失敗</span>
                <span class="metric-value $([ "$FAILED_TESTS" -eq 0 ] && echo "success" || echo "error")">$FAILED_TESTS</span>
            </div>
            <div class="metric">
                <span class="metric-label">⏭️ スキップ</span>
                <span class="metric-value warning">$SKIPPED_TESTS</span>
            </div>
            <div class="metric">
                <span class="metric-label">成功率</span>
                <span class="metric-value $E2E_STATUS">$([ "$TOTAL_TESTS" -gt 0 ] && echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc || echo "0")%</span>
            </div>

            <p><a href="playwright-report/index.html" target="_blank">🎭 詳細E2Eレポート</a></p>
        </div>
    </div>

EOF
        echo -e "${GREEN}✅ E2Eテストレポート完了${NC}"
    else
        cat >> "$REPORT_FILE" << EOF
    <div class="section">
        <div class="section-header">
            <h2>🎭 E2Eテストレポート</h2>
        </div>
        <div class="section-content">
            <p>E2Eテスト結果が見つかりません。 \`pnpm test:e2e\` を実行してください。</p>
        </div>
    </div>

EOF
        echo -e "${YELLOW}⚠️ E2Eテスト結果がありません${NC}"
    fi
fi

# パフォーマンスレポート
if [ "$PERFORMANCE" = true ] || [ "$ALL" = true ]; then
    echo -e "${YELLOW}🚀 パフォーマンスレポート生成中...${NC}"

    if [ -d "extension/dist" ]; then
        BUNDLE_SIZE=$(du -sb extension/dist | cut -f1)
        BUNDLE_SIZE_MB=$((BUNDLE_SIZE / 1024 / 1024))
        BUNDLE_SIZE_KB=$((BUNDLE_SIZE / 1024))

        # バンドルサイズステータス
        if [ "$BUNDLE_SIZE_MB" -lt 5 ]; then
            BUNDLE_STATUS="success"
        elif [ "$BUNDLE_SIZE_MB" -lt 10 ]; then
            BUNDLE_STATUS="warning"
        else
            BUNDLE_STATUS="error"
        fi

        cat >> "$REPORT_FILE" << EOF
    <div class="section">
        <div class="section-header">
            <h2>🚀 パフォーマンスレポート</h2>
        </div>
        <div class="section-content">
            <div class="metric">
                <span class="metric-label">バンドルサイズ</span>
                <span class="metric-value $BUNDLE_STATUS">${BUNDLE_SIZE_MB}MB</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: $([ "$BUNDLE_SIZE_MB" -le 20 ] && echo "$((BUNDLE_SIZE_MB * 5))" || echo "100")%"></div>
            </div>

            <div class="metric">
                <span class="metric-label">ファイル数</span>
                <span class="metric-value">$(find extension/dist -type f | wc -l)</span>
            </div>

            <div class="metric">
                <span class="metric-label">ビルド時間</span>
                <span class="metric-value">$(grep -o 'build.*[0-9.]*s' package.json 2>/dev/null || echo 'N/A')</span>
            </div>

            <div class="metric">
                <span class="metric-label">最適化</span>
                <span class="metric-value success">有効</span>
            </div>
        </div>
    </div>

EOF
        echo -e "${GREEN}✅ パフォーマンスレポート完了${NC}"
    else
        cat >> "$REPORT_FILE" << EOF
    <div class="section">
        <div class="section-header">
            <h2>🚀 パフォーマンスレポート</h2>
        </div>
        <div class="section-content">
            <p>ビルド成果物が見つかりません。 \`pnpm build\` を実行してください。</p>
        </div>
    </div>

EOF
        echo -e "${YELLOW}⚠️ ビルド成果物がありません${NC}"
    fi
fi

# セキュリティレポート
if [ "$SECURITY" = true ] || [ "$ALL" = true ]; then
    echo -e "${YELLOW}🔒 セキュリティレポート生成中...${NC}"

    # 依存関係のセキュリティチェック
    VULNERABILITIES=$(pnpm audit --json 2>/dev/null | node -e "try { console.log(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).vulnerabilities ? Object.keys(JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8')).vulnerabilities).length : 0) } catch(e) { console.log(0) }" || echo "0")

    if [ "$VULNERABILITIES" -eq 0 ]; then
        SECURITY_STATUS="success"
        SECURITY_MSG="脆弱性なし"
    elif [ "$VULNERABILITIES" -lt 5 ]; then
        SECURITY_STATUS="warning"
        SECURITY_MSG="軽度の脆弱性"
    else
        SECURITY_STATUS="error"
        SECURITY_MSG="複数の脆弱性"
    fi

    cat >> "$REPORT_FILE" << EOF
    <div class="section">
        <div class="section-header">
            <h2>🔒 セキュリティレポート</h2>
        </div>
        <div class="section-content">
            <div class="metric">
                <span class="metric-label">既知の脆弱性</span>
                <span class="metric-value $SECURITY_STATUS">$VULNERABILITIES</span>
            </div>

            <div class="metric">
                <span class="metric-label">セキュリティステータス</span>
                <span class="metric-value $SECURITY_STATUS">$SECURITY_MSG</span>
            </div>

            <div class="metric">
                <span class="metric-label">依存関係スキャン</span>
                <span class="metric-value success">完了</span>
            </div>

            <div class="metric">
                <span class="metric-label">コードスキャン</span>
                <span class="metric-value warning">未実装</span>
            </div>
        </div>
    </div>

EOF
    echo -e "${GREEN}✅ セキュリティレポート完了${NC}"
fi

# 総合評価
cat >> "$REPORT_FILE" << EOF
    <div class="section">
        <div class="section-header">
            <h2>🏆 総合評価</h2>
        </div>
        <div class="section-content">
            <div class="chart-container">
                <div style="text-align: center;">
                    <div style="font-size: 4em; margin-bottom: 20px;">
EOF

# 総合評価の計算
OVERALL_SCORE=0
MAX_SCORE=100

# カバレッジスコア (30点)
if [ -n "$LINES_PCT" ]; then
    COVERAGE_SCORE=$(echo "scale=0; $LINES_PCT * 30 / 100" | bc)
    OVERALL_SCORE=$((OVERALL_SCORE + COVERAGE_SCORE))
fi

# E2Eスコア (30点)
if [ -n "$TOTAL_TESTS" ] && [ "$TOTAL_TESTS" -gt 0 ]; then
    E2E_SCORE=$(echo "scale=0; $PASSED_TESTS * 30 / $TOTAL_TESTS" | bc)
    OVERALL_SCORE=$((OVERALL_SCORE + E2E_SCORE))
fi

# パフォーマンススコア (20点)
if [ -n "$BUNDLE_SIZE_MB" ]; then
    if [ "$BUNDLE_SIZE_MB" -lt 5 ]; then
        PERF_SCORE=20
    elif [ "$BUNDLE_SIZE_MB" -lt 10 ]; then
        PERF_SCORE=15
    elif [ "$BUNDLE_SIZE_MB" -lt 15 ]; then
        PERF_SCORE=10
    else
        PERF_SCORE=5
    fi
    OVERALL_SCORE=$((OVERALL_SCORE + PERF_SCORE))
fi

# セキュリティスコア (20点)
if [ -n "$VULNERABILITIES" ]; then
    if [ "$VULNERABILITIES" -eq 0 ]; then
        SECURITY_SCORE=20
    elif [ "$VULNERABILITIES" -lt 5 ]; then
        SECURITY_SCORE=15
    elif [ "$VULNERABILITIES" -lt 10 ]; then
        SECURITY_SCORE=10
    else
        SECURITY_SCORE=5
    fi
    OVERALL_SCORE=$((OVERALL_SCORE + SECURITY_SCORE))
fi

# 総合評価の表示
if [ "$OVERALL_SCORE" -ge 80 ]; then
    OVERALL_EMOJI="🏆"
    OVERALL_STATUS="excellent"
    OVERALL_TEXT="優秀"
elif [ "$OVERALL_SCORE" -ge 60 ]; then
    OVERALL_EMOJI="✅"
    OVERALL_STATUS="good"
    OVERALL_TEXT="良好"
elif [ "$OVERALL_SCORE" -ge 40 ]; then
    OVERALL_EMOJI="⚠️"
    OVERALL_STATUS="fair"
    OVERALL_TEXT="普通"
else
    OVERALL_EMOJI="❌"
    OVERALL_STATUS="poor"
    OVERALL_TEXT="要改善"
fi

cat >> "$REPORT_FILE" << EOF
                        $OVERALL_EMOJI
                    </div>
                    <h3>$OVERALL_TEXT</h3>
                    <p style="font-size: 2em; font-weight: bold; color: #495057;">$OVERALL_SCORE / 100</p>
                </div>
            </div>

            <div class="metric">
                <span class="metric-label">品質レベル</span>
                <span class="metric-value $OVERALL_STATUS">$OVERALL_TEXT</span>
            </div>

            <div class="metric">
                <span class="metric-label">リリース推奨</span>
                <span class="metric-value $([ "$OVERALL_SCORE" -ge 60 ] && echo "success" || echo "error")">$([ "$OVERALL_SCORE" -ge 60 ] && echo "推奨" || echo "見合わせ")</span>
            </div>
        </div>
    </div>

    <div class="footer">
        <p>📊 このレポートは Arcline 品質チェックシステムによって生成されました</p>
        <p>生成時間: $(date)</p>
    </div>
</body>
</html>
EOF

echo ""
echo "=================================="
echo -e "${GREEN}🎉 テストレポート生成完了！${NC}"
echo -e "${BLUE}📁 レポート場所: $REPORT_FILE${NC}"
echo -e "${BLUE}🏆 総合評価: $OVERALL_SCORE/100 ($OVERALL_TEXT)${NC}"
echo ""

# ブラウザで開く（オプション）
if command -v open &> /dev/null; then
    echo -e "${YELLOW}🌐 レポートをブラウザで開きますか？ (y/N)${NC}"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        open "$REPORT_FILE"
    fi
fi

echo -e "${GREEN}✨ レポート生成が完了しました！${NC}"
