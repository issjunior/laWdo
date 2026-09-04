import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  obterConfiguracao: vi.fn(),
  configurarVerificacaoCertificado: vi.fn(),
  registrarAviso: vi.fn(),
}))

vi.mock('electron', () => {
  const imagem = {
    isEmpty: () => false,
    getSize: () => ({ width: 640, height: 480 }),
    resize: () => ({ toJPEG: () => Buffer.from('thumbnail') }),
    toJPEG: () => Buffer.from('thumbnail'),
  }
  return {
    app: {
      getPath: () => path.join(os.tmpdir(), 'lawdo-gdl-service-test'),
    },
    nativeImage: {
      createFromBuffer: () => imagem,
    },
    session: {
      fromPartition: () => ({
        fetch: async (...args: Parameters<typeof globalThis.fetch>) => {
          const resposta = await globalThis.fetch(...args)
          Object.defineProperty(resposta, 'url', { value: '' })
          return resposta
        },
        setCertificateVerifyProc: mocks.configurarVerificacaoCertificado,
        clearStorageData: vi.fn().mockResolvedValue(undefined),
        webRequest: { onBeforeRequest: vi.fn() },
      }),
      defaultSession: {
        fetch: (...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args),
        setCertificateVerifyProc: mocks.configurarVerificacaoCertificado,
      },
    },
  }
})

vi.mock('../../main/services/configuracao.service.js', () => ({
  configuracaoService: {
    obter: mocks.obterConfiguracao,
  },
}))

vi.mock('../../main/utils/logger.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: mocks.registrarAviso,
    error: vi.fn(),
  }),
}))

import {
  abrirSessaoImagensRepGdl,
  capturarImagensRepGdl,
  capturarImagensDaSessaoGdlParaLaudo,
  consultarRep,
  extrairDataEntradaSolicitacaoDaPaginaGdl,
  extrairQuesitoAbertoDaPaginaGdl,
  extrairCodigoNaturezaExame,
  extrairFiltrosParaConsultaInvestigacao,
  fecharSessaoImagensRepGdl,
  limparValidacaoSessao,
  listarFotosDoArquivoZip,
  listarImagensRepGdl,
  obterValidacaoSessao,
  testarConexao,
  validarCredenciais,
} from '../../main/services/gdl.service'
import { interpretarGdlRepJson } from '../../main/services/gdl.schema'
import { destinoPaginaGdlPermitido, montarFormularioLoginGdl, paginaGdlExigeLogin } from '../../main/services/gdl-pagina.service'

const formularioLogin = '<form method="post" action="./Login.aspx"><input type="hidden" name="__VIEWSTATE" value="estado&amp;teste"><input type="hidden" name="__EVENTVALIDATION" value="validacao"><input name="ctl00$Content$txtUser"><input name="ctl00$Content$txtPass" type="password"><input type="submit" name="ctl00$Content$btnLogin" value="Entrar"><input type="submit" name="ctl00$Content$btn_NewPass" value="Nova senha"></form>'

const fixtureRep = fs.readFileSync(
  path.resolve(process.cwd(), 'src/__tests__/fixtures/gdl/rep-190-2026.json'),
  'utf8',
)
const bytesPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
const zip = new AdmZip()
zip.addFile('fotos/foto-a.png', bytesPng)
zip.addFile('fotos/foto-b.png', bytesPng)
zip.addFile('fotos/leia-me.txt', Buffer.from('arquivo auxiliar'))
const bytesZip = zip.toBuffer()

let servidor: http.Server
let baseUrl = ''
let statusUnidades = 200
let statusRep = 200
let rejeitarLogin = false
let sequenciaTeste = 0
let redirecionarPaginaParaLogin = false
const statusRepPorBusca = new Map<string, number>()
let statusFotos = 200
let respostaRep = fixtureRep
let respostaPaginaRep = '<input id="Content_RepMain_txtDateEntry" value="11/06/2024"><textarea id="Content_RepMain_txtOpenQuestion">QUESITO &amp; TESTE</textarea>'
const corposInvestigacao: string[] = []
const configuracoes: Record<string, string> = {}
let requisicoesRecebidas = 0
const requisicoesGdl: Array<{ metodo: string; caminho: string; busca: string }> = []

