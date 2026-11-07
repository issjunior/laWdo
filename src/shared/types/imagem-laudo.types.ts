export interface ImagemLaudoResumo {
  id: string
  laudoId: string
  nomeArquivo: string
  mimeType: string
  tamanho: number
  sha256: string
  legenda: string
  origem: 'local' | 'gdl'
  sequencia: number
  imagemOrigemId?: string | null
  createdAt: string
}

export interface ResultadoAtualizacaoFiguras {
  restauradas: number
  semDescricao: number
  falhasConsulta: number
  erro?: string
}

export type CodigoFalhaImagemImpressao = 'ENTRADA_INVALIDA' | 'CONSULTA_FALHOU' | 'REGISTRO_AUSENTE'
  | 'ARQUIVO_AUSENTE' | 'LEITURA_FALHOU' | 'INTEGRIDADE_FALHOU' | 'PROCESSAMENTO_FALHOU'
  | 'COMUNICACAO_FALHOU' | 'RESPOSTA_INVALIDA' | 'INDETERMINADA'

export interface FalhaImagemImpressao {
  codigo: CodigoFalhaImagemImpressao
}

export function codigoFalhaImagemImpressaoValido(valor: unknown): valor is CodigoFalhaImagemImpressao {
  return valor === 'ENTRADA_INVALIDA' || valor === 'CONSULTA_FALHOU' || valor === 'REGISTRO_AUSENTE'
    || valor === 'ARQUIVO_AUSENTE' || valor === 'LEITURA_FALHOU' || valor === 'INTEGRIDADE_FALHOU'
    || valor === 'PROCESSAMENTO_FALHOU' || valor === 'COMUNICACAO_FALHOU'
    || valor === 'RESPOSTA_INVALIDA' || valor === 'INDETERMINADA'
}

export interface ImagemLaudoPersistida extends ImagemLaudoResumo {
  dataUri: string
  ajustesFigura?: AjustesFigura
}

export interface TextoFigura {
  id: string
  conteudo: string
  x: number
  y: number
  tamanho: 'pequeno' | 'medio' | 'grande'
  cor: 'branco' | 'preto' | 'vermelho' | 'amarelo' | 'azul'
}

export interface AjustesFigura {
  angulo: number
  espelharHorizontal: boolean
  espelharVertical: boolean
  corte: { x: number; y: number; largura: number; altura: number }
  textos?: TextoFigura[]
}

function textoFiguraValido(valor: unknown): valor is TextoFigura {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false
  const texto = valor as Record<string, unknown>
  return typeof texto.id === 'string' && texto.id.length > 0 && texto.id.length <= 100
    && typeof texto.conteudo === 'string' && texto.conteudo.length <= 500
    && typeof texto.x === 'number' && Number.isFinite(texto.x) && texto.x >= 0 && texto.x <= 100
    && typeof texto.y === 'number' && Number.isFinite(texto.y) && texto.y >= 0 && texto.y <= 100
    && typeof texto.tamanho === 'string' && ['pequeno', 'medio', 'grande'].includes(texto.tamanho)
    && typeof texto.cor === 'string' && ['branco', 'preto', 'vermelho', 'amarelo', 'azul'].includes(texto.cor)
}

export function ajustesFiguraValidos(valor: unknown): valor is AjustesFigura {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false
  const ajustes = valor as Record<string, unknown>
  if (ajustes.textos !== undefined && (!Array.isArray(ajustes.textos) || ajustes.textos.length > 20
    || !ajustes.textos.every(textoFiguraValido) || new Set(ajustes.textos.map(texto => texto.id)).size !== ajustes.textos.length)) return false
  const corte = ajustes.corte
  if (!corte || typeof corte !== 'object' || Array.isArray(corte)) return false
  const area = corte as Record<string, unknown>
  const { x, y, largura, altura } = area
  if (typeof ajustes.angulo !== 'number' || !Number.isFinite(ajustes.angulo)
    || typeof x !== 'number' || !Number.isFinite(x)
    || typeof y !== 'number' || !Number.isFinite(y)
    || typeof largura !== 'number' || !Number.isFinite(largura)
    || typeof altura !== 'number' || !Number.isFinite(altura)) return false
  return typeof ajustes.espelharHorizontal === 'boolean' && typeof ajustes.espelharVertical === 'boolean'
    && x >= 0 && y >= 0 && largura > 0 && altura > 0 && x + largura <= 100 && y + altura <= 100
}

export interface MiniaturaImagemLaudo {
  id: string
  thumbnailDataUri: string
}

export type PerfilPreviaEditor = 'economico' | 'equilibrado' | 'nitido'

export type PerfilFiguraLaudo = 'nitido' | 'equilibrado' | 'compacto' | 'maxima_economia'

export const PERFIL_FIGURA_LAUDO_PADRAO: PerfilFiguraLaudo = 'maxima_economia'

export const LIMITES_FIGURA_LAUDO: Record<PerfilFiguraLaudo, { maiorLado: number; qualidadeJpeg: number }> = {
  nitido: { maiorLado: 2048, qualidadeJpeg: 85 },
  equilibrado: { maiorLado: 1600, qualidadeJpeg: 78 },
  compacto: { maiorLado: 1280, qualidadeJpeg: 70 },
  maxima_economia: { maiorLado: 1024, qualidadeJpeg: 62 },
}

export function perfilFiguraLaudoValido(valor: unknown): valor is PerfilFiguraLaudo {
  return valor === 'nitido' || valor === 'equilibrado' || valor === 'compacto' || valor === 'maxima_economia'
}

export const PERFIL_PREVIA_EDITOR_PADRAO: PerfilPreviaEditor = 'economico'

export const LIMITES_PREVIA_EDITOR: Record<PerfilPreviaEditor, { minimo: number; maximo: number }> = {
  economico: { minimo: 480, maximo: 640 },
  equilibrado: { minimo: 640, maximo: 960 },
  nitido: { minimo: 960, maximo: 1280 },
}

export function perfilPreviaEditorValido(valor: unknown): valor is PerfilPreviaEditor {
  return valor === 'economico' || valor === 'equilibrado' || valor === 'nitido'
}

export interface ImagemPreparadaEditor {
  id: string
  previaDataUri: string
  maiorLado: number
}

export interface ImagemEstagiadaLaudo {
  id: string
  thumbnailDataUri: string
  sha256: string
  nomeArquivo: string
  tamanho: number
  legenda: string
  origem: 'local' | 'gdl'
  sequencia: number
}

export interface SalvarImagemLaudoEntrada {
  id: string
  nomeArquivo: string
  dataUri: string
  legenda: string
  origem: 'local' | 'gdl'
  sequencia: number
  imagemOrigemId?: string
  ajustesJson?: string
}

export interface SalvarImagemLaudoBytesEntrada {
  id: string
  nomeArquivo: string
  mimeType: string
  bytes: Uint8Array
  legenda: string
  origem: 'local' | 'gdl'
  sequencia: number
  permitirDuplicada?: boolean
}

export interface ImagemLaudoDuplicada {
  id: string
  nomeArquivo: string
  localizacao: 'painel' | 'laudo'
}

export interface ResultadoReconciliacaoImagensLaudo {
  recuperadasParaPainel: number
  arquivadasComoInseridas: number
  referenciasSemImagem: number
  arquivosAusentes: number
}

export interface AtualizarOrdemImagemLaudoEntrada {
  id: string
  sequencia: number
}
