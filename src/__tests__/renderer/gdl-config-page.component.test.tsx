import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GdlConfigPage } from '@/pages/GdlConfigPage'

const ipcApiOriginal = window.ipcAPI
const configuracoes = new Map<string, string>()
const obterConfiguracao = vi.fn(async (chave: string) => ({ success: true, data: configuracoes.get(chave) ?? null }))
const salvarConfiguracao = vi.fn(async (chave: string, valor: string) => {
  configuracoes.set(chave, valor)
  return { success: true }
})

describe('GdlConfigPage', () => {
  beforeEach(() => {
    configuracoes.clear()
    obterConfiguracao.mockClear()
    salvarConfiguracao.mockClear()
    Object.defineProperty(window, 'ipcAPI', {
      value: {
        ...ipcApiOriginal,
        configuracao: { ...ipcApiOriginal.configuracao, obter: obterConfiguracao, salvar: salvarConfiguracao },
        gdl: {
          ...ipcApiOriginal.gdl,
          obterValidacaoSessao: vi.fn().mockResolvedValue({ success: true, data: { ambiente: 'Produção', validado: false } }),
          limparValidacaoSessao: vi.fn().mockResolvedValue({ success: true, data: { ambiente: 'Produção', validado: false } }),
        },
      },
      writable: true,
    })
  })

  afterAll(() => {
    Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true })
  })

  it('usa Produção por padrão e libera Homologação pelo botão no cabeçalho', async () => {
    configuracoes.set('gdl_ambiente', 'homologacao')
    render(<GdlConfigPage />)

    await waitFor(() => expect(obterConfiguracao).toHaveBeenCalledWith('gdl_homologacao_habilitada'))
    expect(screen.getByText('Ambiente selecionado: Produção')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Homologação.*Ambiente de testes/s })).not.toBeInTheDocument()

    const botaoHabilitar = screen.getByRole('button', { name: 'Habilitar ambiente de homologação' })
    expect(botaoHabilitar).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(botaoHabilitar)
    await waitFor(() => expect(configuracoes.get('gdl_homologacao_habilitada')).toBe('true'))
    expect(configuracoes.get('gdl_ambiente')).toBe('producao')
    expect(screen.getByRole('button', { name: /Homologação.*Ambiente de testes/s })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desabilitar ambiente de homologação' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Ambiente selecionado: Produção')).toBeInTheDocument()
  })

  it('seleciona Produção ao desligar Homologação e preserva as credenciais de teste', async () => {
    configuracoes.set('gdl_homologacao_habilitada', 'true')
    configuracoes.set('gdl_ambiente', 'homologacao')
    configuracoes.set('gdl_login_homologacao', 'usuario-teste')
    configuracoes.set('gdl_senha_homologacao', 'senha-teste')
    render(<GdlConfigPage />)

    expect(await screen.findByText('Ambiente selecionado: Homologação')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Desabilitar ambiente de homologação' }))

    await waitFor(() => expect(configuracoes.get('gdl_ambiente')).toBe('producao'))
    expect(configuracoes.get('gdl_homologacao_habilitada')).toBe('false')
    expect(configuracoes.get('gdl_login_homologacao')).toBe('usuario-teste')
    expect(configuracoes.get('gdl_senha_homologacao')).toBe('senha-teste')
    expect(screen.getByText('Ambiente selecionado: Produção')).toBeInTheDocument()
  })
})
