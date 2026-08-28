export interface DashboardKpiStatus {
  status: string
  total: number
}

export interface DashboardResumo {
  repsPorStatus: DashboardKpiStatus[]
  laudosPorStatus: DashboardKpiStatus[]
  repsPrazoVencido: number
  repsPrazoProximo: number
  laudosConcluidosAguardandoEntrega: number
  laudosEmAndamentoSemAlteracao: number
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

export interface DashboardMarcoCronologia {
  nome: string
  data: string | null
}

export interface DashboardEventoCronologia {
  data: string
  statusAnterior: string | null
  statusNovo: string | null
}

export interface DashboardCronologiaLaudo {
  laudo: DashboardLaudoConsulta
  marcos: DashboardMarcoCronologia[]
  transicoes: DashboardEventoCronologia[]
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
