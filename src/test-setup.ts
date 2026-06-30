/**
 * Setup de testes para Vitest
 *
 * Este arquivo configura o ambiente de testes antes da execução
 * de cada teste. Inclui configurações globais, mocks e pollyfills.
 */

import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

const electronAPIMock = {
  ping: vi.fn(() => Promise.resolve('pong')),
  getAppInfo: vi.fn(() => Promise.resolve({
    name: 'laWdo Test',
    version: '0.1.0-test',
  })),
  logInfo: vi.fn(() => Promise.resolve()),
  logError: vi.fn(() => Promise.resolve()),
  logWarning: vi.fn(() => Promise.resolve()),
  openDevTools: vi.fn(),
  restartApp: vi.fn(),
  clearCache: vi.fn(),
  executeQuery: vi.fn(() => Promise.resolve([])),
  backupDatabase: vi.fn(() => Promise.resolve(true)),
  restoreDatabase: vi.fn(() => Promise.resolve(true)),
}

// Mock global do Electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/app/path'),
    getAppPath: vi.fn(() => '/mock/app'),
    getName: vi.fn(() => 'laWdoTest'),
    getVersion: vi.fn(() => '0.1.0-test'),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}))

// Mock do window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: electronAPIMock,
  writable: true,
})

// Mock do window.ipcAPI (alias)
Object.defineProperty(window, 'ipcAPI', {
  value: electronAPIMock,
  writable: true,
})

// Mock do localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// Mock do sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
})

// Mock de Date.now para testes consistentes
Date.now = vi.fn(() => new Date('2024-01-01T00:00:00.000Z').getTime())

// Mock de crypto.randomUUID para UUIDs consistentes
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: vi.fn(() => '00000000-0000-0000-0000-000000000000'),
  },
  writable: true,
})

// Limpar mocks após cada teste
afterEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
  sessionStorageMock.clear()
})

// Configurações globais para testes
beforeAll(() => {
  // Suprimir logs durante os testes
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})
