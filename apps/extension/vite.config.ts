import { resolve } from 'node:path';
import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

import manifest from './manifest.config';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    crx({
      manifest,
      contentScripts: {
        injectCss: true,
      },
    }),
  ],
  root: '.',
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: mode === 'development',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: 5173,
      clientPort: 5173,
      protocol: 'ws',
      overlay: false,
    },
  },
}));
