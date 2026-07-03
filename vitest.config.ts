import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Ambiente de testes
    environment: 'jsdom',
    globals: true,

    // Configurações de cobertura
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'out/**',
        '**/*.d.ts',
        '**/types/**',
        '**/*.config.*',
        '**/vitest.config.*',
        '**/test-setup.*',
      ],
      thresholds: {
        lines: 50,
        functions: 60,
        branches: 35,
        statements: 50,
      },
    },

    // Incluir arquivos de teste
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    // Excluir diretórios
    exclude: ['node_modules', 'dist', 'out', '**/node_modules/**'],

    // Configurações de timeout
    testTimeout: 10000,
    hookTimeout: 10000,

    // Configurações de snapshot
    snapshotFormat: {
      escapeString: true,
      printBasicPrototype: true,
    },

    // Configurações de UI
    reporters: ['default'],

    // Setup para testes
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@main': path.resolve(__dirname, './src/main'),
      '@preload': path.resolve(__dirname, './src/preload'),
    },
  },
})
