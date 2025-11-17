#!/usr/bin/env node

// Git フックを自動的に設定するスクリプト

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = process.cwd();
const hooksDir = path.join(projectRoot, '.git', 'hooks');

console.log('🔧 Git フックを設定中...');

// .git/hooks ディレクトリの存在確認
if (!fs.existsSync(hooksDir)) {
    console.error('❌ .git/hooks ディレクトリが見つかりません');
    console.error('💡 このリポジトリで git init を実行してください');
    process.exit(1);
}

// pre-commit フックを設定
const preCommitHook = `#!/bin/sh
# Arcline pre-commit hook
cd "$(dirname "$0")/../.."
./scripts/pre-commit.sh "$@"
`;

const preCommitPath = path.join(hooksDir, 'pre-commit');
fs.writeFileSync(preCommitPath, preCommitHook);
fs.chmodSync(preCommitPath, '755');

console.log('✅ pre-commit フックを設定しました');

// pre-push フックを設定
const prePushHook = `#!/bin/sh
# Arcline pre-push hook
cd "$(dirname "$0")/../.."
./scripts/quality-check.sh --coverage
`;

const prePushPath = path.join(hooksDir, 'pre-push');
fs.writeFileSync(prePushPath, prePushHook);
fs.chmodSync(prePushPath, '755');

console.log('✅ pre-push フックを設定しました');

// commit-msg フックを設定
const commitMsgHook = `#!/bin/sh
# Arcline commit-msg hook
commit_regex='^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\\(.+\\))?: .{1,50}'

if ! grep -qE "$commit_regex" "$1"; then
    echo "❌ コミットメッセージが Conventional Commits 形式ではありません"
    echo ""
    echo "💡 推奨形式: type(scope): description"
    echo "例: feat(ui): add new tab management feature"
    echo "例: fix: resolve tab rendering issue"
    echo ""
    echo "📖 詳細: https://www.conventionalcommits.org/"
    exit 1
fi

# メッセージ長チェック
if [ $(wc -c < "$1") -gt 72 ]; then
    echo "❌ コミットメッセージが長すぎます（72文字以内）"
    exit 1
fi
`;

const commitMsgPath = path.join(hooksDir, 'commit-msg');
fs.writeFileSync(commitMsgPath, commitMsgHook);
fs.chmodSync(commitMsgPath, '755');

console.log('✅ commit-msg フックを設定しました');

// package.json にスクリプトを追加（オプション）
const packageJsonPath = path.join(projectRoot, 'package.json');
if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    if (!packageJson.scripts) {
        packageJson.scripts = {};
    }

    packageJson.scripts['quality-check'] = './scripts/quality-check.sh';
    packageJson.scripts['quality-check:strict'] = './scripts/quality-check.sh --strict';
    packageJson.scripts['quality-check:full'] = './scripts/quality-check.sh --all';
    packageJson.scripts['pre-commit'] = './scripts/pre-commit.sh';
    packageJson.scripts['setup-hooks'] = 'node scripts/setup-hooks.js';

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('✅ package.json にスクリプトを追加しました');
}

console.log('');
console.log('🎉 Git フックの設定が完了しました！');
console.log('');
console.log('📝 設定されたフック:');
console.log('  • pre-commit: コミット前に品質チェックを実行');
console.log('  • pre-push: プッシュ前にカバレッジ付きチェックを実行');
console.log('  • commit-msg: コミットメッセージの形式をチェック');
console.log('');
console.log('🚀 使用可能なコマンド:');
console.log('  • pnpm quality-check: 基本品質チェック');
console.log('  • pnpm quality-check:strict: 厳格品質チェック');
console.log('  • pnpm quality-check:full: 完全品質チェック');
console.log('  • pnpm pre-commit: プレコミットチェックのみ実行');
console.log('');
console.log('💡 フックを無効化するには:');
echo '  git config core.hooksPath /dev/null';
