export type OrigemArquivoRepGdl = 'lista_fotos'

export interface ArquivoRepGdl {
  idSelecao: string
  origem: OrigemArquivoRepGdl
  nomeArquivo: string
  tamanho: number | null
  dataUpload: string | null
  provavelImagem: boolean
  status: string | null
}

export interface ImagemRepGdlCapturada {
  idSelecao: string
  nomeArquivo: string
  mimeType: string
  tamanho: number
  dataUri: string
  sha256: string
}

export interface FalhaCapturaImagemRepGdl {
  idSelecao: string
  erro: string
}

export interface ResultadoCapturaImagensRepGdl {
  imagens: ImagemRepGdlCapturada[]
  falhas: FalhaCapturaImagemRepGdl[]
}
