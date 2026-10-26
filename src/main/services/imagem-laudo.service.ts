import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { app, nativeImage } from 'electron'
import { executeNonQuery, executeQuery, withTransaction } from '../database/sqlite.js'
import { getLogger } from '../utils/logger.js'
import { configuracaoService } from './configuracao.service.js'
import { LIMITES_PREVIA_EDITOR, PERFIL_PREVIA_EDITOR_PADRAO, perfilPreviaEditorValido } from '../../shared/types/imagem-laudo.types.js'
import type {
  AtualizarOrdemImagemLaudoEntrada,
  ImagemLaudoPersistida,
  ImagemLaudoDuplicada,
  ImagemLaudoResumo,
  MiniaturaImagemLaudo,
  ResultadoReconciliacaoImagensLaudo,
  SalvarImagemLaudoEntrada,
  SalvarImagemLaudoBytesEntrada,
  ImagemEstagiadaLaudo,
  ImagemPreparadaEditor,
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
  temporaria_sessao: number
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
const LADO_MAXIMO_PREVIA_EDITOR = 960
const LIMITE_BYTES_ESTAGIO = 256 * 1024 * 1024
type ImagemEstagioInterna = SalvarImagemLaudoBytesEntrada & { thumbnailDataUri: string }
const imagensEstagiadas = new Map<string, Map<string, ImagemEstagioInterna>>()
export const VERSAO_OTIMIZACAO_FOTO_GDL = 'original-local-v1'

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

export function otimizarFotoGdl(bytesOriginais: Buffer): { mimeType: 'image/jpeg'; bytes: Buffer } {
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

export async function listarHashesImagensLaudo(laudoIdEntrada: string): Promise<Set<string>> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const registros = await executeQuery<Pick<ImagemLaudoRow, 'sha256'>>(
    'SELECT sha256 FROM imagens_laudo WHERE laudo_id = ?',
    [laudoId],
  )
  return new Set(registros.map(registro => registro.sha256))
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
  const idsEncontrados = new Set(registros.map(registro => registro.id))
  for (const id of ids) {
    if (idsEncontrados.has(id)) continue
    const estagiada = imagensEstagiadas.get(laudoId)?.get(id)
    if (!estagiada) continue
    const imagem = nativeImage.createFromBuffer(Buffer.from(estagiada.bytes))
    if (imagem.isEmpty()) continue
    const dimensoes = imagem.getSize()
    const largura = Math.min(larguraMaxima, Math.max(1, dimensoes.width))
    const altura = Math.max(1, Math.round(dimensoes.height * largura / Math.max(1, dimensoes.width)))
    const bytes = imagem.resize({ width: largura, height: altura, quality: 'good' }).toJPEG(qualidadeJpeg)
    miniaturas.push({ id, thumbnailDataUri: `data:image/jpeg;base64,${bytes.toString('base64')}` })
  }
  return miniaturas
}

export async function obterPreviaEditorImagemLaudo(laudoIdEntrada: string, imagemIdEntrada: string, maiorLadoPermitido = LADO_MAXIMO_PREVIA_EDITOR): Promise<string> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const imagemId = validarIdentificador(imagemIdEntrada, 'Imagem')
  const registro = (await executeQuery<ImagemLaudoRow>(
    'SELECT * FROM imagens_laudo WHERE id = ? AND laudo_id = ?', [imagemId, laudoId],
  ))[0]
  if (!registro) throw new Error('Arquivo local da figura não encontrado.')
  const arquivo = caminhoAbsoluto(registro.caminho_relativo)
  const imagem = nativeImage.createFromPath(arquivo)
  if (imagem.isEmpty()) throw new Error('Arquivo local da figura inválido.')
  const dimensoes = imagem.getSize()
  const maiorLado = Math.max(dimensoes.width, dimensoes.height)
  if (maiorLado <= 0) throw new Error('Dimensões da figura inválidas.')
  if (!Number.isInteger(maiorLadoPermitido) || maiorLadoPermitido < 1 || maiorLadoPermitido > 1280) throw new Error('Resolução da prévia inválida.')
  const escala = Math.min(1, maiorLadoPermitido / maiorLado)
  const ajustada = escala < 1 ? imagem.resize({
    width: Math.max(1, Math.round(dimensoes.width * escala)),
    height: Math.max(1, Math.round(dimensoes.height * escala)),
    quality: 'good',
  }) : imagem
  const manterPng = registro.mime_type === 'image/png' || registro.mime_type === 'image/gif'
  const bytes = manterPng ? ajustada.toPNG() : ajustada.toJPEG(80)
  if (bytes.length === 0) throw new Error('Não foi possível gerar a prévia da figura.')
  return `data:image/${manterPng ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}`
}

