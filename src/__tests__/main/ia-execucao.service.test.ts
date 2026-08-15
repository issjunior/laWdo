import { beforeEach, describe, expect, it, vi } from 'vitest'

const configuracaoObterMock = vi.fn()
const configuracaoSalvarMock = vi.fn()
const obterImagemLaudoPorIdMock = vi.fn()
const fetchMock = vi.fn()
const logInfoMock = vi.fn()
const logWarnMock = vi.fn()

vi.mock('../../main/services/configuracao.service.js', () => ({
  configuracaoService: {
    obter: (...args: unknown[]) => configuracaoObterMock(...args),
    salvar: (...args: unknown[]) => configuracaoSalvarMock(...args),
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

import { ErroExecucaoIa, IaExecucaoService } from '../../main/services/ia-execucao.service'

const solicitacao = {
  operationId: 'operacao-1',
  laudoId: 'laudo-1',
  imagemId: 'imagem-1',
}

const solicitacaoTexto = {
  operationId: 'operacao-texto-1',
  acao: 'resumir' as const,
  escopo: 'secao' as const,
  contextoResolvido: 'Preâmbulo recebido em 4 de agosto de 2026, em Curitiba.',
  fragmentos: [{ id: 'texto-0', texto: 'Texto original do preâmbulo.' }],
}

const solicitacaoConsulta = {
  operationId: 'consulta-1',
  pergunta: 'Quantas armas foram examinadas?',
  escopo: 'laudo_completo' as const,
  fingerprint: 'a'.repeat(64),
  memoria: [],
  blocos: [{
    id: 'secao-1:1', tipo: 'tabela' as const, ordem: 0, secaoId: 'secao-1', secaoTitulo: 'Exames', titulo: 'Armas', ancora: 'armas',
    texto: 'Foram examinadas três armas.',
  }],
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
    configuracaoSalvarMock.mockReset()
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

  it('envia contexto resolvido no modo integral e solicita resposta JSON', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        fragmentos: [{ id: 'texto-0', texto: 'Resumo do preâmbulo.' }],
      }) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const resposta = await new IaExecucaoService().executar(solicitacaoTexto)

    expect(resposta.fragmentos[0].texto).toBe('Resumo do preâmbulo.')
    const [, opcoes] = fetchMock.mock.calls[0] as [string, RequestInit]
    const corpo = JSON.parse(String(opcoes.body)) as {
      response_format?: { type?: string }
      messages: Array<{ content: string }>
    }
    expect(corpo.response_format).toEqual({ type: 'json_object' })
    expect(corpo.messages[1].content).toContain('4 de agosto de 2026, em Curitiba')
  })

  it('faz uma tentativa corretiva quando o provedor retorna formato inválido', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: 'Não consegui gerar o JSON.' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '```json\n{"fragmentos":[{"id":"texto-0","texto":"Resumo corrigido."}]}\n```' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const resposta = await new IaExecucaoService().executar(solicitacaoTexto)

    expect(resposta.fragmentos[0].texto).toBe('Resumo corrigido.')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, segundaOpcoes] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(String(segundaOpcoes.body)).toContain('resposta anterior não respeitou o contrato')
  })

  it('corrige uma resposta de consulta factual que não respeita o contrato', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'Foram três armas.' } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ estado: 'respondida', resposta: 'Foram examinadas três armas.', evidencias: ['secao-1:1'], itens: ['arma A', 'arma B', 'arma C'], total: 3 }) } }] }), { status: 200 }))

    const resposta = await new IaExecucaoService().consultar(solicitacaoConsulta)

    expect(resposta.total).toBe(3)
    expect(resposta.evidencias).toEqual([{ blocoId: 'secao-1:1' }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, segundaOpcoes] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(String(segundaOpcoes.body)).toContain('resposta anterior não respeitou o contrato')
  })

  it('expõe contagem inconsistente como conflito em vez de ocultar a resposta por erro genérico', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ estado: 'respondida', resposta: 'Foram três armas.', evidencias: ['secao-1:1'], itens: ['arma A', 'arma A'], total: 3 }) } }],
    }), { status: 200 }))

    const resposta = await new IaExecucaoService().consultar(solicitacaoConsulta)

    expect(resposta).toMatchObject({
      estado: 'conflitante',
      evidencias: [{ blocoId: 'secao-1:1' }],
    })
    expect(resposta.resposta).toContain('contagem inconsistente')
  })

  it('preserva somente o prazo de nova tentativa informado pelo cabeçalho do provedor ao atingir HTTP 429', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 429, headers: { 'retry-after': '0' } }))

    let erro: unknown
    try {
      await new IaExecucaoService().consultar(solicitacaoConsulta)
    } catch (causa: unknown) {
      erro = causa
    }

    expect(erro).toBeInstanceOf(ErroExecucaoIa)
    expect((erro as ErroExecucaoIa).message).toBe('LIMITE_REQUISICOES')
    expect((erro as ErroExecucaoIa).limiteRequisicoes).toMatchObject({
      provedor: 'gemini',
      categoria: 'desconhecido',
      fonteTempo: 'retry_after',
    })
    expect((erro as ErroExecucaoIa).limiteRequisicoes?.tentarNovamenteEm).toEqual(expect.any(Number))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('interpreta RetryInfo e QuotaFailure do Gemini sem supor quando a cota será renovada', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      error: {
        status: 'RESOURCE_EXHAUSTED',
        details: [
          { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '0s' },
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_input_token_count' }],
          },
        ],
      },
    }), { status: 429 }))

    let erro: unknown
    try {
      await new IaExecucaoService().consultar(solicitacaoConsulta)
    } catch (causa: unknown) {
      erro = causa
    }

    expect((erro as ErroExecucaoIa).limiteRequisicoes).toMatchObject({
      provedor: 'gemini',
      categoria: 'tokens',
      fonteTempo: 'retry_info',
      identificadorCota: 'generativelanguage.googleapis.com/generate_content_input_token_count',
    })
    expect((erro as ErroExecucaoIa).limiteRequisicoes?.tentarNovamenteEm).toEqual(expect.any(Number))
  })

  it('registra no diagnóstico somente metadados seguros do HTTP 429 terminal', async () => {
    const registrarDiagnostico = vi.fn()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      error: {
        status: 'RESOURCE_EXHAUSTED',
        code: 429,
        type: 'insufficient_quota',
        message: 'segredo-do-corpo-do-provedor',
        details: [
          { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '10s' },
          {
            '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
            violations: [{
              quotaMetric: 'generativelanguage.googleapis.com/generate_content_input_token_count',
              quotaId: 'GenerateContentInputTokensPerModelPerMinute-FreeTier',
            }],
          },
        ],
      },
    }), { status: 429, headers: { 'Content-Type': 'application/json; charset=utf-8' } }))
    const servico = new IaExecucaoService()
    servico.configurarRegistradorDiagnostico(registrarDiagnostico)

    await expect(servico.consultar(solicitacaoConsulta)).rejects.toThrow('LIMITE_REQUISICOES')

    expect(registrarDiagnostico).toHaveBeenCalledTimes(1)
    expect(registrarDiagnostico).toHaveBeenCalledWith({
      evento: 'limite_uso_ia',
      codigo: 'HTTP_429',
      operationId: 'consulta-1',
      provedor: 'gemini',
      modelo: 'gemini-2.5-flash',
      statusHttp: 429,
      tentativa: 1,
      totalTentativas: 3,
      categoriaCota: 'tokens',
      fonteTempo: 'retry_info',
      formatoCorpoResposta: 'objeto_json',
      mimeResposta: 'application/json; charset=utf-8',
      statusErroProvedor: 'RESOURCE_EXHAUSTED',
      codigoErroProvedor: 429,
      tipoErroProvedor: 'insufficient_quota',
      tiposDetalhes: [
        'type.googleapis.com/google.rpc.RetryInfo',
        'type.googleapis.com/google.rpc.QuotaFailure',
      ],
      metricaCota: 'generativelanguage.googleapis.com/generate_content_input_token_count',
      identificadorCota: 'GenerateContentInputTokensPerModelPerMinute-FreeTier',
      retryDelayMs: expect.any(Number),
    })
    expect(JSON.stringify(registrarDiagnostico.mock.calls)).not.toContain('segredo-do-corpo-do-provedor')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('extrai apenas metadados permitidos quando o HTTP 429 traz um array JSON', async () => {
    const registrarDiagnostico = vi.fn()
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{
      code: 'RESOURCE_EXHAUSTED',
      type: 'rate_limit',
      status: 'RESOURCE_EXHAUSTED',
      message: 'segredo-do-array-do-provedor',
      detalhesInternos: 'não registrar',
    }]), { status: 429, headers: { 'Content-Type': 'application/json' } }))
    const servico = new IaExecucaoService()
    servico.configurarRegistradorDiagnostico(registrarDiagnostico)

    await expect(servico.consultar(solicitacaoConsulta)).rejects.toThrow('LIMITE_REQUISICOES')

    expect(registrarDiagnostico).toHaveBeenCalledWith(expect.objectContaining({
      formatoCorpoResposta: 'array_json',
      mimeResposta: 'application/json',
      quantidadeItensCorpo: 1,
      chavesPrimeiroItem: ['status', 'code', 'type'],
      statusErroProvedor: 'RESOURCE_EXHAUSTED',
      codigoErroProvedor: 'RESOURCE_EXHAUSTED',
      tipoErroProvedor: 'rate_limit',
    }))
    expect(JSON.stringify(registrarDiagnostico.mock.calls)).not.toContain('segredo-do-array-do-provedor')
    expect(JSON.stringify(registrarDiagnostico.mock.calls)).not.toContain('não registrar')
  })

  it('não repete HTTP 429 nem inventa prazo quando o Gemini não oferece RetryInfo ou cabeçalho', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } }), { status: 429 }))

    let erro: unknown
    try {
      await new IaExecucaoService().consultar(solicitacaoConsulta)
    } catch (causa: unknown) {
      erro = causa
    }

    expect((erro as ErroExecucaoIa).limiteRequisicoes).toEqual({
      provedor: 'gemini',
      categoria: 'desconhecido',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('cruza o catálogo local com a disponibilidade remota sem trocar o modelo automaticamente', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'gemini-2.5-flash' }],
    }), { status: 200 }))

    const modelos = await new IaExecucaoService().listarModelosDisponiveis()

    expect(modelos).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'gemini-2.5-flash', disponibilidade: 'disponivel' }),
      expect.objectContaining({ id: 'gemini-2.5-pro', disponibilidade: 'removido' }),
    ]))
    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/openai/models',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer chave-teste' }) }),
    )
  })

  it('extrai blocos extensos em paralelo limitado e consolida sem reenviar o documento completo', async () => {
    const consultaExtensa = {
      ...solicitacaoConsulta,
      blocos: ['A', 'B', 'C'].map((arma, indice) => ({
        id: `secao-1:${indice + 1}`,
        tipo: 'paragrafo' as const,
        ordem: indice,
        secaoId: 'secao-1',
        secaoTitulo: 'Armas',
        titulo: `Arma ${arma}`,
        ancora: `arma-${arma}`,
        texto: `${arma} `.repeat(10_000),
      })),
    }
    for (const indice of [1, 2, 3]) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ estado: 'respondida', resposta: `Arma ${indice}.`, evidencias: [`secao-1:${indice}`], itens: [`arma ${indice}`], total: 1 }) } }],
      }), { status: 200 }))
    }
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ estado: 'respondida', resposta: 'Foram três armas.', evidencias: ['secao-1:1', 'secao-1:2', 'secao-1:3'], itens: ['arma 1', 'arma 2', 'arma 3'], total: 3 }) } }],
    }), { status: 200 }))

    const resposta = await new IaExecucaoService().consultar(consultaExtensa)

    expect(resposta.total).toBe(3)
    expect(fetchMock).toHaveBeenCalledTimes(4)
    const [, opcoesConsolidacao] = fetchMock.mock.calls[3] as [string, RequestInit]
    const corpoConsolidacao = JSON.parse(String(opcoesConsolidacao.body)) as { messages: Array<{ content: string }> }
    expect(corpoConsolidacao.messages[1].content).toContain('extracoes')
    expect(corpoConsolidacao.messages[1].content).not.toContain('A A A A A A A A')
  })

  it('consolida as evidências da fixture B-602 distribuídas entre três armas', async () => {
    const consultaB602 = {
      ...solicitacaoConsulta,
      operationId: 'consulta-b602-1',
      pergunta: 'Quais armas tiveram exame de prestabilidade?',
      blocos: [
        ['arma-a', 'Arma A. Exame de prestabilidade realizado.'],
        ['arma-b', 'Arma B. Coleta de padrão balístico realizada.'],
        ['arma-c', 'Arma C. Exames de prestabilidade e coleta de padrão balístico realizados.'],
      ].map(([id, descricao], ordem) => ({
        id,
        tipo: 'paragrafo' as const,
        ordem,
        secaoId: 'b602-armas',
        secaoTitulo: 'Armas examinadas',
        titulo: `Arma ${String.fromCharCode(65 + ordem)}`,
        ancora: id,
        texto: `${descricao} `.repeat(9000),
      })),
    }
    const extracoes = [
      { id: 'arma-a', itens: ['Arma A'], resposta: 'A arma A teve exame de prestabilidade.' },
      { id: 'arma-b', itens: [], resposta: 'A arma B não teve exame de prestabilidade.' },
      { id: 'arma-c', itens: ['Arma C'], resposta: 'A arma C teve exame de prestabilidade.' },
    ];
    for (const extracao of extracoes) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ estado: 'respondida', resposta: extracao.resposta, evidencias: [extracao.id], itens: extracao.itens, total: extracao.itens.length }) } }],
      }), { status: 200 }));
    }
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ estado: 'respondida', resposta: 'As armas A e C tiveram exame de prestabilidade.', evidencias: ['arma-a', 'arma-c'], itens: ['Arma A', 'Arma C'], total: 2 }) } }],
    }), { status: 200 }));

    const resposta = await new IaExecucaoService().consultar(consultaB602);

    expect(resposta).toMatchObject({
      estado: 'respondida',
      total: 2,
      itens: ['Arma A', 'Arma C'],
      evidencias: [{ blocoId: 'arma-a' }, { blocoId: 'arma-c' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  })

  it('repete sem response_format quando o modelo não aceita JSON mode', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{}', { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '{"fragmentos":[{"id":"texto-0","texto":"Resumo compatível."}]}' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const resposta = await new IaExecucaoService().executar(solicitacaoTexto)

    expect(resposta.fragmentos[0].texto).toBe('Resumo compatível.')
    const [, primeiraOpcoes] = fetchMock.mock.calls[0] as [string, RequestInit]
    const [, segundaOpcoes] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(String(primeiraOpcoes.body)).toContain('response_format')
    expect(String(segundaOpcoes.body)).not.toContain('response_format')
  })

  it('não envia o contexto resolvido ao provedor no modo protegido', async () => {
    configuracaoObterMock.mockImplementation(async (chave: string) => {
      const configuracoes: Record<string, string> = {
        provedor_ia: 'gemini',
        api_key_gemini: 'chave-teste',
        modelo_gemini_padrao: 'gemini-2.5-flash',
        privacidade_ia: JSON.stringify({ versao: 1, enviarConteudoIntegral: false }),
      }
      return configuracoes[chave] ?? null
    })
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"fragmentos":[{"id":"texto-0","texto":"Resumo protegido."}]}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await new IaExecucaoService().executar(solicitacaoTexto)

    const [, opcoes] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(opcoes.body)).not.toContain('4 de agosto de 2026')
    expect(String(opcoes.body)).toContain('não fornecido no modo protegido')
  })

  it('processa lotes sequencialmente e publica progresso sem retornar resultado parcial', async () => {
    const solicitacaoEmLotes = {
      ...solicitacaoTexto,
      fragmentos: [
        { id: 'texto-0', texto: 'a'.repeat(30_000) },
        { id: 'texto-1', texto: 'b'.repeat(30_000) },
      ],
    }
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '{"fragmentos":[{"id":"texto-0","texto":"Lote um."}]}' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '{"fragmentos":[{"id":"texto-1","texto":"Lote dois."}]}' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const progressos: Array<{ fase: string; loteAtual: number; chamadasConcluidas: number }> = []

    const servico = new IaExecucaoService()
    const plano = await servico.planejar(solicitacaoEmLotes)
    const resposta = await servico.executar(
      { ...solicitacaoEmLotes, planoId: plano.planoId },
      progresso => progressos.push(progresso),
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(resposta.fragmentos).toEqual([
      { id: 'texto-0', texto: 'Lote um.' },
      { id: 'texto-1', texto: 'Lote dois.' },
    ])
    expect(progressos).toEqual(expect.arrayContaining([
      expect.objectContaining({ fase: 'preparando', loteAtual: 0, chamadasConcluidas: 0 }),
      expect.objectContaining({ fase: 'processando', loteAtual: 1, chamadasConcluidas: 0 }),
      expect.objectContaining({ fase: 'processando', loteAtual: 2, chamadasConcluidas: 1 }),
      expect.objectContaining({ fase: 'concluido', loteAtual: 2, chamadasConcluidas: 2 }),
    ]))
  })

  it('interrompe uma operação cancelada entre lotes', async () => {
    const servico = new IaExecucaoService()
    const solicitacaoEmLotes = {
      ...solicitacaoTexto,
      fragmentos: [
        { id: 'texto-0', texto: 'a'.repeat(30_000) },
        { id: 'texto-1', texto: 'b'.repeat(30_000) },
      ],
    }
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"fragmentos":[{"id":"texto-0","texto":"Lote um."}]}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const plano = await servico.planejar(solicitacaoEmLotes)
    await expect(servico.executar({ ...solicitacaoEmLotes, planoId: plano.planoId }, progresso => {
      if (progresso.fase === 'processando' && progresso.loteAtual === 2) {
        servico.cancelar(solicitacaoEmLotes.operationId)
      }
    })).rejects.toThrow('CANCELADO')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('planeja sem chamar o provedor e exige confirmação para múltiplos lotes', async () => {
    const servico = new IaExecucaoService()
    const solicitacaoEmLotes = {
      ...solicitacaoTexto,
      fragmentos: [
        { id: 'texto-0', texto: 'a'.repeat(30_000) },
        { id: 'texto-1', texto: 'b'.repeat(30_000) },
      ],
    }

    const plano = await servico.planejar(solicitacaoEmLotes)

    expect(plano).toEqual(expect.objectContaining({
      totalLotes: 2,
      chamadasBase: 2,
      requerConfirmacao: true,
      provedor: 'gemini',
      modelo: 'gemini-2.5-flash',
    }))
    expect(plano.planoId).toMatch(/^[a-f0-9]{64}$/)
    expect(fetchMock).not.toHaveBeenCalled()
    await expect(servico.executar(solicitacaoEmLotes)).rejects.toThrow('CONFIRMACAO_NECESSARIA')
  })

  it('recusa um plano quando o perfil muda depois da confirmação', async () => {
    const servico = new IaExecucaoService()
    const plano = await servico.planejar(solicitacaoTexto)
    configuracaoObterMock.mockImplementation(async (chave: string) => {
      const configuracoes: Record<string, string> = {
        provedor_ia: 'gemini',
        api_key_gemini: 'chave-teste',
        modelo_gemini_padrao: 'gemini-2.5-flash',
        privacidade_ia: JSON.stringify({ versao: 1, enviarConteudoIntegral: true }),
        perfil_resposta_ia: JSON.stringify({
          versao: 1,
          tom: 'formal',
          detalhamento: 'equilibrado',
          instrucoesPersonalizadas: '',
        }),
      }
      return configuracoes[chave] ?? null
    })

    await expect(servico.executar({ ...solicitacaoTexto, planoId: plano.planoId }))
      .rejects.toThrow('PLANO_ALTERADO')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('preserva lotes concluídos e retoma somente com o mesmo fingerprint do plano', async () => {
    const servico = new IaExecucaoService()
    const solicitacaoEmLotes = {
      ...solicitacaoTexto,
      fragmentos: [
        { id: 'texto-0', texto: 'a'.repeat(30_000) },
        { id: 'texto-1', texto: 'b'.repeat(30_000) },
      ],
    }
    const plano = await servico.planejar(solicitacaoEmLotes)
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '{"fragmentos":[{"id":"texto-0","texto":"Lote preservado."}]}' } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))

    let retomada: { retomadaId: string; planoId: string } | undefined
    try {
      await servico.executar({ ...solicitacaoEmLotes, planoId: plano.planoId })
    } catch (error: unknown) {
      retomada = error && typeof error === 'object' && 'retomada' in error
        ? (error as { retomada?: { retomadaId: string; planoId: string } }).retomada
        : undefined
    }
    expect(retomada).toEqual(expect.objectContaining({ planoId: plano.planoId }))

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: '{"fragmentos":[{"id":"texto-1","texto":"Lote retomado."}]}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const resposta = await servico.executar({
      ...solicitacaoEmLotes,
      operationId: 'operacao-retomada',
      planoId: plano.planoId,
      retomadaId: retomada?.retomadaId,
    })

    expect(resposta.fragmentos).toEqual([
      { id: 'texto-0', texto: 'Lote preservado.' },
      { id: 'texto-1', texto: 'Lote retomado.' },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
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

  it('normaliza o perfil persistido e rejeita preferências inválidas antes de salvar', async () => {
    configuracaoObterMock.mockImplementation(async (chave: string) => {
      if (chave === 'perfil_resposta_ia') return JSON.stringify({
        versao: 1,
        tom: 'formal',
        detalhamento: 'detalhado',
        instrucoesPersonalizadas: 'Use frases objetivas.',
        temperatura: 0.7,
      })
      return null
    })
    const servico = new IaExecucaoService()

    await expect(servico.obterPerfil()).resolves.toMatchObject({ tom: 'formal', temperatura: 0.7 })
    await expect(servico.salvarPerfil({
      versao: 1,
      tom: 'direto',
      detalhamento: 'conciso',
      instrucoesPersonalizadas: '',
      temperatura: 0.1,
    })).resolves.toBeUndefined()
    expect(configuracaoSalvarMock).toHaveBeenCalledWith(
      'perfil_resposta_ia',
      expect.stringContaining('"tom":"direto"'),
      'json',
      'Preferências das respostas de IA',
    )
    await expect(servico.salvarPerfil({ versao: 1, tom: 'direto', detalhamento: 'conciso', instrucoesPersonalizadas: '', temperatura: 2 }))
      .rejects.toThrow('Perfil de resposta inválido')
  })

  it('expõe contexto não configurado e rejeita solicitações de execução inválidas', async () => {
    configuracaoObterMock.mockResolvedValue(null)
    const servico = new IaExecucaoService()

    await expect(servico.obterContexto()).resolves.toEqual({ configurado: false, suportaVisao: false })
    await expect(servico.executar({ ...solicitacaoTexto, operationId: '', fragmentos: [] }))
      .rejects.toThrow('Solicitação de IA inválida')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
