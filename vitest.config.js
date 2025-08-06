import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.js'],
    exclude: ['node_modules', 'dist', 'src-tauri'],
  },
  resolve: {
    alias: {
      '@': '/src',
      'monaco-editor': 'monaco-editor/esm/vs/editor/editor.api.js',
    },
  },
  define: {
    global: 'globalThis',
  },
});