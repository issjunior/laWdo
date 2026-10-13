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
    obterConfiguracao.mockImplementation(async (chave: string) => ({ success: true, data: configuracoes.get(chave) ?? null }))
    salvarConfiguracao.mockClear()
    Object.defineProperty(window, 'ipcAPI', {
      value: {
        ...ipcApiOriginal,
        configuracao: { ...ipcApiOriginal.configuracao, obter: obterConfiguracao, salvar: salvarConfiguracao },
        gdl: {
          ...ipcApiOriginal.gdl,
          obterPreferenciaListagem: vi.fn().mockResolvedValue({ success: true, data: { habilitada: false } }),
          definirPreferenciaListagem: vi.fn(async (habilitada: boolean) => ({ success: true, data: { habilitada } })),
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

  it('inicia com Homologação desabilitada quando não há configuração salva', async () => {
    render(<GdlConfigPage />)

    await waitFor(() => expect(obterConfiguracao).toHaveBeenCalledWith('gdl_homologacao_habilitada'))
    expect(screen.getByRole('button', { name: 'Habilitar ambiente de homologação' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Ambiente selecionado: Produção')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Homologação.*Ambiente de testes/s })).not.toBeInTheDocument()
    expect(salvarConfiguracao).not.toHaveBeenCalled()
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

  it('ativa e desativa a listagem sem confirmação de alteração de status', async () => {
    render(<GdlConfigPage />)
    const ativar = await screen.findByRole('button', { name: 'Ativar listagem' })
    await waitFor(() => expect(ativar).toBeEnabled())
    fireEvent.click(ativar)
    const definir = window.ipcAPI.gdl.definirPreferenciaListagem as ReturnType<typeof vi.fn>
    await waitFor(() => expect(definir).toHaveBeenCalledWith(true))
    expect(screen.queryByText(/pode marcá-las/)).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Desativar listagem' }))
    await waitFor(() => expect(definir).toHaveBeenCalledWith(false))
  })

  it('não confirma Produção nem libera ações quando as preferências falham', async () => {
    obterConfiguracao.mockImplementation(async (chave: string) => chave === 'gdl_ambiente'
      ? { success: false, data: null }
      : { success: true, data: configuracoes.get(chave) ?? null })
    render(<GdlConfigPage />)

    expect(await screen.findByText('Ambiente não confirmado')).toBeInTheDocument()
    expect(screen.getByText('Não foi possível ler as preferências de ambiente do GDL.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar Configurações' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Testar Rede' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Validar Credenciais' })).toBeDisabled()
    expect(await screen.findByRole('button', { name: 'Ativar listagem' })).toBeEnabled()

    obterConfiguracao.mockImplementation(async (chave: string) => ({ success: true, data: configuracoes.get(chave) ?? null }))
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Ambiente selecionado: Produção')).toBeInTheDocument()
  })

  it('não aceita preferência de ambiente inválida como Produção confirmada', async () => {
    configuracoes.set('gdl_ambiente', 'ambiente-desconhecido')
    render(<GdlConfigPage />)

    expect(await screen.findByText('A preferência de ambiente do GDL é inválida.')).toBeInTheDocument()
    expect(screen.getByText('Ambiente não confirmado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar Configurações' })).toBeDisabled()
  })

  it('mantém a preferência de listagem independente e oferece nova tentativa', async () => {
    const obterListagem = window.ipcAPI.gdl.obterPreferenciaListagem as ReturnType<typeof vi.fn>
    obterListagem.mockResolvedValue({ success: false, error: 'Falha na preferência de listagem' })
    render(<GdlConfigPage />)

    expect(await screen.findByText('Falha na preferência de listagem')).toBeInTheDocument()
    expect(screen.getByText('Preferência de listagem não confirmada.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ativar listagem' })).toBeDisabled()
    obterListagem.mockResolvedValue({ success: true, data: { habilitada: false } })
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ativar listagem' })).toBeEnabled())
  })

  it('falha ao ler senha sem tratá-la como ausente e preserva edição na nova tentativa', async () => {
    obterConfiguracao.mockImplementation(async (chave: string) => chave === 'gdl_senha_producao'
      ? { success: false, data: null }
      : { success: true, data: configuracoes.get(chave) ?? null })
    render(<GdlConfigPage />)

    expect(await screen.findByText('Não foi possível ler as credenciais do GDL.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar Configurações' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'edicao-local' } })
    configuracoes.set('gdl_login_producao', 'login-salvo')
    configuracoes.set('gdl_senha_producao', 'senha-salva')
    obterConfiguracao.mockImplementation(async (chave: string) => ({ success: true, data: configuracoes.get(chave) ?? null }))
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar Configurações' })).toBeEnabled())
    expect(screen.getByLabelText('Login')).toHaveValue('edicao-local')
    expect(screen.getByLabelText('Senha')).toHaveValue('senha-salva')
  })

  it('distingue falha de leitura da validação de sessão e recupera por nova tentativa', async () => {
    const obterValidacao = window.ipcAPI.gdl.obterValidacaoSessao as ReturnType<typeof vi.fn>
    obterValidacao.mockResolvedValue({ success: false, error: 'Falha de leitura' })
    render(<GdlConfigPage />)

    expect(await screen.findByText('Não foi possível ler o estado de validação do GDL.')).toBeInTheDocument()
    expect(screen.getByText('Indisponível')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Validar Credenciais' })).toBeDisabled()
    obterValidacao.mockResolvedValue({ success: true, data: { ambiente: 'Produção', validado: false } })
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await waitFor(() => expect(screen.getByText('Pendente')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Validar Credenciais' })).toBeEnabled()
  })

  it('ignora credenciais e validação atrasadas do ambiente anterior', async () => {
    configuracoes.set('gdl_homologacao_habilitada', 'true')
    configuracoes.set('gdl_login_producao', 'usuario-producao')
    let concluirLoginHomologacao: ((valor: { success: boolean; data: string }) => void) | undefined
    obterConfiguracao.mockImplementation(async (chave: string) => {
      if (chave === 'gdl_login_homologacao') return new Promise(resolve => { concluirLoginHomologacao = resolve })
      return { success: true, data: configuracoes.get(chave) ?? null }
    })
    const obterValidacao = window.ipcAPI.gdl.obterValidacaoSessao as ReturnType<typeof vi.fn>
    let concluirValidacaoHomologacao: ((valor: { success: boolean; data: { ambiente: string; validado: boolean } }) => void) | undefined
    obterValidacao.mockImplementation((ambiente: string) => ambiente === 'homologacao'
      ? new Promise(resolve => { concluirValidacaoHomologacao = resolve })
      : Promise.resolve({ success: true, data: { ambiente: 'Produção', validado: false } }))
    render(<GdlConfigPage />)
    await waitFor(() => expect(screen.getByLabelText('Login')).toHaveValue('usuario-producao'))

    fireEvent.click(screen.getByRole('button', { name: /Homologação.*Ambiente de testes/s }))
    await waitFor(() => expect(concluirLoginHomologacao).toBeDefined())
    await waitFor(() => expect(concluirValidacaoHomologacao).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: /Produção.*Ambiente real/s }))
    concluirLoginHomologacao?.({ success: true, data: 'usuario-antigo' })
    concluirValidacaoHomologacao?.({ success: true, data: { ambiente: 'Homologação', validado: true } })

    await waitFor(() => expect(screen.getByLabelText('Login')).toHaveValue('usuario-producao'))
    expect(screen.getByText('Pendente')).toBeInTheDocument()
    expect(screen.queryByText('Validada')).not.toBeInTheDocument()
  })
})
