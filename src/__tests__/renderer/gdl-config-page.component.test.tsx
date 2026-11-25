import type { ReactNode } from 'react';
import type { RenderOptions } from '@testing-library/react';
import { ConexaoGdlProvider } from '@/contexts/ConexaoGdlContext';
import { fireEvent, render as renderOriginal, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GdlConfigPage } from '@/pages/GdlConfigPage'

const ipcApiOriginal = window.ipcAPI
const configuracoes = new Map<string, string>()
const obterConfiguracao = vi.fn(async (chave: string) => ({ success: true, data: configuracoes.get(chave) ?? null }))
const salvarConfiguracao = vi.fn(async (chave: string, valor: string) => {
  configuracoes.set(chave, valor)
  return { success: true }
})
const obterEstadoCredenciais = vi.fn<(ambiente: string) => Promise<{ success: boolean; data?: { configuradas: boolean; cpfValido: boolean }; error?: string }>>(async ambiente => ({
  success: true,
  data: {
    configuradas: Boolean(configuracoes.get(`gdl_login_${ambiente}`) && configuracoes.get(`gdl_senha_${ambiente}`)),
    cpfValido: Boolean(configuracoes.get(`gdl_cpf_usuario_${ambiente}`) === '52998224725'),
  },
}))
const salvarCredenciais = vi.fn(async (ambiente: string, credenciais: { login: string; senha: string; cpfUsuario: string }) => {
  configuracoes.set(`gdl_login_${ambiente}`, credenciais.login)
  configuracoes.set(`gdl_senha_${ambiente}`, credenciais.senha)
  configuracoes.set(`gdl_cpf_usuario_${ambiente}`, credenciais.cpfUsuario)
  return { success: true }
})

