export interface OpcaoCampoBalistica {
  codigo: string
  label: string
}

export interface CampoPersonalizadoBalistica {
  id: string
  chaveGdl: string
  aliasesGdl?: string[]
  label: string
  controle: 'texto' | 'select' | 'checkbox' | 'combobox'
  obrigatorio: boolean
  obrigatorioConclusao?: boolean
  maxLength?: number
  mapeamentoApiConfirmado?: boolean
  opcoes?: readonly OpcaoCampoBalistica[]
}

export interface CamposComunsPecaBalistica {
  identificacao: string
  quantidade: number
  unidadeMedida: string
  quantidadeDescricao: string
  examinadoInLoco: boolean
  dataEntrada: string
  lacreEntrada: string
  lacreSaida: string
  dataLiberacao: string
  codigoVestigio: string
  consumida: 'S' | 'N' | 'P'
  observacao: string
  materialIncinerado?: 'S' | 'N'
}

export interface PecaBalistica {
  idLocal: string
  origem: 'manual' | 'gdl'
  alteradaLocalmente: boolean
  codPecaGdl?: number
  tipoCodigo: string
  tipoPeca: string
  comuns: CamposComunsPecaBalistica
  personalizados: Record<string, unknown>
  extrasGdl: Record<string, unknown>
}
