import { resolve } from 'node:path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Use happy-dom to avoid the jsdom@27 + parse5@8 ESM/CJS conflict until upstream fixes require/import handling.
    environment: 'happy-dom',
    environmentMatchGlobs: [['**/*.node.{test,spec}.{ts,tsx}', 'node']],
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', 'tests/floating-ui.spec.ts'],
    passWithNoTests: true,
    css: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