describe('GdlConfigPage', () => {
  beforeEach(() => {
    configuracoes.clear()
    obterConfiguracao.mockClear()
    obterConfiguracao.mockImplementation(async (chave: string) => ({ success: true, data: configuracoes.get(chave) ?? null }))
    salvarConfiguracao.mockClear()
    obterEstadoCredenciais.mockClear()
    obterEstadoCredenciais.mockImplementation(async ambiente => ({
      success: true,
      data: {
        configuradas: Boolean(configuracoes.get(`gdl_login_${ambiente}`) && configuracoes.get(`gdl_senha_${ambiente}`)),
        cpfValido: configuracoes.get(`gdl_cpf_usuario_${ambiente}`) === '52998224725',
      },
    }))
    salvarCredenciais.mockClear()
    Object.defineProperty(window, 'ipcAPI', {
      value: {
        ...ipcApiOriginal,
        configuracao: { ...ipcApiOriginal.configuracao, obter: obterConfiguracao, salvar: salvarConfiguracao },
        gdl: {
          ...ipcApiOriginal.gdl,
          onEstadoConexaoAlterado: () => () => undefined,
          obterEstadoConexao: vi.fn().mockResolvedValue({ success: true, data: { ambiente: 'producao', revisao: 0, versaoEstado: 0,
            rede: 'desconhecida', redeVerificadaEm: null, credenciais: 'pendentes', credenciaisValidadasEm: null, web: 'desconhecida', verificando: false } }),
          verificarConexao: vi.fn().mockResolvedValue({ success: false }),
          obterEstadoCredenciais,
          salvarCredenciais,
          excluirCredenciais: vi.fn().mockResolvedValue({ success: true }),
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

  it('ativa a listagem depois de salvar credenciais e ambiente', async () => {
    render(<GdlConfigPage />)
    const salvar = screen.getByRole('button', { name: 'Salvar Configurações' })
    await waitFor(() => expect(salvar).toBeEnabled())
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'usuario' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha' } })
    fireEvent.change(screen.getByLabelText('CPF do usuário do GDL'), { target: { value: '529.982.247-25' } })
    fireEvent.click(salvar)
    await waitFor(() => expect(window.ipcAPI.gdl.definirPreferenciaListagem).toHaveBeenCalledWith(true))
    await waitFor(() => expect(salvarCredenciais).toHaveBeenCalledWith('producao', { login: 'usuario', senha: 'senha', cpfUsuario: '52998224725' }))
    expect(configuracoes.get('gdl_ambiente')).toBe('producao')
    expect(configuracoes.get('gdl_cpf_usuario_producao')).toBe('52998224725')
    expect(screen.getByRole('button', { name: 'Desativar listagem' })).toBeEnabled()
  })

  it('não ativa a listagem quando as credenciais não foram salvas', async () => {
    render(<GdlConfigPage />)
    const salvar = screen.getByRole('button', { name: 'Salvar Configurações' })
    await waitFor(() => expect(salvar).toBeEnabled())
    fireEvent.click(salvar)
    expect(await screen.findByText(/Preencha login, senha e CPF/)).toBeInTheDocument()
    expect(window.ipcAPI.gdl.definirPreferenciaListagem).not.toHaveBeenCalled()
  })

  it.each(['', '529982247', '11111111111', '52998224724', '52998224715'])('bloqueia salvamento com CPF ausente ou inválido: %s', async cpf => {
    render(<GdlConfigPage />)
    const salvar = screen.getByRole('button', { name: 'Salvar Configurações' })
    await waitFor(() => expect(salvar).toBeEnabled())
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'usuario' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha' } })
    fireEvent.change(screen.getByLabelText('CPF do usuário do GDL'), { target: { value: cpf } })
    fireEvent.click(salvar)
    expect(await screen.findByText(cpf ? /Informe um CPF válido/ : /Preencha CPF/)).toBeInTheDocument()
    expect(salvarCredenciais).not.toHaveBeenCalled()
    expect(window.ipcAPI.gdl.definirPreferenciaListagem).not.toHaveBeenCalled()
    expect(screen.getByLabelText('CPF do usuário do GDL')).toHaveAttribute('aria-invalid', 'true')
  })

  it('orienta cadastro antigo sem CPF sem desativar a listagem nem alterar credenciais', async () => {
    configuracoes.set('gdl_login_producao', 'usuario')
    configuracoes.set('gdl_senha_producao', 'senha')
    vi.mocked(window.ipcAPI.gdl.obterPreferenciaListagem).mockResolvedValue({ success: true, data: { habilitada: true }, error: '' })
    render(<GdlConfigPage />)
    expect(await screen.findByText(/Complete seu cadastro com um CPF válido/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desativar listagem' })).toBeEnabled()
    expect(salvarConfiguracao).not.toHaveBeenCalled()
    expect(window.ipcAPI.gdl.definirPreferenciaListagem).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'usuario' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha' } })
    fireEvent.change(screen.getByLabelText('CPF do usuário do GDL'), { target: { value: '52998224725' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Configurações' }))
    await waitFor(() => expect(salvarCredenciais).toHaveBeenCalledWith('producao', { login: 'usuario', senha: 'senha', cpfUsuario: '52998224725' }))
  })

  it('exclui as credenciais somente após confirmar e limpa os campos', async () => {
    configuracoes.set('gdl_login_producao', 'usuario')
    configuracoes.set('gdl_senha_producao', 'senha')
    configuracoes.set('gdl_cpf_usuario_producao', '12345678901')
    render(<GdlConfigPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Excluir credenciais' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Excluir credenciais' }))
    expect(window.ipcAPI.gdl.excluirCredenciais).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^Excluir$/ }))
    await waitFor(() => expect(screen.getByLabelText('Login')).toHaveValue(''))
    expect(window.ipcAPI.gdl.excluirCredenciais).toHaveBeenCalledWith('producao')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
    expect(screen.getByLabelText('CPF do usuário do GDL')).toHaveValue('')
  })

  it('preserva as credenciais e permite tentar novamente quando a exclusão falha', async () => {
    configuracoes.set('gdl_login_producao', 'usuario')
    configuracoes.set('gdl_senha_producao', 'senha')
    vi.mocked(window.ipcAPI.gdl.excluirCredenciais).mockResolvedValueOnce({ success: false, error: 'Banco indisponível' })
    render(<GdlConfigPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Excluir credenciais' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Excluir credenciais' }))
    fireEvent.click(screen.getByRole('button', { name: /^Excluir$/ }))
    expect(await screen.findByText('Banco indisponível')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Excluir$/ })).toBeEnabled()
    expect(screen.getByLabelText('Login')).toHaveValue('')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
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

  it('falha ao ler o estado das credenciais e preserva edição na nova tentativa', async () => {
    obterEstadoCredenciais.mockResolvedValueOnce({ success: false, error: 'Falha de leitura' })
    render(<GdlConfigPage />)

    expect(await screen.findByText('Falha de leitura')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar Configurações' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Login'), { target: { value: 'edicao-local' } })
    obterEstadoCredenciais.mockResolvedValue({ success: true, data: { configuradas: true, cpfValido: true } })
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar Configurações' })).toBeEnabled())
    expect(screen.getByLabelText('Login')).toHaveValue('edicao-local')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
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

  it('ignora estado de credenciais e validação atrasados do ambiente anterior', async () => {
    configuracoes.set('gdl_homologacao_habilitada', 'true')
    let concluirEstadoHomologacao: ((valor: { success: boolean; data: { configuradas: boolean; cpfValido: boolean } }) => void) | undefined
    obterEstadoCredenciais.mockImplementation((ambiente: string) => ambiente === 'homologacao'
      ? new Promise(resolve => { concluirEstadoHomologacao = resolve })
      : Promise.resolve({ success: true, data: { configuradas: true, cpfValido: true } }))
    const obterValidacao = window.ipcAPI.gdl.obterValidacaoSessao as ReturnType<typeof vi.fn>
    let concluirValidacaoHomologacao: ((valor: { success: boolean; data: { ambiente: string; validado: boolean } }) => void) | undefined
    obterValidacao.mockImplementation((ambiente: string) => ambiente === 'homologacao'
      ? new Promise(resolve => { concluirValidacaoHomologacao = resolve })
      : Promise.resolve({ success: true, data: { ambiente: 'Produção', validado: false } }))
    render(<GdlConfigPage />)
    await waitFor(() => expect(screen.getByText(/Há credenciais salvas/)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Homologação.*Ambiente de testes/s }))
    await waitFor(() => expect(concluirEstadoHomologacao).toBeDefined())
    await waitFor(() => expect(concluirValidacaoHomologacao).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: /Produção.*Ambiente real/s }))
    concluirEstadoHomologacao?.({ success: true, data: { configuradas: false, cpfValido: false } })
    concluirValidacaoHomologacao?.({ success: true, data: { ambiente: 'Homologação', validado: true } })

    await waitFor(() => expect(screen.getByText(/Há credenciais salvas/)).toBeInTheDocument())
    expect(screen.getByText('Pendente')).toBeInTheDocument()
    expect(screen.queryByText('Validada')).not.toBeInTheDocument()
  })
})

const render = (ui: ReactNode, opcoes?: RenderOptions) => renderOriginal(<ConexaoGdlProvider>{ui}</ConexaoGdlProvider>, opcoes);
