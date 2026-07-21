export interface ImagemLaudoPersistida {
  id: string
  laudoId: string
  nomeArquivo: string
  mimeType: string
  tamanho: number
  sha256: string
  legenda: string
  origem: 'local' | 'gdl'
  sequencia: number
  dataUri: string
  createdAt: string
}

export interface SalvarImagemLaudoEntrada {
  id: string
  nomeArquivo: string
  dataUri: string
  legenda: string
  origem: 'local' | 'gdl'
  sequencia: number
}

export interface AtualizarOrdemImagemLaudoEntrada {
  id: string
  sequencia: number
}
