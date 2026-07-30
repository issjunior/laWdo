import { beforeEach, describe, expect, it, vi } from 'vitest'

const configuracaoObterMock = vi.fn()
const obterImagemLaudoPorIdMock = vi.fn()
const fetchMock = vi.fn()
const logInfoMock = vi.fn()
const logWarnMock = vi.fn()

vi.mock('../../main/services/configuracao.service.js', () => ({
  configuracaoService: {
    obter: (...args: unknown[]) => configuracaoObterMock(...args),
    salvar: vi.fn(),
  },
}))

vi.mock('../../main/services/imagem-laudo.service.js', () => ({
  obterImagemLaudoPorId: (...args: unknown[]) => obterImagemLaudoPorIdMock(...args),
}))

vi.mock('../../main/utils/logger.js', () => ({
  getLogger: () => ({
    info: (...args: unknown[]) => logInfoMock(...args),
    warn: (...args: unknown[]) => logWarnMock(...args),
  }),
}))

import { IaExecucaoService } from '../../main/services/ia-execucao.service'

const solicitacao = {
  operationId: 'operacao-1',
  laudoId: 'laudo-1',
  imagemId: 'imagem-1',
}

const criarImagem = (origem: 'local' | 'gdl' = 'local', mimeType = 'image/jpeg', tamanho = 128) => ({
  id: 'imagem-1',
  laudoId: 'laudo-1',
  nomeArquivo: 'imagem.jpg',
  mimeType,
  tamanho,
  sha256: 'a'.repeat(64),
  legenda: 'Figura 01',
  origem,
  sequencia: 1,
  dataUri: `data:${mimeType};base64,YWJj`,
  createdAt: '2026-07-30T12:00:00.000Z',
})

describe('ia-execucao.service — descrição de imagem', () => {
  beforeEach(() => {
    configuracaoObterMock.mockReset()
    obterImagemLaudoPorIdMock.mockReset()
    fetchMock.mockReset()
    logInfoMock.mockReset()
    logWarnMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)

    configuracaoObterMock.mockImplementation(async (chave: string) => {
      const configuracoes: Record<string, string> = {
        provedor_ia: 'gemini',
        api_key_gemini: 'chave-teste',
        modelo_gemini_padrao: 'gemini-2.5-flash',
        privacidade_ia: JSON.stringify({
          versao: 1,
          enviarConteudoIntegral: true,
        }),
      }
      return configuracoes[chave] ?? null
    })
  })

  it.each(['local', 'gdl'] as const)('deve descrever imagem persistida de origem %s como texto simples', async (origem) => {
    obterImagemLaudoPorIdMock.mockResolvedValue(criarImagem(origem))
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'Imagem contendo um objeto metálico sobre uma superfície clara.' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const resposta = await new IaExecucaoService().descreverImagem(solicitacao)

    expect(resposta).toEqual({
      operationId: 'operacao-1',
      descricao: 'Imagem contendo um objeto metálico sobre uma superfície clara.',
    })
    expect(obterImagemLaudoPorIdMock).toHaveBeenCalledWith('laudo-1', 'imagem-1')

    const [, opcoes] = fetchMock.mock.calls[0] as [string, RequestInit]
    const corpo = JSON.parse(String(opcoes.body)) as {
      messages: Array<{ role: string; content: string | Array<{ type: string; image_url?: { url: string } }> }>
    }
    expect(corpo.messages).toHaveLength(2)
    const conteudoUsuario = corpo.messages[1].content
    expect(Array.isArray(conteudoUsuario)).toBe(true)
    expect(conteudoUsuario).toHaveLength(2)
    expect(conteudoUsuario[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,YWJj' },
    })
    expect(String(opcoes.body)).not.toContain('{{')
    expect(String(opcoes.body)).not.toContain('fragmentos')
    expect(String(opcoes.body)).not.toContain('b602_tabela_estojos')
  })

  it('deve rejeitar resposta multimodal vazia', async () => {
    obterImagemLaudoPorIdMock.mockResolvedValue(criarImagem())
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '   ' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await expect(new IaExecucaoService().descreverImagem(solicitacao))
      .rejects.toThrow('RESPOSTA_VAZIA')
    expect(logWarnMock).toHaveBeenCalledWith(
      'Resposta multimodal vazia',
      expect.objectContaining({ fase: 'conteudo_vazio' }),
    )
  })

  it('deve rejeitar formato incompatível antes de chamar o provedor', async () => {
    obterImagemLaudoPorIdMock.mockResolvedValue(criarImagem('local', 'image/bmp'))

    await expect(new IaExecucaoService().descreverImagem(solicitacao))
      .rejects.toThrow('FORMATO_IMAGEM_NAO_SUPORTADO')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('deve rejeitar imagem maior que o limite do provedor', async () => {
    obterImagemLaudoPorIdMock.mockResolvedValue(criarImagem('gdl', 'image/jpeg', 16 * 1024 * 1024))

    await expect(new IaExecucaoService().descreverImagem(solicitacao))
      .rejects.toThrow('IMAGEM_MUITO_GRANDE')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('deve bloquear descrição de imagem enquanto o modo protegido estiver ativo', async () => {
    configuracaoObterMock.mockImplementation(async (chave: string) => {
      const configuracoes: Record<string, string> = {
        provedor_ia: 'gemini',
        api_key_gemini: 'chave-teste',
        modelo_gemini_padrao: 'gemini-2.5-flash',
        privacidade_ia: JSON.stringify({
          versao: 1,
          enviarConteudoIntegral: false,
        }),
      }
      return configuracoes[chave] ?? null
    })

    await expect(new IaExecucaoService().descreverImagem(solicitacao))
      .rejects.toThrow('IMAGEM_PROTEGIDA')
    expect(obterImagemLaudoPorIdMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('deve propagar falha de pertencimento ao laudo sem chamar o provedor', async () => {
    obterImagemLaudoPorIdMock.mockRejectedValue(new Error('A imagem selecionada não pertence ao laudo.'))

    await expect(new IaExecucaoService().descreverImagem(solicitacao))
      .rejects.toThrow('A imagem selecionada não pertence ao laudo.')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
