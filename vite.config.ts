import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  root: path.join(import.meta.dirname, 'src/renderer'),
  build: {
    outDir: path.join(import.meta.dirname, 'out/renderer'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: path.join(import.meta.dirname, 'src/renderer/index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@tinymce/tinymce-react')) {
            return 'vendor-tinymce';
          }

          if (/node_modules\/(react|react-dom|react-router-dom)\//.test(id)) {
            return 'vendor-react';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.join(import.meta.dirname, 'src/renderer'),
      '@shared': path.join(import.meta.dirname, 'src/shared'),
    },
  },
});
