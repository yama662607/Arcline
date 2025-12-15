#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

async function main() {
  const distDir = path.join(process.cwd(), 'dist');
  const viteManifestPath = path.join(distDir, '.vite', 'manifest.json');
  const manifestPath = path.join(distDir, 'manifest.json');

  const viteRaw = await readFile(viteManifestPath, 'utf8');
  const viteManifest = JSON.parse(viteRaw);

  const swEntry = viteManifest['src/background/index.ts'];
  if (!swEntry || typeof swEntry.file !== 'string') {
    console.error('[patch-sw-manifest] No src/background/index.ts entry in .vite/manifest.json');
    process.exit(1);
  }

  const manifestRaw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);

  if (!manifest.background || typeof manifest.background !== 'object') {
    manifest.background = {};
  }

  manifest.background.service_worker = swEntry.file;

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error('[patch-sw-manifest] Failed to patch manifest:', error);
  process.exit(1);
});
