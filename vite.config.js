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
          monaco: ['monaco-editor']
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
    include: ['monaco-editor', '@xterm/xterm', '@xterm/addon-fit'],
    exclude: []
  },
  define: {
    global: 'globalThis'
  },
  worker: {
    format: 'es'
  }
});