export function estagiarImagemLaudoPorBytes(laudoIdEntrada: string, entrada: SalvarImagemLaudoBytesEntrada): ImagemEstagiadaLaudo {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const id = validarIdentificador(entrada.id, 'Imagem')
  const mimeType = entrada.mimeType.toLowerCase()
  if (!EXTENSAO_POR_MIME[mimeType]) throw new Error('Formato de imagem não compatível.')
  const bytes = Buffer.from(entrada.bytes)
  if (bytes.length === 0) throw new Error('A imagem está vazia.')
  const imagem = nativeImage.createFromBuffer(bytes)
  if (imagem.isEmpty()) throw new Error('Arquivo de imagem inválido.')
  const total = [...imagensEstagiadas.values()].flatMap(grupo => [...grupo.values()])
    .reduce((soma, item) => soma + item.bytes.byteLength, 0)
  if (total + bytes.length > LIMITE_BYTES_ESTAGIO) throw new Error('O painel atingiu o limite de imagens temporárias. Insira ou remova algumas fotos.')
  const dimensoes = imagem.getSize()
  const escala = Math.min(1, 300 / Math.max(dimensoes.width, dimensoes.height))
  const miniatura = escala < 1 ? imagem.resize({
    width: Math.max(1, Math.round(dimensoes.width * escala)),
    height: Math.max(1, Math.round(dimensoes.height * escala)),
    quality: 'good',
  }) : imagem
  const png = mimeType === 'image/png' || mimeType === 'image/gif'
  const miniaturaBytes = png ? miniatura.toPNG() : miniatura.toJPEG(75)
  const thumbnailDataUri = `data:image/${png ? 'png' : 'jpeg'};base64,${miniaturaBytes.toString('base64')}`
  const grupo = imagensEstagiadas.get(laudoId) ?? new Map<string, ImagemEstagioInterna>()
  grupo.set(id, { ...entrada, id, mimeType, bytes, thumbnailDataUri })
  imagensEstagiadas.set(laudoId, grupo)
  return {
    id,
    thumbnailDataUri,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    nomeArquivo: entrada.nomeArquivo,
    tamanho: bytes.length,
    legenda: entrada.legenda,
    origem: entrada.origem,
    sequencia: entrada.sequencia,
  }
}

export function listarImagensEstagiadasLaudo(laudoIdEntrada: string): ImagemEstagiadaLaudo[] {
  const grupo = imagensEstagiadas.get(validarIdentificador(laudoIdEntrada, 'Laudo'))
  return [...(grupo?.entries() || [])].map(([id, entrada]) => ({
    id, thumbnailDataUri: entrada.thumbnailDataUri,
    sha256: createHash('sha256').update(entrada.bytes).digest('hex'),
    nomeArquivo: entrada.nomeArquivo, tamanho: entrada.bytes.byteLength,
    legenda: entrada.legenda, origem: entrada.origem, sequencia: entrada.sequencia,
  }))
}

export function estagiarImagemLaudoPorDataUri(laudoId: string, entrada: SalvarImagemLaudoEntrada): ImagemEstagiadaLaudo {
  const { mimeType, bytes } = interpretarDataUri(entrada.dataUri)
  return estagiarImagemLaudoPorBytes(laudoId, {
    id: entrada.id,
    nomeArquivo: entrada.nomeArquivo,
    mimeType,
    bytes,
    legenda: entrada.legenda,
    origem: entrada.origem,
    sequencia: entrada.sequencia,
  })
}

export function descartarImagensEstagiadasLaudo(laudoIdEntrada: string): void {
  imagensEstagiadas.delete(validarIdentificador(laudoIdEntrada, 'Laudo'))
}

