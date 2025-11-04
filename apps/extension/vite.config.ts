import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { crx } from '@crxjs/vite-plugin';

import manifest from './manifest.config';

export default defineConfig(({ mode }) => ({
  plugins: [react(), crx({ manifest })],
  root: '.',
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: mode === 'development'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173
    }
  }
}));
