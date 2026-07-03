export interface DashboardKpiStatus {
  status: string
  total: number
}

export interface DashboardAlertaPrazo {
  tipo: 'proximo' | 'vencido'
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
  laudosPorStatus: DashboardKpiStatus[]
  tempoMedioPorTipoExame: DashboardTempoMedioTipoExame[]
  laudosRecentes: DashboardLaudoRecente[]
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
