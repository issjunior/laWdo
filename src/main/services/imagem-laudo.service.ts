import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { app, nativeImage } from 'electron'
import { executeNonQuery, executeQuery, withTransaction } from '../database/sqlite.js'
import { getLogger } from '../utils/logger.js'
import type {
  AtualizarOrdemImagemLaudoEntrada,
  ImagemLaudoPersistida,
  ImagemLaudoDuplicada,
  ImagemLaudoResumo,
  MiniaturaImagemLaudo,
  ResultadoReconciliacaoImagensLaudo,
  SalvarImagemLaudoEntrada,
  SalvarImagemLaudoBytesEntrada,
} from '../../shared/types/imagem-laudo.types.js'

const log = getLogger('database')
const DIRETORIO_IMAGENS = path.join(app.getPath('userData'), 'imagens', 'laudos')

interface ImagemLaudoRow {
  id: string
  laudo_id: string
  nome_arquivo: string
  caminho_relativo: string
  mime_type: string
  tamanho: number
  sha256: string
  legenda: string
  origem: 'local' | 'gdl'
  sequencia: number
  imagem_origem_id: string | null
  ajustes_json: string | null
  disponivel_painel: number
  created_at: string
}

const EXTENSAO_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/webp': 'webp',
}
const LADO_MAXIMO_FOTO_LAUDO = 1600
const QUALIDADE_JPEG_FOTO_LAUDO = 82

function validarIdentificador(valor: string, campo: string): string {
  const normalizado = valor.trim()
  if (!normalizado || !/^[a-zA-Z0-9_-]+$/.test(normalizado)) throw new Error(`${campo} inválido.`)
  return normalizado
}

function interpretarDataUri(dataUri: string): { mimeType: string; bytes: Buffer } {
  const correspondencia = dataUri.match(/^data:(image\/(?:jpeg|png|gif|bmp|webp));base64,([A-Za-z0-9+/=\s]+)$/i)
  if (!correspondencia) throw new Error('Formato de imagem não compatível para armazenamento.')
  const mimeType = correspondencia[1].toLowerCase()
  const bytes = Buffer.from(correspondencia[2].replace(/\s/g, ''), 'base64')
  if (bytes.length === 0) throw new Error('A imagem está vazia.')
  return { mimeType, bytes }
}

function caminhoAbsoluto(caminhoRelativo: string): string {
  const absoluto = path.resolve(app.getPath('userData'), caminhoRelativo)
  const raiz = path.resolve(DIRETORIO_IMAGENS)
  if (!absoluto.startsWith(`${raiz}${path.sep}`)) throw new Error('Caminho de imagem inválido.')
  return absoluto
}

function nomeSeguro(nomeArquivo: string): string {
  return path.basename(nomeArquivo).replace(/[^a-zA-Z0-9._-]/g, '_') || 'imagem'
}

function otimizarFotoGdl(bytesOriginais: Buffer): { mimeType: 'image/jpeg'; bytes: Buffer } {
  const imagem = nativeImage.createFromBuffer(bytesOriginais)
  if (imagem.isEmpty()) throw new Error('A foto do GDL não pôde ser processada.')
  const dimensoes = imagem.getSize()
  if (!dimensoes.width || !dimensoes.height) throw new Error('A foto do GDL possui dimensões inválidas.')
  const maiorLado = Math.max(dimensoes.width, dimensoes.height)
  const imagemAjustada = maiorLado > LADO_MAXIMO_FOTO_LAUDO
    ? imagem.resize({
      width: Math.max(1, Math.round(dimensoes.width * (LADO_MAXIMO_FOTO_LAUDO / maiorLado))),
      height: Math.max(1, Math.round(dimensoes.height * (LADO_MAXIMO_FOTO_LAUDO / maiorLado))),
      quality: 'best',
    })
    : imagem
  const bytesOtimizados = imagemAjustada.toJPEG(QUALIDADE_JPEG_FOTO_LAUDO)
  if (bytesOtimizados.length === 0) throw new Error('A foto do GDL não pôde ser otimizada.')
  return { mimeType: 'image/jpeg', bytes: bytesOtimizados }
}

function criarResumoImagem(registro: ImagemLaudoRow): ImagemLaudoResumo {
  return {
    id: registro.id,
    laudoId: registro.laudo_id,
    nomeArquivo: registro.nome_arquivo,
    mimeType: registro.mime_type,
    tamanho: registro.tamanho,
    sha256: registro.sha256,
    legenda: registro.legenda,
    origem: registro.origem,
    sequencia: registro.sequencia,
    imagemOrigemId: registro.imagem_origem_id,
    createdAt: registro.created_at,
  }
}