function responder(resposta: http.ServerResponse, status: number, corpo: string | Buffer): void {
  resposta.statusCode = status
  resposta.end(corpo)
}

beforeAll(async () => {
  servidor = http.createServer((requisicao, resposta) => {
    requisicoesRecebidas += 1
    const url = new URL(requisicao.url ?? '/', baseUrl)
    requisicoesGdl.push({ metodo: requisicao.method || '', caminho: url.pathname, busca: url.search })
    if (url.pathname.endsWith('/unidadesMedida')) {
      responder(resposta, statusUnidades, '{}')
      return
    }
    if (url.pathname.endsWith('/rep/obter')) {
      responder(resposta, statusRepPorBusca.get(url.search) ?? statusRep, respostaRep)
      return
    }
    if (url.pathname.endsWith('/REP/Default.aspx')) {
      if (redirecionarPaginaParaLogin) {
        resposta.setHeader('Location', '/Account/Login.aspx')
        responder(resposta, 302, '')
        return
      }
      responder(resposta, 200, respostaPaginaRep)
      return
    }
    if (url.pathname === '/Account/Login.aspx') {
      if (requisicao.method === 'POST' && !rejeitarLogin) {
        requisicao.resume()
        resposta.setHeader('Location', '/Default.aspx')
        responder(resposta, 302, '')
      } else responder(resposta, 200, formularioLogin.replace('type="password"', 'type="password" id="Content_txtPass"'))
      return
    }
    if (url.pathname === '/Default.aspx') {
      responder(resposta, 200, '<html>Autenticado</html>')
      return
    }
    if (url.pathname.endsWith('/repsInvestigacaoPolicial/listarReps')) {
      let corpo = ''
      requisicao.on('data', parte => { corpo += String(parte) })
      requisicao.on('end', () => {
        corposInvestigacao.push(corpo)
        responder(resposta, 200, JSON.stringify({
          dadosREPs: [
            { numeroRep: '190/2026', naturezaExame: 'B602 - EXAME BALÍSTICO', envolvidos: { nome: 'ENVOLVIDO COMPLEMENTAR' } },
            { numeroRep: '999/2026', envolvidos: { nome: 'ENVOLVIDO DE OUTRA REP' } },
          ],
        }))
      })
      return
    }
    if (url.pathname.endsWith('/Rep/Controls/PictureHandler.ashx')) {
      resposta.setHeader('content-type', 'application/zip')
      responder(resposta, statusFotos, statusFotos === 200 ? bytesZip : Buffer.alloc(0))
      return
    }
    responder(resposta, 404, '')
  })

  await new Promise<void>((resolve, reject) => {
    servidor.once('error', reject)
    servidor.listen(0, '127.0.0.1', () => resolve())
  })
  const endereco = servidor.address()
  if (!endereco || typeof endereco === 'string') throw new Error('Servidor de teste sem endereço TCP.')
  baseUrl = `http://127.0.0.1:${endereco.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    servidor.close(erro => erro ? reject(erro) : resolve())
  })
})

beforeEach(() => {
  statusUnidades = 200
  statusRep = 200
  rejeitarLogin = false
  sequenciaTeste += 1
  redirecionarPaginaParaLogin = false
  mocks.registrarAviso.mockClear()
  statusRepPorBusca.clear()
  statusFotos = 200
  respostaRep = fixtureRep
  respostaPaginaRep = '<input id="Content_RepMain_txtDateEntry" value="11/06/2024"><textarea id="Content_RepMain_txtOpenQuestion">QUESITO &amp; TESTE</textarea>'
  corposInvestigacao.length = 0
  requisicoesGdl.length = 0
  requisicoesRecebidas = 0
  Object.assign(configuracoes, {
    gdl_ambiente: 'producao',
    gdl_url_homologacao: `${baseUrl}/api`,
    gdl_url_producao: `${baseUrl}/api`,
    gdl_login_homologacao: 'usuario-hml',
    gdl_senha_homologacao: `senha-hml-${sequenciaTeste}`,
    gdl_cpf_usuario_homologacao: '123.456.789-01',
    gdl_login_producao: 'usuario-prd',
    gdl_senha_producao: `senha-prd-${sequenciaTeste}`,
    gdl_cpf_usuario_producao: '123.456.789-01',
  })
  mocks.obterConfiguracao.mockImplementation(async (chave: string) => configuracoes[chave] ?? null)
})

describe('gdl.service', () => {
  it('mantém a validação de sessão separada por ambiente', () => {
    expect(limparValidacaoSessao('producao')).toEqual({ ambiente: 'Produção', validado: false })
    expect(limparValidacaoSessao('ambiente-invalido')).toEqual({ ambiente: 'Homologação', validado: false })
    expect(obterValidacaoSessao('producao')).toEqual({ ambiente: 'Produção', validado: false })
  })

  it('testa a conectividade e descreve falhas do servidor e da rede', async () => {
    await expect(testarConexao('producao')).resolves.toMatchObject({
      sucesso: true,
      statusCode: 200,
      ambiente: 'Produção',
    })

    const verificarCertificado = mocks.configurarVerificacaoCertificado.mock.calls[0]?.[0] as ((
      requisicao: {
        hostname: string
        errorCode: number
        verificationResult: string
        certificate: { issuerName: string; fingerprint: string }
      },
      callback: (resultado: number) => void,
    ) => void) | undefined
    expect(verificarCertificado).toBeTypeOf('function')

    const callbackCertificado = vi.fn()
    verificarCertificado?.({
      hostname: 'www.gdl.sesp.parana',
      errorCode: -202,
      verificationResult: 'ERR_CERT_AUTHORITY_INVALID',
      certificate: { issuerName: 'Autoridade interna', fingerprint: 'AA:BB' },
    }, callbackCertificado)
    expect(callbackCertificado).toHaveBeenLastCalledWith(0)

    verificarCertificado?.({
      hostname: 'outro.exemplo',
      errorCode: -202,
      verificationResult: 'ERR_CERT_AUTHORITY_INVALID',
      certificate: { issuerName: 'Autoridade interna', fingerprint: 'CC:DD' },
    }, callbackCertificado)
    expect(callbackCertificado).toHaveBeenLastCalledWith(-202)

    statusUnidades = 503
    await expect(testarConexao('homologacao')).resolves.toMatchObject({
      sucesso: false,
      statusCode: 503,
      ambiente: 'Homologação',
    })

    configuracoes.gdl_url_homologacao = 'http://127.0.0.1:1/api'
    await expect(testarConexao('homologacao')).resolves.toMatchObject({
      sucesso: false,
      statusCode: 0,
    })
  })

  it('consulta a REP em homologação, complementa envolvidos e registra a sessão', async () => {
    configuracoes.gdl_ambiente = 'homologacao'
    const resultado = await consultarRep('190', '2026')

    expect(resultado.sucesso).toBe(true)
    expect(resultado.ambiente).toBe('homologacao')
    expect(resultado.dados?.envolvidos).toContainEqual({ nome: 'ENVOLVIDO COMPLEMENTAR' })
    expect(resultado.dados?.quesitoAberto).toBe('QUESITO & TESTE')
    expect(resultado.dados?.envolvidos).not.toContainEqual({ nome: 'ENVOLVIDO DE OUTRA REP' })
    expect(resultado.naturezaExame).toBe('B602 - EXAME BALÍSTICO')
    expect(corposInvestigacao).toHaveLength(2)
    expect(obterValidacaoSessao('homologacao')).toMatchObject({
      validado: true,
      numeroRep: '190',
      anoRep: '2026',
    })
  })

  it('extrai os dados complementares da página de visualização da REP', () => {
    expect(extrairQuesitoAbertoDaPaginaGdl(
      '<textarea name="ctl00$Content$RepMain$txtOpenQuestion">REP DE TESTE &#x50;ARA O LAWDO</textarea>',
    )).toBe('REP DE TESTE PARA O LAWDO')
    expect(extrairQuesitoAbertoDaPaginaGdl('<html>Sem quesito</html>')).toBe('')
    expect(extrairDataEntradaSolicitacaoDaPaginaGdl(
      '<input value="04/02/2025" name="ctl00$Content$RepMain$txtDateEntry">',
    )).toBe('2025-02-04')
    expect(extrairDataEntradaSolicitacaoDaPaginaGdl('<html>Sem data</html>')).toBe('')
  })

  it('trata ausência de credenciais e respostas HTTP da consulta de REP', async () => {
    configuracoes.gdl_login_producao = ''
    await expect(consultarRep('109.026', '2026')).resolves.toMatchObject({
      sucesso: false,
      erro: 'Credenciais não configuradas.',
    })

    configuracoes.gdl_login_producao = 'usuario-prd'
    for (const [status, erro] of [
      [404, 'REP 109.026/2026 não encontrada no GDL.'],
      [401, 'Autenticação rejeitada pelo GDL. Verifique login e senha.'],
      [500, 'Erro do servidor GDL (HTTP 500).'],
    ] as const) {
      statusRep = status
      await expect(consultarRep('109.026', '2026')).resolves.toMatchObject({ sucesso: false, erro })
    }

    statusRep = 200
    respostaRep = '{invalido'
    await expect(consultarRep('109.026', '2026')).resolves.toMatchObject({
      sucesso: false,
      erro: 'O GDL retornou JSON inválido.',
    })
  })

  it('identifica REP não encontrada quando o GDL responde 401 à consulta com credenciais já validadas', async () => {
    await expect(consultarRep('190', '2026')).resolves.toMatchObject({ sucesso: true })
    statusRepPorBusca.set('?numero=12869&ano=2024', 401)

    await expect(consultarRep('12869', '2024')).resolves.toMatchObject({
      sucesso: false,
      erro: 'REP 12869/2024 não encontrada no GDL.',
    })
    expect(obterValidacaoSessao('producao')).toMatchObject({ validado: true, numeroRep: '190', anoRep: '2026' })
  })

  it('valida credenciais por consulta real e normaliza o CPF', async () => {
    const sucesso = await validarCredenciais(
      'producao',
      { login: ' usuario ', senha: ' senha ', cpfUsuario: '123.456.789-01' },
      '109.026',
      '2026',
    )
    expect(sucesso).toMatchObject({ sucesso: true })
    expect(sucesso.dados?.codRep).toBe(1902026)
    expect(requisicoesGdl.find(requisicao => requisicao.caminho.endsWith('/rep/obter'))?.busca)
      .toBe('?numero=109026&ano=2026')

    await expect(validarCredenciais('producao', { login: '', senha: '' }, '109.026', '2026'))
      .resolves.toMatchObject({ sucesso: false, erro: 'Credenciais não configuradas.' })

    for (const [status, erro] of [
      [404, 'REP 109.026/2026 não encontrada no GDL.'],
      [403, 'Autenticação rejeitada pelo GDL. Verifique login e senha.'],
      [500, 'Erro do servidor GDL (HTTP 500).'],
    ] as const) {
      statusRep = status
      await expect(validarCredenciais('producao', { login: 'u', senha: 's' }, '109.026', '2026'))
        .resolves.toMatchObject({ sucesso: false, erro })
    }

    statusRep = 200
    respostaRep = 'não-json'
    await expect(validarCredenciais('producao', { login: 'u', senha: 's' }, '109.026', '2026'))
      .resolves.toMatchObject({ sucesso: false, erro: 'O GDL retornou JSON inválido.' })
  })

  it('lista e captura imagens do ZIP, recusando duplicadas e entradas incompatíveis', async () => {
    configuracoes.gdl_ambiente = 'homologacao'
    const arquivos = await listarImagensRepGdl('190', '2026')
    expect(arquivos).toHaveLength(3)
    expect(arquivos.filter(arquivo => arquivo.provavelImagem)).toHaveLength(2)
    expect(arquivos.find(arquivo => arquivo.nomeArquivo === 'foto-a.png')?.thumbnailDataUri)
      .toMatch(/^data:image\/jpeg;base64,/)
    expect(arquivos.find(arquivo => arquivo.nomeArquivo === 'leia-me.txt')?.status)
      .toBe('Formato não compatível para captura')

    const fotoA = arquivos.find(arquivo => arquivo.nomeArquivo === 'foto-a.png')
    const fotoB = arquivos.find(arquivo => arquivo.nomeArquivo === 'foto-b.png')
    const texto = arquivos.find(arquivo => arquivo.nomeArquivo === 'leia-me.txt')
    if (!fotoA || !fotoB || !texto) throw new Error('Entradas esperadas não foram listadas.')

    await expect(capturarImagensRepGdl('190', '2026', [])).resolves.toEqual({ imagens: [], falhas: [] })
    const captura = await capturarImagensRepGdl('190', '2026', [
      fotoA.idSelecao,
      fotoB.idSelecao,
      texto.idSelecao,
      'inexistente',
      fotoA.idSelecao,
    ])
    expect(captura.imagens).toHaveLength(1)
    expect(captura.imagens[0]).toMatchObject({
      nomeArquivo: 'foto-a.png',
      mimeType: 'image/png',
      tamanho: bytesPng.length,
    })
    expect(captura.falhas.map(falha => falha.erro)).toEqual(expect.arrayContaining([
      'Imagem duplicada nesta captura.',
      'Foto indisponível para captura na Lista de Fotos.',
    ]))
  })

  it('propaga os estados de erro ao baixar a Lista de Fotos', async () => {
    configuracoes.gdl_ambiente = 'homologacao'
    for (const [status, erro] of [
      [404, 'A Lista de Fotos da REP 190/2026 não foi encontrada no GDL.'],
      [401, 'Acesso à Lista de Fotos rejeitado pelo GDL.'],
      [500, 'Erro ao obter a Lista de Fotos do GDL (HTTP 500).'],
    ] as const) {
      statusFotos = status
      await expect(listarImagensRepGdl('190', '2026')).rejects.toThrow(erro)
    }
  })

  it('consulta a REP em produção e complementa envolvidos pela listagem de investigação', async () => {
    configuracoes.gdl_ambiente = 'producao'
    const resultado = await consultarRep('109.026', '2026')

    expect(resultado.sucesso).toBe(true)
    expect(resultado.ambiente).toBe('producao')
    expect(resultado.dados?.dataEntradaSolicitacao).toBe('2024-06-11')
    expect(resultado.dados?.quesitoAberto).toBe('QUESITO & TESTE')
    expect(resultado.dados?.envolvidos).toContainEqual({ nome: 'ENVOLVIDO COMPLEMENTAR' })
    expect(resultado.dados?.envolvidos).not.toContainEqual({ nome: 'ENVOLVIDO DE OUTRA REP' })
    expect(corposInvestigacao).toHaveLength(2)
    expect(requisicoesGdl.filter(requisicao => requisicao.caminho.endsWith('/REP/Default.aspx'))).toHaveLength(1)
  })

  it('registra o redirecionamento para login sem expor credenciais ou conteúdo da REP', async () => {
    redirecionarPaginaParaLogin = true
    const resultado = await consultarRep('190', '2026')
    expect(resultado.sucesso).toBe(true)
    expect(resultado.dados?.dataEntradaSolicitacao).toBe('')
    expect(resultado.dados?.quesitoAberto).toBe('')
    expect(mocks.registrarAviso).toHaveBeenCalledWith('Leitura complementar da REP GDL incompleta.', {
      codRep: resultado.dados?.codRep,
      statusCode: 200,
      redirecionado: true,
      paginaAutenticacao: true,
      campoDataPresente: false,
      campoQuesitoPresente: false,
      dataExtraida: false,
      quesitoExtraido: false,
    })
  })

  it('registra campos presentes mas vazios no HTML, mantendo a consulta pela API', async () => {
    respostaPaginaRep = '<input id="Content_RepMain_txtDateEntry" value=""><textarea id="Content_RepMain_txtOpenQuestion"></textarea>'
    const resultado = await consultarRep('190', '2026')
    expect(resultado.sucesso).toBe(true)
    expect(resultado.dados?.dataEntradaSolicitacao).toBe('')
    expect(resultado.dados?.quesitoAberto).toBe('')
    expect(mocks.registrarAviso).toHaveBeenCalledWith('Leitura complementar da REP GDL incompleta.', {
      codRep: resultado.dados?.codRep,
      statusCode: 200,
      redirecionado: false,
      paginaAutenticacao: false,
      campoDataPresente: true,
      campoQuesitoPresente: true,
      dataExtraida: false,
      quesitoExtraido: false,
    })
    expect(requisicoesGdl.filter(requisicao => requisicao.caminho.endsWith('/REP/Default.aspx'))).toHaveLength(1)
  })

  it('reutiliza o ZIP temporário da sessão até o modal ser fechado', async () => {
    configuracoes.gdl_ambiente = 'homologacao'
    const sessao = await abrirSessaoImagensRepGdl('laudo-teste', '190', '2026')
    const foto = sessao.arquivos.find(arquivo => arquivo.nomeArquivo === 'foto-a.png')
    if (!foto) throw new Error('Foto esperada não foi listada.')

    const captura = await capturarImagensDaSessaoGdlParaLaudo('laudo-teste', sessao.sessaoId, [foto.idSelecao], async imagem => ({
      idSelecao: imagem.idSelecao,
      imagemId: 'imagem-local-1',
      nomeArquivo: imagem.nomeArquivo,
      mimeType: imagem.mimeType,
      tamanho: imagem.bytes.length,
      sha256: imagem.sha256,
      sequencia: 1,
    }))
    expect(captura).toMatchObject({ imagens: [{ imagemId: 'imagem-local-1' }], falhas: [], duplicadas: [] })

    fecharSessaoImagensRepGdl('laudo-teste', sessao.sessaoId)
    await expect(capturarImagensDaSessaoGdlParaLaudo('laudo-teste', sessao.sessaoId, [foto.idSelecao], async () => {
      throw new Error('Não deve tentar salvar após fechar a sessão.')
    })).rejects.toThrow('A sessão temporária da Lista de Fotos expirou. Consulte novamente.')
  })

  it('permite consultar outra REP em produção após a validação inicial', async () => {
    mocks.obterConfiguracao.mockClear()
    await expect(consultarRep('190', '2026')).resolves.toMatchObject({
      sucesso: true,
      ambiente: 'producao',
    })
    await expect(validarCredenciais('producao', { login: 'u', senha: 's' }, '190', '2026')).resolves.toMatchObject({
      sucesso: true,
    })
    await expect(listarImagensRepGdl('190', '2026')).resolves.toEqual(expect.any(Array))
    expect(requisicoesRecebidas).toBeGreaterThan(0)
  })

  it('usa somente endpoints de consulta do GDL', async () => {
    configuracoes.gdl_ambiente = 'producao'
    await expect(consultarRep('190', '2026')).resolves.toMatchObject({ sucesso: true })
    await expect(abrirSessaoImagensRepGdl('laudo-teste', '190', '2026')).resolves.toMatchObject({ arquivos: expect.any(Array) })

    expect(requisicoesGdl).not.toHaveLength(0)
    expect(requisicoesGdl.every(requisicao => requisicao.metodo === 'GET' || (
      requisicao.metodo === 'POST' && (requisicao.caminho.endsWith('/repsInvestigacaoPolicial/listarReps') || requisicao.caminho === '/Account/Login.aspx')
    ))).toBe(true)
    expect(requisicoesGdl.filter(requisicao => requisicao.metodo === 'POST')).toHaveLength(3)
  })

  it('reutiliza o login web com URL de resposta vazia no Electron e mantém um GET de página por consulta', async () => {
    await consultarRep('190', '2026')
    await consultarRep('190', '2026')
    expect(requisicoesGdl.filter(r => r.metodo === 'POST' && r.caminho === '/Account/Login.aspx')).toHaveLength(1)
    expect(requisicoesGdl.filter(r => r.caminho === '/REP/Default.aspx')).toHaveLength(2)
  })

  it('preserva a consulta API e evita repetir login rejeitado imediatamente', async () => {
    rejeitarLogin = true
    for (let i = 0; i < 2; i++) {
      const resultado = await consultarRep('190', '2026')
      expect(resultado.sucesso).toBe(true)
      expect(resultado.dados?.dataEntradaSolicitacao).toBe('')
    }
    expect(requisicoesGdl.filter(r => r.metodo === 'POST' && r.caminho === '/Account/Login.aspx')).toHaveLength(1)
    expect(requisicoesGdl.some(r => r.caminho === '/REP/Default.aspx')).toBe(false)
  })

  it('renova a sessão expirada na próxima consulta, sem repetir o GET da REP na mesma consulta', async () => {
    await consultarRep('190', '2026')
    redirecionarPaginaParaLogin = true
    const expirada = await consultarRep('190', '2026')
    expect(expirada.dados?.dataEntradaSolicitacao).toBe('')
    redirecionarPaginaParaLogin = false
    const renovada = await consultarRep('190', '2026')
    expect(renovada.dados?.dataEntradaSolicitacao).toBe('2024-06-11')
    expect(requisicoesGdl.filter(r => r.metodo === 'POST' && r.caminho === '/Account/Login.aspx')).toHaveLength(2)
    expect(requisicoesGdl.filter(r => r.caminho === '/REP/Default.aspx')).toHaveLength(3)
  })

  it('envia somente o botão de autenticação e rejeita formulário com destino diferente', () => {
    const urlLogin = `${baseUrl}/Account/Login.aspx`
    const corpo = new URLSearchParams(montarFormularioLoginGdl(formularioLogin, urlLogin, 'usuario', 'senha&teste'))
    expect(corpo.get('__VIEWSTATE')).toBe('estado&teste')
    expect(corpo.get('ctl00$Content$txtPass')).toBe('senha&teste')
    expect(corpo.has('ctl00$Content$btn_NewPass')).toBe(false)
    expect(() => montarFormularioLoginGdl(formularioLogin.replace('./Login.aspx', '/REP/Default.aspx'), urlLogin, 'u', 's')).toThrow()
    expect(paginaGdlExigeLogin('<script>document.location="https://gdl/Account/Login.aspx";</script>')).toBe(true)
  })

  it('bloqueia mutações e destinos fora da lista fechada da sessão web', () => {
    expect(destinoPaginaGdlPermitido(baseUrl, `${baseUrl}/Account/Login.aspx`, 'POST')).toBe(true)
    expect(destinoPaginaGdlPermitido(baseUrl, `${baseUrl}/REP/Default.aspx?rep_id=123`, 'GET')).toBe(true)
    for (const [caminho, metodo] of [['/REP/Default.aspx?rep_id=123', 'POST'], ['/REP/Default.aspx', 'GET'], ['/Account/Logout.aspx', 'GET'], ['/REP/CancelarREP.aspx', 'GET'], ['/Account/Login.aspx?acao=outra', 'POST']]) {
      expect(destinoPaginaGdlPermitido(baseUrl, baseUrl + caminho, metodo)).toBe(false)
    }
    expect(destinoPaginaGdlPermitido(baseUrl, 'https://outro.example/Account/Login.aspx', 'POST')).toBe(false)
  })

  it('valida arquivos ZIP e deriva filtros únicos para a investigação', () => {
    expect(extrairCodigoNaturezaExame('B612 - EXAME DE CONFRONTO BALÍSTICO')).toBe('B-612')
    expect(extrairCodigoNaturezaExame('Natureza não identificada')).toBeNull()
    expect(() => listarFotosDoArquivoZip(Buffer.from('invalido'), 1)).toThrow(
      'O GDL não retornou um arquivo ZIP válido para a Lista de Fotos.',
    )
    expect(listarFotosDoArquivoZip(bytesZip, 1902026)).toHaveLength(3)

    const rep = interpretarGdlRepJson(fixtureRep)
    expect(extrairFiltrosParaConsultaInvestigacao(rep)).toEqual([
      { numeroOrigem: '123', anoOrigem: 2026 },
      { numeroOrigem: '456', anoOrigem: 2026 },
    ])
    expect(extrairFiltrosParaConsultaInvestigacao({ ...rep, origens: [], numeroCaso: 42 }))
      .toEqual([{ numeroCaso: 42, numeroOrigem: '' }])
    expect(extrairFiltrosParaConsultaInvestigacao({ ...rep, origens: [], numeroCaso: 0 })).toEqual([])
  })
})
