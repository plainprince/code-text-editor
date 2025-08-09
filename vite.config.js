import { defineConfig } from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: [
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/language',
            '@codemirror/theme-one-dark',
            '@codemirror/commands',
            '@codemirror/search',
            '@codemirror/autocomplete',
            '@codemirror/lint'
          ],
          'codemirror-langs': [
            '@codemirror/lang-javascript',
            '@codemirror/lang-html',
            '@codemirror/lang-css',
            '@codemirror/lang-json',
            '@codemirror/lang-markdown',
            '@codemirror/lang-python',
            '@codemirror/lang-rust',
            '@codemirror/lang-go',
            '@codemirror/lang-cpp',
            '@codemirror/lang-java',
            '@codemirror/lang-php'
          ]
        }
      },
      external: []
    },
    dynamicImportVarsOptions: {
      warnOnError: false
    }
  },
  server: {
    port: 3000,
    strictPort: true
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  optimizeDeps: {
    include: [
      '@xterm/xterm', 
      '@xterm/addon-fit',
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/language',
      '@codemirror/theme-one-dark',
      '@codemirror/commands',
      '@codemirror/search',
      '@codemirror/autocomplete',
      '@codemirror/lint',
      '@codemirror/lang-javascript',
      '@codemirror/lang-html',
      '@codemirror/lang-css',
      '@codemirror/lang-json',
      '@codemirror/lang-markdown',
      '@codemirror/lang-python',
      '@codemirror/lang-rust',
      '@codemirror/lang-go',
      '@codemirror/lang-cpp',
      '@codemirror/lang-java',
      '@codemirror/lang-php',
      '@lezer/highlight'
    ],
    exclude: []
  },
  define: {
    global: 'globalThis'
  },
  worker: {
    format: 'es'
  }
});