export async function listarResumosImagensLaudo(laudoIdEntrada: string): Promise<ImagemLaudoResumo[]> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const registros = await executeQuery<ImagemLaudoRow>(
    'SELECT * FROM imagens_laudo WHERE laudo_id = ? AND disponivel_painel = 1 ORDER BY sequencia, created_at',
    [laudoId],
  )
  return registros.map(criarResumoImagem)
}

function extrairIdsDeImagemDoConteudo(conteudo: string): Set<string> {
  const ids = new Set<string>()
  const padrao = /\bdata-image-id\s*=\s*(?:"([^"]+)"|'([^']+)')/gi
  for (const correspondencia of conteudo.matchAll(padrao)) {
    const id = (correspondencia[1] || correspondencia[2] || '').trim()
    if (/^[a-zA-Z0-9_-]+$/.test(id)) ids.add(id)
  }
  return ids
}

export async function reconciliarImagensLaudo(
  laudoIdEntrada: string,
  conteudoLaudo: string,
): Promise<ResultadoReconciliacaoImagensLaudo> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  if (typeof conteudoLaudo !== 'string') throw new Error('Conteúdo do laudo inválido.')
  const idsInseridos = extrairIdsDeImagemDoConteudo(conteudoLaudo)
  const registros = await executeQuery<ImagemLaudoRow>(
    'SELECT * FROM imagens_laudo WHERE laudo_id = ? ORDER BY sequencia, created_at',
    [laudoId],
  )
  const idsOriginais = new Set(registros.map(registro => registro.imagem_origem_id).filter((id): id is string => Boolean(id)))
  const idsConhecidos = new Set(registros.map(registro => registro.id))
  let recuperadasParaPainel = 0
  let arquivadasComoInseridas = 0
  let arquivosAusentes = 0
  await withTransaction(async () => {
    for (const registro of registros) {
      const deveFicarNoPainel = !idsInseridos.has(registro.id) && !idsOriginais.has(registro.id)
      const disponivelEsperado = deveFicarNoPainel ? 1 : 0
      if (registro.disponivel_painel !== disponivelEsperado) {
        await executeNonQuery('UPDATE imagens_laudo SET disponivel_painel = ? WHERE id = ? AND laudo_id = ?', [disponivelEsperado, registro.id, laudoId])
        if (deveFicarNoPainel) recuperadasParaPainel += 1
        else arquivadasComoInseridas += 1
      }
      if (!fs.existsSync(caminhoAbsoluto(registro.caminho_relativo))) arquivosAusentes += 1
    }
  })
  const referenciasSemImagem = [...idsInseridos].filter(id => !idsConhecidos.has(id)).length
  if (recuperadasParaPainel || arquivadasComoInseridas || referenciasSemImagem || arquivosAusentes) {
    log.warn('Reconciliação de imagens do laudo encontrou divergências', {
      laudoId,
      recuperadasParaPainel,
      arquivadasComoInseridas,
      referenciasSemImagem,
      arquivosAusentes,
    })
  }
  return { recuperadasParaPainel, arquivadasComoInseridas, referenciasSemImagem, arquivosAusentes }
}

async function listarImagensLaudo(laudoIdEntrada: string): Promise<ImagemLaudoPersistida[]> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const registros = await executeQuery<ImagemLaudoRow>(
    'SELECT * FROM imagens_laudo WHERE laudo_id = ? AND disponivel_painel = 1 ORDER BY sequencia, created_at',
    [laudoId],
  )
  const imagens: ImagemLaudoPersistida[] = []
  for (const registro of registros) {
    try {
      const bytes = fs.readFileSync(caminhoAbsoluto(registro.caminho_relativo))
      imagens.push({
        ...criarResumoImagem(registro),
        tamanho: bytes.length,
        dataUri: `data:${registro.mime_type};base64,${bytes.toString('base64')}`,
      })
    } catch (error) {
      log.warn('Imagem do laudo ausente ou ilegível', { laudoId, imagemId: registro.id, error })
    }
  }
  return imagens
}

