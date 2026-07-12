export type OrigemPecaB602 = 'manual' | 'gdl'

export interface CamposComunsPecaB602 {
  identificacao: string
  numeroAnalises: string
  quantidade: number
  unidadeMedida: string
  quantidadeDescricao: string
  examinadoInLoco: boolean
  dataEntrada: string
  lacreEntrada: string
  lacreSaida: string
  dataLiberacao: string
  codigoVestigio: string
  consumida: 'S' | 'N' | 'P' | ''
  observacao: string
}

export interface PecaB602 {
  idLocal: string
  origem: OrigemPecaB602
  alteradaLocalmente: boolean
  codPecaGdl?: number
  tipoCodigo: string
  tipoPeca: string
  comuns: CamposComunsPecaB602
  personalizados: Record<string, unknown>
  extrasGdl: Record<string, unknown>
}

export interface AvisoImportacao {
  codigo: string
  mensagem: string
  contexto?: Record<string, unknown>
}

export interface MetadadosIntegracaoGdl {
  origemInicial: 'manual' | 'gdl'
  dadosSolicitacao?: DadosSolicitacaoGdl
  dadosInvestigacao?: DadosInvestigacaoGdl
  ultimaConsulta?: {
    ambiente: 'homologacao' | 'producao'
    numeroRep: string
    anoRep: string
    consultadoEm: string
  }
}

export interface DadosSolicitacaoGdl {
  orgao: string
  responsavel: string
  autoridade: string
  origensCandidatasSolicitacao: ReferenciaOrigemGdl[]
}

export interface ReferenciaOrigemGdl {
  tipo: string
  numero: string
}

export interface DadosInvestigacaoGdl {
  envolvidos: string[]
  boletinsOcorrencia: ReferenciaOrigemGdl[]
  inqueritosPoliciais: ReferenciaOrigemGdl[]
}

export interface ResultadoImportacaoExame<TDados> {
  codigoExame: string
  camposGerais: Record<string, string>
  camposEspecificos: TDados
  avisos: AvisoImportacao[]
  metadadosIntegracaoGdl?: MetadadosIntegracaoGdl
}

export interface DadosImportacaoB602 {
  pecas: PecaB602[]
  dadosSolicitacao: DadosSolicitacaoGdl
  dadosInvestigacao: DadosInvestigacaoGdl
}
