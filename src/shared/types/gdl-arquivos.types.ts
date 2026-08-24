export type OrigemArquivoRepGdl = 'lista_fotos'

export interface ArquivoRepGdl {
  idSelecao: string
  origem: OrigemArquivoRepGdl
  nomeArquivo: string
  tamanho: number | null
  dataUpload: string | null
  provavelImagem: boolean
  status: string | null
  thumbnailDataUri?: string
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

export interface ListaImagensRepGdl {
  sessaoId: string
  ambiente: 'homologacao' | 'producao'
  numeroRep: string
  anoRep: string
  arquivos: ArquivoRepGdl[]
}

export interface ImagemRepGdlAdicionadaAoLaudo {
  idSelecao: string
  imagemId: string
  nomeArquivo: string
  mimeType: string
  tamanho: number
  sha256: string
  sequencia: number
}

export interface ResultadoCapturaImagensLaudoGdl {
  imagens: ImagemRepGdlAdicionadaAoLaudo[]
  falhas: FalhaCapturaImagemRepGdl[]
  duplicadas: DuplicataImagemRepGdl[]
}

export interface DuplicataImagemRepGdl {
  idSelecao: string
  nomeArquivo: string
  imagemExistenteId: string
  localizacao: 'painel' | 'laudo'
}
