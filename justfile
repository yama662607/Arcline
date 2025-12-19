# =============================================================================
# ⚙️ Configuration & Variables
# =============================================================================

set dotenv-load := true
set shell := ["bash", "-c"]

pm := "pnpm"
ext_pkg := "arcline-extension"

# =============================================================================
# 🤖 Standard Interface (AI Agent Protocol)
# =============================================================================

# デフォルト: 読み取り専用の全体チェックを実行
default: check

# 環境構築: 依存関係のインストール、ツールチェーンのセットアップ
setup:
    @echo "📦 Setting up environment..."
    {{pm}} install
    @echo "🎭 Installing Playwright browsers..."
    cd extension && {{pm}} exec playwright install
    @echo "✅ Setup complete! Run 'just check' to verify."

# 全体品質検証: コードを変更せずに品質を検証 (CIゲート)
check: fmt-check lint typecheck test
    @echo "✅ All quality checks passed!"

# 自動修正: フォーマットとLint修正を適用 (Agentの第一手)
fix: fmt lint-fix
    @echo "✨ Auto-fixes applied!"

# =============================================================================
# 🧪 Testing & Verification
# =============================================================================

# ユニット/統合テスト: 引数パススルー対応
test *args="":
    @echo "🧪 Running unit tests..."
    {{pm}} --dir extension test -- {{args}}

# E2Eテスト: 引数パススルー対応 (不要なら削除可)
e2e *args="":
    @echo "🎭 Running E2E tests..."
    {{pm}} --dir extension run test:e2e -- {{args}}

# =============================================================================
# 🧩 Granular Tasks (Components of 'check' & 'fix')
# =============================================================================

# --- Format (整形) ---

fmt-check:
    @echo "📏 Checking formatting..."
    {{pm}} --dir extension exec biome check . --formatter-enabled=true --linter-enabled=false --assist-enabled=false

fmt:
    @echo "💅 Formatting code..."
    {{pm}} --dir extension exec biome format . --write

# --- Lint (静的解析) ---

lint:
    @echo "🔍 Linting..."
    {{pm}} --dir extension exec biome lint .

lint-fix:
    @echo "🧹 Fixing lint errors..."
    {{pm}} --dir extension exec biome lint . --write

# --- Typecheck (型検査) ---

typecheck:
    @echo "📐 Checking types..."
    {{pm}} --dir extension typecheck

# =============================================================================
# 🛠️ Operations & Utilities
# =============================================================================

# 開発サーバー起動 (不要なら削除可)
dev:
    @echo "🚀 Starting dev server..."
    {{pm}} dev

# 本番ビルド (不要なら削除可)
build:
    @echo "🏗️ Building artifact..."
    {{pm}} build

# アーティファクト削除 (不要なら削除可)
clean:
    @echo "🗑️ Cleaning artifacts..."
    rm -rf extension/dist*
    rm -rf extension/coverage*
    rm -rf extension/playwright-report*
    rm -rf extension/test-results*


# =============================================================================
# 📦 Dependency Management
# =============================================================================

# 安全装置: Gitの作業ツリーがクリーンか確認 (未コミットがあれば停止)
ensure-clean:
    @if [ -n "$(git status --porcelain)" ]; then \
        echo "❌ \033[0;31mError: Working directory is dirty.\033[0m"; \
        echo "   Please commit or stash your changes before proceeding."; \
        exit 1; \
    fi

# 全パッケージを最新に更新 (フロー: Git確認 -> 現状検査 -> 更新 -> 事後検査)
# 解説: ensure-clean, check, e2e を依存関係に指定することで、これらが成功しないと更新が始まりません
upgrade: ensure-clean check e2e
    @echo "✅ Baseline passed. Current code is stable."
    @echo "🚀 \033[1;34mStarting full upgrade process (recursive, latest)...\033[0m"

    # 全パッケージを最新(Latest)に更新 & ロックファイル同期
    {{pm}} up --recursive --latest
    {{pm}} install

    @echo "📈 \033[1;33mVerifying upgrade stability (Post-upgrade)...\033[0m"

    # 【重要】justの仕様上、依存関係で実行済みのタスクはスキップされるため
    # ここでは明示的にコマンド呼び出しを行って再実行させます
    just check
    just e2e

    @echo "✨ \033[0;32mUpgrade Complete! System is stable on latest versions.\033[0m"