export async function limparImagensTemporariasSemReferencia(laudoIdEntrada?: string): Promise<number> {
  const laudoId = laudoIdEntrada ? validarIdentificador(laudoIdEntrada, 'Laudo') : undefined
  if (laudoId) {
    const pendente = await executeQuery<{ id: string }>(
      'SELECT id FROM imagens_laudo WHERE laudo_id = ? AND temporaria_sessao = 1 LIMIT 1', [laudoId],
    )
    if (pendente.length === 0) return 0
  }
  const laudos = await executeQuery<{ id: string; conteudo: string }>(
    laudoId ? 'SELECT id, conteudo FROM laudos WHERE id = ?' : 'SELECT id, conteudo FROM laudos WHERE id IN (SELECT DISTINCT laudo_id FROM imagens_laudo WHERE temporaria_sessao = 1)',
    laudoId ? [laudoId] : [],
  )
  let removidas = 0
  for (const laudo of laudos) {
    const registros = await executeQuery<ImagemLaudoRow>('SELECT * FROM imagens_laudo WHERE laudo_id = ?', [laudo.id])
    const porId = new Map(registros.map(registro => [registro.id, registro]))
    const preservar = extrairIdsDeImagemDoConteudo(laudo.conteudo || '')
    const fila = [...preservar]
    while (fila.length > 0) {
      const origem = porId.get(fila.pop() || '')?.imagem_origem_id
      if (origem && !preservar.has(origem)) {
        preservar.add(origem)
        fila.push(origem)
      }
    }
    const remover = registros.filter(registro => registro.temporaria_sessao === 1 && !preservar.has(registro.id))
    if (remover.length === 0) continue
    await withTransaction(async () => {
      for (const registro of remover) {
        await executeNonQuery('DELETE FROM imagens_laudo WHERE id = ? AND laudo_id = ?', [registro.id, laudo.id])
      }
    })
    for (const caminho of new Set(remover.map(registro => registro.caminho_relativo))) {
      await removerArquivoSemReferencias(caminho)
    }
    removidas += remover.length
  }
  return removidas
}

export function descartarImagemEstagiadaLaudo(laudoIdEntrada: string, imagemIdEntrada: string): void {
  imagensEstagiadas.get(validarIdentificador(laudoIdEntrada, 'Laudo'))?.delete(validarIdentificador(imagemIdEntrada, 'Imagem'))
}

export function obterImagemEstagiadaLaudo(laudoIdEntrada: string, imagemIdEntrada: string): { id: string; dataUri: string } {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const imagemId = validarIdentificador(imagemIdEntrada, 'Imagem')
  const entrada = imagensEstagiadas.get(laudoId)?.get(imagemId)
  if (!entrada) throw new Error('Imagem temporária não encontrada.')
  return { id: imagemId, dataUri: `data:${entrada.mimeType};base64,${Buffer.from(entrada.bytes).toString('base64')}` }
}

export async function prepararImagemEditorLaudo(
  laudoIdEntrada: string, imagemIdEntrada: string, larguraCss: number, alturaCss: number, densidade: number,
): Promise<ImagemPreparadaEditor> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const imagemId = validarIdentificador(imagemIdEntrada, 'Imagem')
  if (![larguraCss, alturaCss, densidade].every(Number.isFinite) || larguraCss < 1 || alturaCss < 1 || densidade <= 0) {
    throw new Error('Dimensões de exibição inválidas.')
  }
  const valorPerfil = await configuracaoService.obter('perfil_previa_editor')
  const perfil = perfilPreviaEditorValido(valorPerfil) ? valorPerfil : PERFIL_PREVIA_EDITOR_PADRAO
  const limites = LIMITES_PREVIA_EDITOR[perfil]
  const densidadeAplicada = Math.max(1, Math.min(4, densidade))
  const maiorLado = Math.max(limites.minimo, Math.min(limites.maximo, Math.round(Math.max(larguraCss, alturaCss) * densidadeAplicada)))
  const estagiada = imagensEstagiadas.get(laudoId)?.get(imagemId)
  if (estagiada) {
    await salvarImagemLaudoPorBytes(laudoId, { ...estagiada, permitirDuplicada: true })
  }
  try {
    const previaDataUri = await obterPreviaEditorImagemLaudo(laudoId, imagemId, maiorLado)
    if (estagiada) imagensEstagiadas.get(laudoId)?.delete(imagemId)
    return { id: imagemId, previaDataUri, maiorLado }
  } catch (erro) {
    if (estagiada) await excluirImagemLaudo(laudoId, imagemId)
    throw erro
  }
}

