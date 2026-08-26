export interface DashboardKpiStatus {
  status: string
  total: number
}

export interface DashboardTempoMedioTipoExame {
  tipoExameId: string | null
  tipoExameNome: string
  totalLaudos: number
  tempoMedioDias: number
}

export interface DashboardLaudoRecente {
  id: string
  rep_numero: string
  tipo_exame_nome: string
  status: string
  updated_at: string
}

export interface DashboardRepRecente {
  id: string
  numero: string
  tipo_exame_nome: string
  status: string
  updated_at: string
}

export interface DashboardSerieMensal {
  referencia: string
  ano: number
  mes: number
  totalConcluidos: number
}

export interface DashboardSerieAnual {
  ano: number
  totalConcluidos: number
  mesesComDados: number
}

export interface DashboardIndicadorConfiabilidade {
  dadosInsuficientes: boolean
  mesesHistoricos: number
  mesesComDados: number
  coberturaHistorica: number
  nivel: 'alta' | 'moderada' | 'baixa' | 'insuficiente'
  mensagem: string
}

export interface DashboardResumo {
  repsPorStatus: DashboardKpiStatus[]
  repsPrazoProximo: number
  repsPrazoVencido: number
  laudosConcluidosAguardandoEntrega: number
  laudosEmAndamentoSemAlteracao: number
  laudosPorStatus: DashboardKpiStatus[]
  tempoMedioPorTipoExame: DashboardTempoMedioTipoExame[]
  repsRecentes: DashboardRepRecente[]
  laudosRecentes: DashboardLaudoRecente[]
}

export type DashboardTipoDataConsulta = 'criacao' | 'alteracao' | 'conclusao' | 'entrega'

export interface DashboardConsultaLaudosEntrada {
  busca?: string
  tipoData: DashboardTipoDataConsulta
  dataInicial?: string
  dataFinal?: string
  pagina?: number
  tamanhoPagina?: number
}

export interface DashboardLaudoConsulta {
  id: string
  repId: string
  repNumero: string
  tipoExameId: string | null
  tipoExameCodigo: string | null
  tipoExameNome: string
  status: string
  createdAt: string | null
  updatedAt: string | null
  dataConclusao: string | null
  dataEntrega: string | null
  dataOrdenacao: string | null
}

export interface DashboardConsultaLaudosResultado {
  itens: DashboardLaudoConsulta[]
  total: number
  pagina: number
  tamanhoPagina: number
  porStatus: DashboardKpiStatus[]
}

export interface DashboardProducaoLaudosEntrada {
  tipoExameId?: string
  dataInicial?: string
  dataFinal?: string
}

export interface DashboardIndicadorCicloProducao {
  mediaDias: number
  medianaDias: number
  quantidade: number
}

export interface DashboardProducaoLaudosResultado {
  natureza: { id: string; codigo: string | null; nome: string }
  repAteConclusao: DashboardIndicadorCicloProducao
  laudoAteConclusao: DashboardIndicadorCicloProducao
}

export interface DashboardProjecoes {
  historicoMensal: DashboardSerieMensal[]
  resumoAnual: DashboardSerieAnual[]
  projecaoMensalEstimada: DashboardSerieMensal | null
  projecaoAnualEstimada: DashboardSerieAnual | null
  baseHistoricaAnalisada: {
    primeiroMes: string | null
    ultimoMes: string | null
    totalLaudosConcluidos: number
  }
  indicadorConfiabilidade: DashboardIndicadorConfiabilidade
}
