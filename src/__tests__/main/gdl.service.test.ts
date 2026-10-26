import { classificarFalhaListaRepsGdl } from '../../main/services/gdl-minhas-reps-erro.service';
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import AdmZip from 'adm-zip'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  obterConfiguracao: vi.fn(),
  configurarVerificacaoCertificado: vi.fn(),
  registrarAviso: vi.fn(),
  criarImagem: vi.fn(),
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
      createFromBuffer: (bytes: Buffer) => { mocks.criarImagem(bytes); return imagem },
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
import { VERSAO_OTIMIZACAO_FOTO_GDL } from '../../main/services/imagem-laudo.service'
import { destinoPaginaGdlPermitido, lerDetalhesRepAutorizadaGdl, listarPaginaMinhasRepsGdl, montarFormularioLoginGdl, paginaGdlExigeLogin } from '../../main/services/gdl-pagina.service'

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
let bytesZipAtuais = bytesZip

let servidor: http.Server
let baseUrl = ''
let statusUnidades = 200
let statusRep = 200
let statusInvestigacao = 200
let rejeitarLogin = false
let sequenciaTeste = 0
let redirecionarPaginaParaLogin = false
const statusRepPorBusca = new Map<string, number>()
let statusFotos = 200
let respostaRep = fixtureRep
let respostaPaginaRep = '<input id="Content_RepMain_txtDateEntry" value="11/06/2024"><textarea id="Content_RepMain_txtOpenQuestion">QUESITO &amp; TESTE</textarea>'
let respostaInvestigacao: string | null = null
let respostaMinhasReps = ''
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
      if (statusRep === 302) resposta.setHeader('Location', '/REP/Default.aspx?rep_id=123')
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
    if (url.pathname.endsWith('/REP/MinhasReps.aspx')) {
      responder(resposta, 200, respostaMinhasReps)
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
        responder(resposta, statusInvestigacao, respostaInvestigacao ?? JSON.stringify({
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
      responder(resposta, statusFotos, statusFotos === 200 ? bytesZipAtuais : Buffer.alloc(0))
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
  statusInvestigacao = 200
  rejeitarLogin = false
  sequenciaTeste += 1
  redirecionarPaginaParaLogin = false
  mocks.registrarAviso.mockClear()
  statusRepPorBusca.clear()
  statusFotos = 200
  bytesZipAtuais = bytesZip
  mocks.criarImagem.mockClear()
  respostaRep = fixtureRep
  respostaPaginaRep = '<input id="Content_RepMain_txtDateEntry" value="11/06/2024"><textarea id="Content_RepMain_txtOpenQuestion">QUESITO &amp; TESTE</textarea>'
  respostaInvestigacao = null
  respostaMinhasReps = ''
  corposInvestigacao.length = 0
  requisicoesGdl.length = 0
  requisicoesRecebidas = 0
  Object.assign(configuracoes, {
    gdl_ambiente: 'producao',
    gdl_homologacao_habilitada: 'true',
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
    expect(limparValidacaoSessao('ambiente-invalido')).toEqual({ ambiente: 'Produção', validado: false })
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
    expect(resultado.dados?.quesitoAberto).toBe('')
    expect(requisicoesGdl.some(item => item.caminho.endsWith('/REP/Default.aspx'))).toBe(false)
    expect(resultado.dados?.envolvidos).not.toContainEqual({ nome: 'ENVOLVIDO DE OUTRA REP' })
    expect(resultado.naturezaExame).toBe('B602 - EXAME BALÍSTICO')
    expect(corposInvestigacao).toHaveLength(2)
    expect(obterValidacaoSessao('homologacao')).toMatchObject({
      validado: true,
      numeroRep: '190',
      anoRep: '2026',
    })
  })

  it('obtém a natureza pela API sem acessar os detalhes', async () => {
    respostaPaginaRep = '<select id="Content_RepMain_ddlNatureExam"><option selected="selected">B601 - OUTRO EXAME</option></select>'

    const resultado = await consultarRep('190', '2026')

    expect(resultado.naturezaExame).toBe('B602 - EXAME BALÍSTICO')
    expect(resultado.erroNaturezaExame).toBeUndefined()
  })

  it('permite identificação local quando a consulta auxiliar falha, sem acessar detalhes', async () => {
    statusInvestigacao = 503
    const resultado = await consultarRep('190', '2026')
    expect(resultado.sucesso).toBe(true)
    expect(resultado.naturezaExame).toBeUndefined()
    expect(resultado.erroNaturezaExame).toContain('uma ou mais consultas falharam')
    expect(requisicoesGdl.some(item => item.caminho.endsWith('/REP/Default.aspx'))).toBe(false)
  })

  it('não presume uma natureza quando a API não encontra a REP', async () => {
    respostaInvestigacao = JSON.stringify({ dadosREPs: [] })
    const resultado = await consultarRep('190', '2026')
    expect(resultado.naturezaExame).toBeUndefined()
    expect(resultado.erroNaturezaExame).toContain('REP não encontrada no resultado')
    expect(requisicoesGdl.some(item => item.caminho.endsWith('/REP/Default.aspx'))).toBe(false)
  })

  it('usa Produção quando Homologação está desabilitada ou falta configuração', async () => {
    configuracoes.gdl_ambiente = 'homologacao'
    configuracoes.gdl_homologacao_habilitada = 'false'
    await expect(consultarRep('190', '2026')).resolves.toMatchObject({ sucesso: true, ambiente: 'producao' })
    await expect(testarConexao('homologacao')).resolves.toMatchObject({ sucesso: true, ambiente: 'Produção' })

    limparValidacaoSessao('homologacao')
    limparValidacaoSessao('producao')
    const requisicoesAntesDaValidacao = requisicoesRecebidas
    await expect(validarCredenciais('homologacao', { login: 'usuario', senha: 'senha' }, '190', '2026'))
      .resolves.toMatchObject({ sucesso: false, erro: 'Habilite o ambiente de Homologação antes de validar essas credenciais.' })
    expect(requisicoesRecebidas).toBe(requisicoesAntesDaValidacao)
    expect(obterValidacaoSessao('homologacao').validado).toBe(false)

    delete configuracoes.gdl_ambiente
    delete configuracoes.gdl_homologacao_habilitada
    await expect(consultarRep('190', '2026')).resolves.toMatchObject({ sucesso: true, ambiente: 'producao' })
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
    expect(resultado.dados?.dataEntradaSolicitacao).toBe('')
    expect(resultado.dados?.quesitoAberto).toBe('')
    expect(requisicoesGdl.some(item => item.caminho.endsWith('/REP/Default.aspx'))).toBe(false)
    expect(resultado.dados?.envolvidos).toContainEqual({ nome: 'ENVOLVIDO COMPLEMENTAR' })
    expect(resultado.dados?.envolvidos).not.toContainEqual({ nome: 'ENVOLVIDO DE OUTRA REP' })
    expect(corposInvestigacao).toHaveLength(2)
    expect(requisicoesGdl.filter(requisicao => requisicao.caminho.endsWith('/REP/Default.aspx'))).toHaveLength(0)
  })

  it('preserva quesito e data quando fornecidos pela API, sem autenticar na interface web', async () => {
    respostaRep = JSON.stringify({ ...interpretarGdlRepJson(fixtureRep), quesitoAberto: 'QUESITO DA API', dataEntradaSolicitacao: '2026-10-01' })
    const resultado = await consultarRep('190', '2026')
    expect(resultado.dados).toMatchObject({ quesitoAberto: 'QUESITO DA API', dataEntradaSolicitacao: '2026-10-01' })
    expect(requisicoesGdl.some(item => /\/Account\/|\/REP\/Default\.aspx/.test(item.caminho))).toBe(false)
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

  it('oculta fotos do laudo e reutiliza os hashes do cache sem processar as imagens novamente', async () => {
    const zipUnico = new AdmZip()
    zipUnico.addFile('fotos/foto-a.png', bytesPng)
    zipUnico.addFile('fotos/foto-b.png', bytesPng)
    zipUnico.addFile(`marca-${randomUUID()}.txt`, Buffer.from('cache isolado'))
    bytesZipAtuais = zipUnico.toBuffer()
    const hashPersistido = createHash('sha256').update(Buffer.from('thumbnail')).digest('hex')

    const semImagens = await abrirSessaoImagensRepGdl('laudo-teste', '190', '2026', undefined, new Set())
    expect(semImagens.fotosJaIncluidas).toBe(0)
    expect(mocks.criarImagem).not.toHaveBeenCalled()
    fecharSessaoImagensRepGdl('laudo-teste', semImagens.sessaoId)

    const primeira = await abrirSessaoImagensRepGdl('laudo-teste', '190', '2026', undefined, new Set([hashPersistido]))
    expect(primeira.fotosJaIncluidas).toBe(2)
    expect(primeira.arquivos.some(arquivo => arquivo.provavelImagem)).toBe(false)
    expect(mocks.criarImagem).toHaveBeenCalledTimes(2)
    fecharSessaoImagensRepGdl('laudo-teste', primeira.sessaoId)

    mocks.criarImagem.mockClear()
    const segunda = await abrirSessaoImagensRepGdl('laudo-teste', '190', '2026', undefined, new Set([hashPersistido]))
    expect(segunda.fotosJaIncluidas).toBe(2)
    expect(mocks.criarImagem).not.toHaveBeenCalled()
    fecharSessaoImagensRepGdl('laudo-teste', segunda.sessaoId)

    const aposExclusao = await abrirSessaoImagensRepGdl('laudo-teste', '190', '2026', undefined, new Set())
    expect(aposExclusao.arquivos.filter(arquivo => arquivo.provavelImagem)).toHaveLength(2)
    expect(mocks.criarImagem).not.toHaveBeenCalled()
    fecharSessaoImagensRepGdl('laudo-teste', aposExclusao.sessaoId)

    const hashZip = createHash('sha256').update(bytesZipAtuais).digest('hex')
    const chaveCache = createHash('sha256').update(JSON.stringify(['producao', '190', '2026', hashZip, VERSAO_OTIMIZACAO_FOTO_GDL])).digest('hex')
    const caminhoCache = path.join(os.tmpdir(), 'lawdo-gdl-service-test', 'gdl', 'cache-fotos', `${chaveCache}.json`)
    fs.writeFileSync(caminhoCache, '{invalido')
    const cacheInvalido = await abrirSessaoImagensRepGdl('laudo-teste', '190', '2026', undefined, new Set([hashPersistido]))
    expect(cacheInvalido.fotosJaIncluidas).toBe(2)
    expect(mocks.criarImagem).toHaveBeenCalledTimes(2)
    fecharSessaoImagensRepGdl('laudo-teste', cacheInvalido.sessaoId)

    const zipAlterado = new AdmZip()
    zipAlterado.addFile('fotos/foto-a.png', bytesPng)
    zipAlterado.addFile('fotos/foto-b.png', bytesPng)
    zipAlterado.addFile(`nova-marca-${randomUUID()}.txt`, Buffer.from('ZIP alterado'))
    bytesZipAtuais = zipAlterado.toBuffer()
    mocks.criarImagem.mockClear()
    const terceira = await abrirSessaoImagensRepGdl('laudo-teste', '190', '2026', undefined, new Set([hashPersistido]))
    expect(terceira.fotosJaIncluidas).toBe(2)
    expect(mocks.criarImagem).toHaveBeenCalledTimes(2)
    fecharSessaoImagensRepGdl('laudo-teste', terceira.sessaoId)
  })

  it('mantém fotos visíveis quando a verificação local falha', async () => {
    const zipUnico = new AdmZip()
    zipUnico.addFile('fotos/foto-a.png', bytesPng)
    zipUnico.addFile(`marca-${randomUUID()}.txt`, Buffer.from('falha isolada'))
    bytesZipAtuais = zipUnico.toBuffer()
    mocks.criarImagem.mockImplementationOnce(() => { throw new Error('Falha ao processar foto.') })
    const hashPersistido = createHash('sha256').update(Buffer.from('thumbnail')).digest('hex')

    const sessao = await abrirSessaoImagensRepGdl('laudo-teste', '190', '2026', undefined, new Set([hashPersistido]))
    expect(sessao.arquivos.some(arquivo => arquivo.nomeArquivo === 'foto-a.png')).toBe(true)
    expect(sessao.fotosJaIncluidas).toBe(0)
    expect(sessao.avisoVerificacao).toContain('não puderam ser verificadas')
    fecharSessaoImagensRepGdl('laudo-teste', sessao.sessaoId)
    mocks.criarImagem.mockReset()
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
    expect(requisicoesGdl.filter(requisicao => requisicao.metodo === 'POST')).toHaveLength(2)
  })

  it('consultas individuais repetidas nunca autenticam nem abrem detalhes na interface web', async () => {
    rejeitarLogin = true
    redirecionarPaginaParaLogin = true
    await consultarRep('190', '2026')
    await consultarRep('190', '2026')
    expect(requisicoesGdl.some(item => /\/Account\/|\/REP\/Default\.aspx/.test(item.caminho))).toBe(false)
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
    expect(destinoPaginaGdlPermitido(baseUrl, `${baseUrl}/REP/Default.aspx?rep_id=123`, 'GET')).toBe(false)
    expect(destinoPaginaGdlPermitido(baseUrl, `${baseUrl}/REP/MinhasReps.aspx`, 'GET')).toBe(true)
    expect(destinoPaginaGdlPermitido(baseUrl, `${baseUrl}/REP/MinhasReps.aspx`, 'POST')).toBe(true)
    for (const [caminho, metodo] of [['/REP/Default.aspx?rep_id=123', 'POST'], ['/REP/Default.aspx', 'GET'], ['/REP/MinhasReps.aspx?acao=concluir', 'POST'], ['/Account/Logout.aspx', 'GET'], ['/REP/CancelarREP.aspx', 'GET'], ['/REP/Concluir_REP.aspx?cod_rep=123', 'GET'], ['/Account/Login.aspx?acao=outra', 'POST']]) {
      expect(destinoPaginaGdlPermitido(baseUrl, baseUrl + caminho, metodo)).toBe(false)
    }
    expect(destinoPaginaGdlPermitido(baseUrl, 'https://outro.example/Account/Login.aspx', 'POST')).toBe(false)
  })

  it('lista a grade sem consultar detalhes', async () => {
    respostaMinhasReps = `<form method="post" action="./MinhasReps.aspx">
      <input name="__VIEWSTATE" value="estado"><input name="__EVENTVALIDATION" value="validacao">
      <select id="Content_ddlYear"><option value="0">Todos</option></select>
      <select id="Content_ddlStatus"><option value="-1">Todos</option></select>
      <select id="Content_ddlUnit"><option value="-1">Todos</option></select>
      <table id="Content_gridSearchMyRequests">
        <tr><th>Número/Ano da REP</th><th>Data/Hora da Designação</th><th>Status</th><th>Natureza do Exame</th><th>Quant. Fotos</th></tr>
        <tr><td><a href="/REP/Default.aspx?rep_id=123">123/2026</a></td><td>19/07/2026 14:30</td><td><img alt="Laudo em Execução"></td><td>EXAME DE CONSTATAÇÃO</td><td>0</td></tr>
      </table></form>`
    respostaPaginaRep = '<select id="Content_RepMain_ddlNatureExam"><option selected="selected">B601 - EXAME DE CONSTATAÇÃO</option></select>'
    const credenciais = { baseUrl, login: 'usuario-minhas-reps', senha: 'senha' }
    const inicioRequisicoes = requisicoesGdl.length
    const pagina = await listarPaginaMinhasRepsGdl(credenciais, 1, () => undefined)
    expect(pagina.reps).toHaveLength(1)
    expect(pagina.reps[0].naturezaExameComCodigo).toBeNull()
    expect(requisicoesGdl.slice(inicioRequisicoes).some(item => item.caminho.endsWith('/REP/Default.aspx'))).toBe(false)
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


describe('proteção e observação do transporte JSON GDL', () => {
  it('bloqueia redirecionamento antes de acessar os detalhes', async () => {
    statusRep = 302;
    const inicio = requisicoesGdl.length;
    await expect(consultarRep('190', '2026')).resolves.toMatchObject({ sucesso: false });
    expect(requisicoesGdl.slice(inicio)).toEqual([{ metodo: 'GET', caminho: '/api/rep/obter', busca: '?numero=190&ano=2026' }]);
  });
  it('observa a consulta e as subconsultas sem acrescentar requisições', async () => {
    const { configurarObservadorGdl, observarConsultaGdl } = await import('../../main/services/gdl-diagnostico.service');
    const registrar = vi.fn().mockResolvedValue(undefined);
    configurarObservadorGdl({ obterCaptura: id => ({ capturaId: 'captura-simulada', janelaId: id }), registrar });
    try {
      const inicio = requisicoesGdl.length;
      await consultarRep('190', '2026');
      const esperadas = requisicoesGdl.slice(inicio);
      const inicioCaptura = requisicoesGdl.length;
      await observarConsultaGdl(1, '190', '2026', () => consultarRep('190', '2026'));
      expect(requisicoesGdl.slice(inicioCaptura)).toEqual(esperadas);
      expect(registrar.mock.calls.some(([, dados]) => dados.etapa === 'resposta_original')).toBe(true);
      expect(registrar.mock.calls.some(([, dados]) => dados.etapa === 'resposta_normalizada')).toBe(true);
      expect(new Set(registrar.mock.calls.map(([contexto]) => contexto.correlacaoId)).size).toBe(1);
    } finally { configurarObservadorGdl(null); }
  });
});


describe('transporte restrito de detalhes individuais', () => {
  const credenciais = () => ({ baseUrl: `${baseUrl}/api`, login: 'detalhes-usuario', senha: `detalhes-${sequenciaTeste}` });
  it('usa somente GET no detalhe autorizado, sem submeter o formulário da REP', async () => {
    respostaPaginaRep = '<form action="./Default.aspx?rep_id=123"><div id="TitleContainer">REP 190/2026</div><select id="Content_RepMain_ddlNatureExam"><option value="998" selected>B602 - EXAME DE EFICIÊNCIA E PRESTABILIDADE</option></select><input id="Content_RepMain_txtDateEntry" value="21/08/2026"><textarea id="Content_RepMain_txtOpenQuestion">Quesito de teste</textarea></form>';
    const inicio = requisicoesGdl.length;
    const validar = vi.fn().mockResolvedValue(undefined);
    await expect(lerDetalhesRepAutorizadaGdl(credenciais(), 123, '190', '2026', () => undefined, validar, new AbortController().signal)).resolves.toMatchObject({ dataSolicitacao: { valor: '2026-08-21' } });
    const detalhes = requisicoesGdl.slice(inicio).filter(item => item.caminho === '/REP/Default.aspx');
    expect(detalhes).toEqual([{ metodo: 'GET', caminho: '/REP/Default.aspx', busca: '?rep_id=123' }]);
    expect(validar).toHaveBeenCalledTimes(3);
  });
  it('não inicia rede sem contexto válido e não segue redirecionamento da página de detalhes', async () => {
    const inicio = requisicoesGdl.length;
    await expect(lerDetalhesRepAutorizadaGdl(credenciais(), 123, '190', '2026', () => undefined, async () => { throw new Error('Contexto expirado'); }, new AbortController().signal)).rejects.toThrow('expirado');
    expect(requisicoesGdl).toHaveLength(inicio);
    redirecionarPaginaParaLogin = true;
    await expect(lerDetalhesRepAutorizadaGdl(credenciais(), 123, '190', '2026', () => undefined, async () => undefined, new AbortController().signal)).rejects.toThrow('não foi concluída');
    expect(requisicoesGdl.slice(inicio).filter(item => item.caminho === '/REP/Default.aspx')).toHaveLength(1);
    const detalhe = requisicoesGdl.map(item => item.caminho).lastIndexOf('/REP/Default.aspx');
    expect(requisicoesGdl.slice(detalhe + 1)).toEqual([]);
  });
});

it('não confirma outra REP do mesmo caso e pagina a busca por identidade exata', async () => {
  respostaInvestigacao = JSON.stringify({ quantRegistros: 20, dadosREPs: Array.from({ length: 10 }, (_, indice) => ({ numeroRep: `${900 + indice}/2026`, numeroCaso: 99, naturezaExame: 'I806 - EXAME DE CONSTATAÇÃO', statusRep: 'LAUDO EM EXECUÇÃO' })) });
  const resultado = await consultarRep('190', '2026');
  expect(resultado.statusRep).toBeUndefined();
  expect(resultado.naturezaExame).toBeUndefined();
  expect(corposInvestigacao.some(corpo => JSON.parse(corpo).numPagina === 2)).toBe(true);
});

describe('causa original na autenticação web', () => {
  it.each([
    ['ECONNREFUSED', 'rede'], ['ENOTFOUND', 'rede'], ['ETIMEDOUT', 'tempo_esgotado'],
  ])('preserva %s e o bloqueio posterior sem outra chamada de rede', async (code, codigo) => {
    const original = Object.assign(new Error('Falha no transporte'), { code });
    const requisicao = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed', { cause: original }));
    const credenciais = { baseUrl, login: `falha-${code}`, senha: `teste-${sequenciaTeste}` };
    try {
      let capturado: unknown;
      try { await listarPaginaMinhasRepsGdl(credenciais, 1, () => undefined); } catch (erro) { capturado = erro; }
      expect(classificarFalhaListaRepsGdl(capturado)).toMatchObject({ codigo, codigoSistema: code, etapa: 'carregar_formulario' });
      const chamadas = requisicao.mock.calls.length;
      try { await listarPaginaMinhasRepsGdl(credenciais, 1, () => undefined); } catch (erro) { capturado = erro; }
      expect(classificarFalhaListaRepsGdl(capturado)).toMatchObject({ codigo, codigoSistema: code, bloqueioTemporario: true, tentarNovamenteEmSegundos: expect.any(Number) });
      expect(requisicao.mock.calls).toHaveLength(chamadas);
    } finally { requisicao.mockRestore(); }
  });

  it.each([[401, 'autenticacao'], [503, 'servidor'], [504, 'tempo_esgotado']])('classifica HTTP %i recebido ao abrir o formulário', async (status, codigo) => {
    const requisicao = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('indisponível', { status }));
    try {
      let capturado: unknown;
      try { await listarPaginaMinhasRepsGdl({ baseUrl, login: `http-${status}`, senha: `teste-${sequenciaTeste}` }, 1, () => undefined); } catch (erro) { capturado = erro; }
      expect(classificarFalhaListaRepsGdl(capturado)).toMatchObject({ codigo, statusHttp: status, etapa: 'carregar_formulario' });
    } finally { requisicao.mockRestore(); }
  });
});
