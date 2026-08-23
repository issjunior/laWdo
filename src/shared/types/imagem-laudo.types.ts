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
  createdAt: string
}

export interface ImagemLaudoPersistida extends ImagemLaudoResumo {
  dataUri: string
}

export interface MiniaturaImagemLaudo {
  id: string
  thumbnailDataUri: string
}

export interface SalvarImagemLaudoEntrada {
  id: string
  nomeArquivo: string
  dataUri: string
  legenda: string
  origem: 'local' | 'gdl'
  sequencia: number
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
