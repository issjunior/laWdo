import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
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

    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/__tests__/main/**/*.{test,spec}.{ts,tsx}',
            'src/__tests__/shared/**/*.{test,spec}.{ts,tsx}',
            'src/__tests__/validators/**/*.{test,spec}.{ts,tsx}',
          ],
          exclude: [
            'src/__tests__/main/exportacao-docx-canonica.test.ts',
            'src/__tests__/main/exportacao-docx-proporcao.test.ts',
            'src/__tests__/main/importacao-documentos.test.ts',
            'src/__tests__/main/importacao-pdf.test.ts',
            'src/__tests__/main/secao-builder.service.test.ts',
            'src/__tests__/main/template-titulo-oculto.integration.test.ts',
            'src/__tests__/main/templates-figuras-padrao.test.ts',
            'src/__tests__/shared/b601-coleta.test.ts',
          ],
          setupFiles: ['./src/test-setup-node.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom-main',
          environment: 'jsdom',
          include: [
            'src/__tests__/main/exportacao-docx-canonica.test.ts',
            'src/__tests__/main/exportacao-docx-proporcao.test.ts',
            'src/__tests__/main/importacao-documentos.test.ts',
            'src/__tests__/main/importacao-pdf.test.ts',
            'src/__tests__/main/secao-builder.service.test.ts',
            'src/__tests__/main/template-titulo-oculto.integration.test.ts',
            'src/__tests__/main/templates-figuras-padrao.test.ts',
            'src/__tests__/shared/b601-coleta.test.ts',
          ],
          setupFiles: ['./src/test-setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: [
            'src/__tests__/renderer/**/*.{test,spec}.{ts,tsx}',
            'src/__tests__/pages/**/*.{test,spec}.{ts,tsx}',
            'src/__tests__/components/**/*.{test,spec}.{ts,tsx}',
          ],
          setupFiles: ['./src/test-setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'preload',
          environment: 'jsdom',
          include: ['src/__tests__/preload/**/*.{test,spec}.{ts,tsx}'],
          setupFiles: ['./src/test-setup.ts'],
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src/renderer'),
      '@shared': path.resolve(import.meta.dirname, './src/shared'),
      '@main': path.resolve(import.meta.dirname, './src/main'),
      '@preload': path.resolve(import.meta.dirname, './src/preload'),
    },
  },
})
