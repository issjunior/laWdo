import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { app } from 'electron'
import { executeNonQuery, executeQuery, withTransaction } from '../database/sqlite.js'
import { getLogger } from '../utils/logger.js'
import type {
  AtualizarOrdemImagemLaudoEntrada,
  ImagemLaudoPersistida,
  SalvarImagemLaudoEntrada,
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

export async function listarImagensLaudo(laudoIdEntrada: string): Promise<ImagemLaudoPersistida[]> {
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
        id: registro.id,
        laudoId: registro.laudo_id,
        nomeArquivo: registro.nome_arquivo,
        mimeType: registro.mime_type,
        tamanho: bytes.length,
        sha256: registro.sha256,
        legenda: registro.legenda,
        origem: registro.origem,
        sequencia: registro.sequencia,
        dataUri: `data:${registro.mime_type};base64,${bytes.toString('base64')}`,
        createdAt: registro.created_at,
      })
    } catch (error) {
      log.warn('Imagem do laudo ausente ou ilegível', { laudoId, imagemId: registro.id, error })
    }
  }
  return imagens
}

export async function salvarImagemLaudo(
  laudoIdEntrada: string,
  entrada: SalvarImagemLaudoEntrada,
): Promise<ImagemLaudoPersistida> {
  const laudoId = validarIdentificador(laudoIdEntrada, 'Laudo')
  const id = validarIdentificador(entrada.id, 'Imagem')
  const { mimeType, bytes } = interpretarDataUri(entrada.dataUri)
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
  const imagem = (await listarImagensLaudo(laudoId)).find(item => item.id === id)
  if (!imagem) throw new Error('Não foi possível reler a imagem armazenada.')
  return imagem
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
