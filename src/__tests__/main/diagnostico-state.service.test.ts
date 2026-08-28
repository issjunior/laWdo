import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  existe: vi.fn(),
  criarDiretorio: vi.fn(),
  escrever: vi.fn(),
  caminhoDados: 'C:/dados-testes',
}))

vi.mock('electron', () => ({ app: { getPath: () => mocks.caminhoDados } }))
vi.mock('fs', () => ({
  default: { existsSync: (...args: unknown[]) => mocks.existe(...args), mkdirSync: (...args: unknown[]) => mocks.criarDiretorio(...args), writeFileSync: (...args: unknown[]) => mocks.escrever(...args) },
}))

import {
  atualizarContextoRendererDiagnostico,
  registrarErroFatalMainDiagnostico,
  registrarErroFatalRendererDiagnostico,
} from '../../main/services/diagnostico-state.service'

describe('diagnostico-state.service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.existe.mockReturnValue(false)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-27T12:34:56.789Z'))
  })

  it('redige dados sensíveis, limita conteúdo e registra o contexto do renderer', () => {
    atualizarContextoRendererDiagnostico({
      rota: '/laudos',
      usuario: { nome: 'Perito', cpf: '123', token: 'secreto' },
      contextoTela: { observacao: 'x'.repeat(501), permitido: true },
    })

    const caminho = registrarErroFatalRendererDiagnostico({
      tipo: 'error', message: 'Falha', source: 'renderer', stack: 'pilha',
    })

    expect(mocks.criarDiretorio).toHaveBeenCalledWith(expect.stringContaining('diagnostico-state-dumps'), { recursive: true })
    expect(caminho).toContain('2026-08-27T12-34-56-789Z_renderer_estado-snapshot.json')
    const snapshot = JSON.parse(mocks.escrever.mock.calls[0]?.[1] as string) as {
      renderer: {
        usuario: Record<string, string>
        contextoTela: { observacao: string }
        atualizadoEm: string
      }
    }
    expect(snapshot.renderer.usuario).toEqual({ nome: 'Perito', cpf: '[redigido]', token: '[redigido]' })
    expect(snapshot.renderer.contextoTela.observacao).toBe(`${'x'.repeat(500)}...[truncado]`)
    expect(snapshot.renderer.atualizadoEm).toBe('2026-08-27T12:34:56.789Z')
    expect(mocks.escrever.mock.calls[0]?.[2]).toBe('utf-8')
  })

  it('normaliza falha fatal do processo sem expor o valor original em objeto sensível', () => {
    registrarErroFatalMainDiagnostico({ apiKey: 'não pode vazar' }, 'unhandledRejection')

    const snapshot = JSON.parse(mocks.escrever.mock.calls[0]?.[1] as string) as {
      origem: string
      erro: unknown
    }
    expect(snapshot.origem).toBe('main')
    expect(snapshot.erro).toEqual({ tipo: 'unhandledRejection', detail: '[object Object]' })
  })
})
