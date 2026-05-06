/// <reference types="vitest/config" />

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  plugins: [react()],
  resolve: {
    // dist пакета — CommonJS; именованные ESM-импорты в браузере ломаются.
    alias: {
      '@srs/shared-types': path.join(workspaceRoot, 'packages/shared-types/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
});