export async function obterMiniaturasImagensLaudo(
  laudoIdEntrada: string,
  idsEntrada: string[],
  opcoes: { larguraMaxima?: number; qualidadeJpeg?: number } = {},
): Promise<MiniaturaImagemLaudo[]> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const ids = [...new Set(idsEntrada.map(id => validarIdentificador(id, 'Imagem')))]
  if (ids.length > 30) throw new Error('Solicite no máximo 30 miniaturas por vez.')
  if (ids.length === 0) return []
  const larguraMaxima = Math.min(2_048, Math.max(1, Math.trunc(opcoes.larguraMaxima ?? 300)))
  const qualidadeJpeg = Math.min(100, Math.max(1, Math.trunc(opcoes.qualidadeJpeg ?? 75)))
  const marcadores = ids.map(() => '?').join(', ')
  const registros = await executeQuery<ImagemLaudoRow>(
    `SELECT * FROM imagens_laudo WHERE laudo_id = ? AND id IN (${marcadores})`,
    [laudoId, ...ids],
  )
  const miniaturas: MiniaturaImagemLaudo[] = []
  for (const registro of registros) {
    try {
      const imagem = nativeImage.createFromPath(caminhoAbsoluto(registro.caminho_relativo))
      if (imagem.isEmpty()) throw new Error('Arquivo de imagem inválido.')
      const dimensoes = imagem.getSize()
      const largura = Math.min(larguraMaxima, Math.max(1, dimensoes.width))
      const altura = Math.max(1, Math.round(dimensoes.height * (largura / Math.max(1, dimensoes.width))))
      const bytes = imagem.resize({ width: largura, height: altura, quality: 'good' }).toJPEG(qualidadeJpeg)
      miniaturas.push({ id: registro.id, thumbnailDataUri: `data:image/jpeg;base64,${bytes.toString('base64')}` })
    } catch (error) {
      log.warn('Miniatura da imagem do laudo ausente ou ilegível', { laudoId, imagemId: registro.id, error })
    }
  }
  return miniaturas
}

export async function obterImagemLaudoPorId(laudoIdEntrada: string, imagemIdEntrada: string): Promise<ImagemLaudoPersistida> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const imagemId = validarIdentificador(imagemIdEntrada, 'Imagem')
  const registro = (await executeQuery<ImagemLaudoRow>(
    'SELECT * FROM imagens_laudo WHERE id = ? AND laudo_id = ?',
    [imagemId, laudoId],
  ))[0]
  if (!registro) {
    const imagemEmOutroLaudo = (await executeQuery<Pick<ImagemLaudoRow, 'id'>>(
      'SELECT id FROM imagens_laudo WHERE id = ?',
      [imagemId],
    ))[0]
    throw new Error(imagemEmOutroLaudo ? 'IMAGEM_DE_OUTRO_LAUDO' : 'IMAGEM_NAO_VINCULADA')
  }
  try {
    const bytes = fs.readFileSync(caminhoAbsoluto(registro.caminho_relativo))
    return {
      ...criarResumoImagem(registro),
      tamanho: bytes.length,
      dataUri: `data:${registro.mime_type};base64,${bytes.toString('base64')}`,
    }
  } catch (error) {
    log.warn('Imagem selecionada para IA ausente ou ilegível', { laudoId, imagemId, error })
    throw new Error('A imagem selecionada não está disponível para descrição.')
  }
}

