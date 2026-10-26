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

export interface ImagemLaudoPersistida extends ImagemLaudoResumo {
  dataUri: string
}

export interface MiniaturaImagemLaudo {
  id: string
  thumbnailDataUri: string
}

export type PerfilPreviaEditor = 'economico' | 'equilibrado' | 'nitido'

export const PERFIL_PREVIA_EDITOR_PADRAO: PerfilPreviaEditor = 'equilibrado'

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