export async function obterImagemLaudoPorId(laudoIdEntrada: string, imagemIdEntrada: string): Promise<ImagemLaudoPersistida> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const imagemId = validarIdentificador(imagemIdEntrada, 'Imagem')
  const registro = (await executeQuery<ImagemLaudoRow>(
    'SELECT * FROM imagens_laudo WHERE id = ? AND laudo_id = ?',
    [imagemId, laudoId],
  ))[0]
  if (!registro) {
    const estagiada = imagensEstagiadas.get(laudoId)?.get(imagemId)
    if (estagiada) {
      const bytes = Buffer.from(estagiada.bytes)
      return {
        id: imagemId, laudoId, nomeArquivo: estagiada.nomeArquivo, mimeType: estagiada.mimeType,
        tamanho: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
        legenda: estagiada.legenda, origem: estagiada.origem, sequencia: estagiada.sequencia,
        createdAt: new Date().toISOString(), dataUri: `data:${estagiada.mimeType};base64,${bytes.toString('base64')}`,
      }
    }
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

export async function obterImagemImpressaoLaudo(
  laudoIdEntrada: string, imagemIdEntrada: string, larguraMaxima: number,
): Promise<{ id: string; dataUri: string }> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const imagemId = validarIdentificador(imagemIdEntrada, 'Imagem')
  if (!Number.isInteger(larguraMaxima) || larguraMaxima < 1 || larguraMaxima > 3000) throw new Error('Resolução de impressão inválida.')
  const registro = (await executeQuery<ImagemLaudoRow>(
    'SELECT * FROM imagens_laudo WHERE id = ? AND laudo_id = ?', [imagemId, laudoId],
  ))[0]
  if (!registro) throw new Error('Arquivo local da figura não encontrado para impressão.')
  const bytesOriginais = fs.readFileSync(caminhoAbsoluto(registro.caminho_relativo))
  if (createHash('sha256').update(bytesOriginais).digest('hex') !== registro.sha256) throw new Error('Arquivo local da figura não passou na verificação de integridade.')
  const imagem = nativeImage.createFromBuffer(bytesOriginais)
  if (imagem.isEmpty()) throw new Error('Arquivo local da figura inválido para impressão.')
  const dimensoes = imagem.getSize()
  if (!dimensoes.width || !dimensoes.height) throw new Error('Dimensões da figura inválidas para impressão.')
  if (dimensoes.width <= larguraMaxima && ['image/jpeg', 'image/png', 'image/gif', 'image/bmp'].includes(registro.mime_type)) {
    return { id: imagemId, dataUri: `data:${registro.mime_type};base64,${bytesOriginais.toString('base64')}` }
  }
  const largura = Math.min(dimensoes.width, larguraMaxima)
  const altura = Math.max(1, Math.round(dimensoes.height * largura / dimensoes.width))
  const ajustada = largura < dimensoes.width ? imagem.resize({ width: largura, height: altura, quality: 'best' }) : imagem
  const formatoJpeg = registro.mime_type === 'image/jpeg'
  const bytes = formatoJpeg ? ajustada.toJPEG(90) : ajustada.toPNG()
  if (bytes.length === 0) throw new Error('Não foi possível preparar a figura para impressão.')
  return { id: imagemId, dataUri: `data:image/${formatoJpeg ? 'jpeg' : 'png'};base64,${bytes.toString('base64')}` }
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
      (id, laudo_id, nome_arquivo, caminho_relativo, mime_type, tamanho, sha256, legenda, origem, sequencia, imagem_origem_id, ajustes_json, temporaria_sessao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
  const registro = (await executeQuery<ImagemLaudoRow>('SELECT * FROM imagens_laudo WHERE id = ? AND laudo_id = ?', [id, laudoId]))[0]
  if (!registro) throw new Error('Não foi possível reler a imagem armazenada.')
  return { ...criarResumoImagem(registro), tamanho: bytes.length, dataUri: `data:${mimeType};base64,${bytes.toString('base64')}` }
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
  const mimeType = mimeTypeEntrada
  const bytes = bytesEntrada
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
      (id, laudo_id, nome_arquivo, caminho_relativo, mime_type, tamanho, sha256, legenda, origem, sequencia, temporaria_sessao)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
