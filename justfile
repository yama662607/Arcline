set dotenv-load := true
set shell := ["bash", "-c"]

pm := "pnpm"

# Default: read-only quality gate
default: check

# Environment setup
setup:
    @echo "📦 Installing dependencies..."
    {{pm}} install
    @echo "✅ Setup complete! Run 'just check' to verify."

# Shallow-clone local OSS reference repositories into gitignored refs/
setup-refs:
    @echo "📚 Cloning OSS reference repositories into refs/..."
    mkdir -p refs
    [ -d refs/volet ] || git clone --depth 1 https://github.com/pierregoutheraud/volet.git refs/volet
    [ -d refs/arcify ] || git clone --depth 1 https://github.com/nisargkolhe/arcify.git refs/arcify
    [ -d refs/arc-sidebar-chrome ] || git clone --depth 1 https://github.com/lophas/arc-sidebar-chrome.git refs/arc-sidebar-chrome
    [ -d refs/sidearc ] || git clone --depth 1 https://github.com/winzipsdo/sidearc.git refs/sidearc
    [ -d refs/spaces-plus ] || git clone --depth 1 https://github.com/Tanvir-rahman/spaces-plus.git refs/spaces-plus
    @echo "✅ Reference repositories ready in refs/."

# Full read-only CI gate
check: fmt-check lint typecheck test
    @echo "✅ All quality checks passed!"

# Auto-fix formatting and lint issues
fix: fmt lint-fix
    @echo "✨ Auto-fixes applied!"

# Unit & engine integration tests
test *args="":
    @echo "🧪 Running tests..."
    {{pm}} --dir extension test -- {{args}}

# Formatting
fmt-check:
    @echo "📏 Checking formatting..."
    {{pm}} --dir extension exec biome check . --formatter-enabled=true --linter-enabled=false --assist-enabled=false

fmt:
    @echo "💅 Formatting code..."
    {{pm}} --dir extension exec biome format . --write

# Linting
lint:
    @echo "🔍 Linting..."
    {{pm}} --dir extension exec biome lint .

lint-fix:
    @echo "🧹 Fixing lint errors..."
    {{pm}} --dir extension exec biome lint . --write

# Typecheck
typecheck:
    @echo "📐 Checking types..."
    {{pm}} --dir extension typecheck

# Watch build
dev:
    @echo "🚀 Starting watch build..."
    {{pm}} --dir extension dev

# Production MV3 build
build:
    @echo "🏗️ Building MV3 extension..."
    {{pm}} --dir extension build

# Real-browser extension diagnostics (zero runtime/manifest errors + live reload)
check-extension: build
    @echo "🩺 Running real-browser extension diagnostics..."
    {{pm}} --dir extension run check:extension

# Real-browser Playwright E2E suite (edge-hover, workflows, resilience)
e2e *args="": build
    @echo "🎭 Running Playwright real-browser E2E suite..."
    {{pm}} --dir extension exec playwright test {{args}}

# Real-data visual comparison on Brave using local Arc StorableSidebar.json (ARCLINE_HEADED=1 for visible window)
visual-arc: build
    @echo "📸 Capturing real-data Arc visual comparison on Brave..."
    node extension/scripts/visual-arc-compare.mjs

# Launch an isolated Brave CDP debug browser on port 9222 with Arcline loaded (for MCP / DevTools debugging without chrome.debugger detach)
debug-browser port="9222": build
    @echo "🔬 Launching isolated Brave CDP debug browser on http://127.0.0.1:{{port}} ..."
    @echo "   MCP:      npx @playwright/mcp@latest --cdp-endpoint=http://127.0.0.1:{{port}}"
    @echo "   Targets:  http://127.0.0.1:{{port}}/json/list"
    @TMP_PROFILE=$$(mktemp -d /tmp/arcline-cdp-debug-XXXXXX); \
    trap 'rm -rf "$$TMP_PROFILE"' EXIT; \
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
      --remote-debugging-port={{port}} \
      --user-data-dir="$$TMP_PROFILE" \
      --load-extension="$(pwd)/extension/dist" \
      --no-first-run \
      --no-default-browser-check \
      --disable-brave-update \
      --disable-features=BraveRewards,BraveWallet,BraveNews,BraveVPN \
      https://example.com

# Package clean Chrome Web Store submission ZIP into release/arcline-1.0.0-cws.zip
package: build
    @echo "📦 Packaging Chrome Web Store ZIP..."
    {{pm}} --dir extension run package:cws

# Clean build outputs
clean:
    @echo "🗑️ Cleaning artifacts..."
    rm -rf extension/dist extension/coverage extension/test-results release