export async function salvarImagemLaudo(
  laudoIdEntrada: string,
  entrada: SalvarImagemLaudoEntrada,
): Promise<ImagemLaudoPersistida> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const id = validarIdentificador(entrada.id, 'Imagem')
  const { mimeType, bytes } = interpretarDataUri(entrada.dataUri)
  if (entrada.imagemOrigemId) {
    const imagemOrigemId = validarIdentificador(entrada.imagemOrigemId, 'Imagem de origem')
    if (imagemOrigemId === id) throw new Error('Uma imagem editada não pode ser sua própria origem.')
    const origem = await executeQuery<{ id: string }>('SELECT id FROM imagens_laudo WHERE id = ? AND laudo_id = ?', [imagemOrigemId, laudoId])
    if (origem.length === 0) throw new Error('Imagem de origem não encontrada neste laudo.')
  }
  if (entrada.ajustesJson) {
    let ajustes: unknown
    try { ajustes = JSON.parse(entrada.ajustesJson) } catch { throw new Error('Ajustes da figura inválidos.') }
    if (!ajustes || typeof ajustes !== 'object' || Array.isArray(ajustes)) throw new Error('Ajustes da figura inválidos.')
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const extensao = EXTENSAO_POR_MIME[mimeType]
  const diretorioLaudo = path.join(DIRETORIO_IMAGENS, laudoId)
  const caminho = path.join(diretorioLaudo, `${sha256}.${extensao}`)
  const caminhoRelativo = path.relative(app.getPath('userData'), caminho).replace(/\\/g, '/')
  const anterior = (await executeQuery<ImagemLaudoRow>('SELECT * FROM imagens_laudo WHERE id = ?', [id]))[0]

  fs.mkdirSync(diretorioLaudo, { recursive: true })
  if (!fs.existsSync(caminho)) {
    const temporario = `${caminho}.${process.pid}.${Date.now()}.tmp`
    fs.writeFileSync(temporario, bytes)
    fs.renameSync(temporario, caminho)
  }

  await executeNonQuery(
    `INSERT INTO imagens_laudo
      (id, laudo_id, nome_arquivo, caminho_relativo, mime_type, tamanho, sha256, legenda, origem, sequencia, imagem_origem_id, ajustes_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       nome_arquivo = excluded.nome_arquivo,
       caminho_relativo = excluded.caminho_relativo,
       mime_type = excluded.mime_type,
       tamanho = excluded.tamanho,
       sha256 = excluded.sha256,
       legenda = excluded.legenda,
       origem = excluded.origem,
       sequencia = excluded.sequencia,
       imagem_origem_id = COALESCE(excluded.imagem_origem_id, imagens_laudo.imagem_origem_id),
       ajustes_json = COALESCE(excluded.ajustes_json, imagens_laudo.ajustes_json),
       disponivel_painel = 1`,
    [id, laudoId, nomeSeguro(entrada.nomeArquivo), caminhoRelativo, mimeType, bytes.length, sha256, entrada.legenda, entrada.origem, entrada.sequencia, entrada.imagemOrigemId ?? null, entrada.ajustesJson ?? null],
  )

  if (anterior && anterior.caminho_relativo !== caminhoRelativo) await removerArquivoSemReferencias(anterior.caminho_relativo)
  const imagem = (await listarImagensLaudo(laudoId)).find(item => item.id === id)
  if (!imagem) throw new Error('Não foi possível reler a imagem armazenada.')
  return imagem
}

export async function salvarImagemLaudoPorBytes(
  laudoIdEntrada: string,
  entrada: SalvarImagemLaudoBytesEntrada,
): Promise<ImagemLaudoResumo | ImagemLaudoDuplicada> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const id = validarIdentificador(entrada.id, 'Imagem')
  const mimeTypeEntrada = entrada.mimeType.toLowerCase()
  if (!EXTENSAO_POR_MIME[mimeTypeEntrada]) throw new Error('Formato de imagem não compatível para armazenamento.')
  const bytesEntrada = Buffer.from(entrada.bytes)
  if (bytesEntrada.length === 0) throw new Error('A imagem está vazia.')
  const imagemOtimizada = entrada.origem === 'gdl' ? otimizarFotoGdl(bytesEntrada) : null
  const mimeType = imagemOtimizada?.mimeType || mimeTypeEntrada
  const bytes = imagemOtimizada?.bytes || bytesEntrada
  const extensao = EXTENSAO_POR_MIME[mimeType]
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const diretorioLaudo = path.join(DIRETORIO_IMAGENS, laudoId)
  const caminho = path.join(diretorioLaudo, `${sha256}.${extensao}`)
  const caminhoRelativo = path.relative(app.getPath('userData'), caminho).replace(/\\/g, '/')
  const anterior = (await executeQuery<ImagemLaudoRow>('SELECT * FROM imagens_laudo WHERE id = ?', [id]))[0]
  const duplicada = (await executeQuery<Pick<ImagemLaudoRow, 'id' | 'nome_arquivo' | 'disponivel_painel'>>(
    'SELECT id FROM imagens_laudo WHERE laudo_id = ? AND sha256 = ? AND id != ? LIMIT 1',
    [laudoId, sha256, id],
  ))[0]
  if (duplicada && !entrada.permitirDuplicada) {
    return {
      id: duplicada.id,
      nomeArquivo: duplicada.nome_arquivo,
      localizacao: duplicada.disponivel_painel === 1 ? 'painel' : 'laudo',
    }
  }

  fs.mkdirSync(diretorioLaudo, { recursive: true })
  if (!fs.existsSync(caminho)) {
    const temporario = `${caminho}.${process.pid}.${Date.now()}.tmp`
    fs.writeFileSync(temporario, bytes)
    fs.renameSync(temporario, caminho)
  }
  await executeNonQuery(
    `INSERT INTO imagens_laudo
      (id, laudo_id, nome_arquivo, caminho_relativo, mime_type, tamanho, sha256, legenda, origem, sequencia)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       nome_arquivo = excluded.nome_arquivo,
       caminho_relativo = excluded.caminho_relativo,
       mime_type = excluded.mime_type,
       tamanho = excluded.tamanho,
       sha256 = excluded.sha256,
       legenda = excluded.legenda,
       origem = excluded.origem,
       sequencia = excluded.sequencia,
       disponivel_painel = 1`,
    [id, laudoId, nomeSeguro(entrada.nomeArquivo), caminhoRelativo, mimeType, bytes.length, sha256, entrada.legenda, entrada.origem, entrada.sequencia],
  )
  if (anterior && anterior.caminho_relativo !== caminhoRelativo) await removerArquivoSemReferencias(anterior.caminho_relativo)
  if (imagemOtimizada) {
    log.info('Foto GDL otimizada para armazenamento no laudo', {
      laudoId,
      imagemId: id,
      bytesOriginais: bytesEntrada.length,
      bytesOtimizados: bytes.length,
      ladoMaximo: LADO_MAXIMO_FOTO_LAUDO,
    })
  }
  const registro = (await executeQuery<ImagemLaudoRow>('SELECT * FROM imagens_laudo WHERE id = ? AND laudo_id = ?', [id, laudoId]))[0]
  if (!registro) throw new Error('Não foi possível reler a imagem armazenada.')
  return criarResumoImagem(registro)
}

