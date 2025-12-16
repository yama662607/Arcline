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
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        popup: resolve(__dirname, 'popup.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: 'localhost',
    port: 5175,
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: 5175,
      clientPort: 5175,
      protocol: 'ws',
      overlay: false,
    },
  },
  watch: {
    usePolling: false,
    interval: 1000,
  },
}));
