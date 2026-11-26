import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => path.join(os.tmpdir(), 'lawdo-test')),
    getAppPath: vi.fn(() => path.join(os.tmpdir(), 'lawdo-test-app')),
    getName: vi.fn(() => 'laWdoTest'),
    getVersion: vi.fn(() => '0.1.0-test'),
    quit: vi.fn(),
  },
  shell: {
    openPath: vi.fn(async () => ''),
    showItemInFolder: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}))

Date.now = vi.fn(() => new Date('2024-01-01T00:00:00.000Z').getTime())

afterEach(() => {
  vi.clearAllMocks()
})

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
})