async function removerArquivoSemReferencias(caminhoRelativo: string): Promise<void> {
  const [{ quantidade }] = await executeQuery<{ quantidade: number }>(
    'SELECT COUNT(*) AS quantidade FROM imagens_laudo WHERE caminho_relativo = ?',
    [caminhoRelativo],
  )
  if (quantidade === 0) {
    const caminho = caminhoAbsoluto(caminhoRelativo)
    if (fs.existsSync(caminho)) fs.unlinkSync(caminho)
  }
}

export async function excluirImagemLaudo(laudoIdEntrada: string, imagemIdEntrada: string): Promise<void> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const imagemId = validarIdentificador(imagemIdEntrada, 'Imagem')
  const registro = (await executeQuery<ImagemLaudoRow>('SELECT * FROM imagens_laudo WHERE id = ? AND laudo_id = ?', [imagemId, laudoId]))[0]
  if (!registro) return
  const derivados = await executeQuery<{ id: string }>('SELECT id FROM imagens_laudo WHERE imagem_origem_id = ? AND laudo_id = ? LIMIT 1', [imagemId, laudoId])
  if (derivados.length > 0) throw new Error('Esta imagem é a base de uma figura editada e não pode ser excluída.')
  await executeNonQuery('DELETE FROM imagens_laudo WHERE id = ? AND laudo_id = ?', [imagemId, laudoId])
  await removerArquivoSemReferencias(registro.caminho_relativo)
}

export async function atualizarLegendaImagemLaudo(laudoIdEntrada: string, imagemIdEntrada: string, legenda: string): Promise<void> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const imagemId = validarIdentificador(imagemIdEntrada, 'Imagem')
  await executeNonQuery('UPDATE imagens_laudo SET legenda = ? WHERE id = ? AND laudo_id = ?', [legenda, imagemId, laudoId])
}

export async function arquivarImagemLaudo(laudoIdEntrada: string, imagemIdEntrada: string): Promise<void> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const imagemId = validarIdentificador(imagemIdEntrada, 'Imagem')
  await executeNonQuery(
    'UPDATE imagens_laudo SET disponivel_painel = 0 WHERE id = ? AND laudo_id = ?',
    [imagemId, laudoId],
  )
}

export async function disponibilizarImagemLaudo(laudoIdEntrada: string, imagemIdEntrada: string): Promise<void> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const imagemId = validarIdentificador(imagemIdEntrada, 'Imagem')
  await executeNonQuery(
    'UPDATE imagens_laudo SET disponivel_painel = 1 WHERE id = ? AND laudo_id = ?',
    [imagemId, laudoId],
  )
}

export async function atualizarOrdemImagensLaudo(laudoIdEntrada: string, ordem: AtualizarOrdemImagemLaudoEntrada[]): Promise<void> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  await withTransaction(async () => {
    for (const item of ordem) {
      const id = validarIdentificador(item.id, 'Imagem')
      await executeNonQuery('UPDATE imagens_laudo SET sequencia = ? WHERE id = ? AND laudo_id = ?', [item.sequencia, id, laudoId])
    }
  })
}
