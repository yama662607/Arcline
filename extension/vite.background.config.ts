import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Builds the MV3 Service Worker (`background.js`) as a single self-contained ES module
 * with zero external hashed `./assets/*` imports so Chromium never hits Status code 3
 * ("Service worker registration failed") when chunk hashes change across reloads.
 */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'esnext',
    lib: {
      entry: resolve(import.meta.dirname, 'src/background/index.ts'),
      formats: ['es'],
      fileName: () => 'background.js',
    },
  },
});
