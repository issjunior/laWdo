import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  root: path.join(__dirname, 'src/renderer'),
  build: {
    outDir: path.join(__dirname, 'out/renderer'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: path.join(__dirname, 'src/renderer/index.html'),
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
      '@': path.join(__dirname, 'src/renderer'),
      '@shared': path.join(__dirname, 'src/shared'),
    },
  },
});
