#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXTENSION_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(EXTENSION_ROOT, '..');
const DIST_DIR = resolve(EXTENSION_ROOT, 'dist');
const RELEASE_DIR = resolve(REPO_ROOT, 'release');

const FORBIDDEN_PATTERNS = [
  /\.map$/i,
  /\.DS_Store$/i,
  /Thumbs\.db$/i,
  /\.env/i,
  /\.test\./i,
  /\.spec\./i,
];

function walkFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

if (!existsSync(join(DIST_DIR, 'manifest.json'))) {
  console.error(`Error: ${DIST_DIR}/manifest.json not found. Run 'just build' first.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(DIST_DIR, 'manifest.json'), 'utf-8'));

const localeMessages = [];
for (const lang of ['en', 'ja']) {
  const localePath = join(DIST_DIR, `_locales/${lang}/messages.json`);
  if (!existsSync(localePath)) {
    console.error(`Error: missing locale file: _locales/${lang}/messages.json`);
    process.exit(1);
  }
  const msgs = JSON.parse(readFileSync(localePath, 'utf-8'));
  const desc = msgs.extDescription?.message ?? '';
  if (!desc || desc.length > 132) {
    console.error(
      `Error: _locales/${lang}/messages.json extDescription must be <= 132 chars (got ${desc.length})`,
    );
    process.exit(1);
  }
  localeMessages.push({ lang, descriptionLength: desc.length });
}

if (
  manifest.manifest_version !== 3 ||
  !manifest.name ||
  manifest.name.length > 75 ||
  !manifest.description
) {
  console.error('Error: manifest fields invalid for Chrome Web Store');
  process.exit(1);
}

// Verify all referenced icon files and entrypoints exist in dist/
const requiredFiles = [
  'manifest.json',
  'sidepanel.html',
  'empty-space.html',
  'onboarding.html',
  '_locales/en/messages.json',
  '_locales/ja/messages.json',
  'background.js',
  'overlay.js',
  ...Object.values(manifest.icons ?? {}),
];
for (const rel of requiredFiles) {
  if (!existsSync(join(DIST_DIR, rel))) {
    console.error(`Error: required dist file missing: ${rel}`);
    process.exit(1);
  }
}

// Ensure overlay.js has zero top-level ES import/export statements (MV3 content_scripts rule)
const overlayCode = readFileSync(join(DIST_DIR, 'overlay.js'), 'utf-8');
if (/^\s*(import|export)\s/m.test(overlayCode)) {
  console.error('Error: dist/overlay.js contains ES import/export statements (must be pure IIFE)');
  process.exit(1);
}

// Clean any accidental OS / sourcemap artifacts inside dist/
for (const file of walkFiles(DIST_DIR)) {
  const rel = relative(DIST_DIR, file);
  if (FORBIDDEN_PATTERNS.some((rx) => rx.test(rel))) {
    rmSync(file, { force: true });
  }
}

mkdirSync(RELEASE_DIR, { recursive: true });
const zipName = `arcline-${manifest.version}-cws.zip`;
const zipPath = join(RELEASE_DIR, zipName);
rmSync(zipPath, { force: true });

execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: DIST_DIR });

const sizeBytes = statSync(zipPath).size;
const files = walkFiles(DIST_DIR).map((f) => relative(DIST_DIR, f));

console.log(
  JSON.stringify(
    {
      ok: true,
      name: manifest.name,
      version: manifest.version,
      locales: localeMessages,
      zipPath,
      sizeKiB: Number((sizeBytes / 1024).toFixed(2)),
      fileCount: files.length,
      files,
    },
    null,
    2,
  ),
);
