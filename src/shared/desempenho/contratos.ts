export type PerfilCapturaLogs = 'importante' | 'critico' | 'detalhado';

export type OrigemDesempenho = 'renderer' | 'main' | 'ipc' | 'placeholder' | 'ilustracao' | 'processo';
export type SeveridadeDesempenho = 'info' | 'importante' | 'critico';

export interface MetricasDesempenho {
  cpuPercentual?: number | null;
  memoriaKb?: number | null;
  heapUsado?: number | null;
  heapLimite?: number | null;
  atrasoEventLoopMs?: number | null;
  longTasks?: number | null;
  longTaskMaximaMs?: number | null;
  nosDom?: number | null;
  tabelas?: number | null;
  celulas?: number | null;
  imagens?: number | null;
}

export interface AmostraDesempenho {
  id: string;
  sessaoId: string;
  timestamp: string;
  perfil: PerfilCapturaLogs;
  severidade: SeveridadeDesempenho;
  origem: OrigemDesempenho;
  categoria: string;
  evento: string;
  operacao?: string | null;
  canal?: string | null;
  duracaoMs?: number | null;
  contextoId?: string | null;
  metricas: MetricasDesempenho;
  metadados: Record<string, number | boolean | null>;
  resumoIpc?: ResumoIpcDesempenho[];
}

export interface ResumoIpcDesempenho {
  canal: string;
  quantidade: number;
  falhas: number;
  duracaoMaximaMs: number;
  duracaoMediaMs: number;
  bytesEntrada: number | null;
  bytesSaida: number | null;
}

export interface SessaoCapturaDesempenho {
  id: string;
  perfil: PerfilCapturaLogs;
  iniciadaEm: string;
  terminaEm: string | null;
  ativa: boolean;
}

export interface EstadoCapturaDesempenho {
  perfil: PerfilCapturaLogs;
  sessao: SessaoCapturaDesempenho | null;
  eventosDescartados: number;
}

export interface EventoDesempenhoEntrada {
  origem: OrigemDesempenho;
  categoria: string;
  evento: string;
  operacao?: string;
  canal?: string;
  duracaoMs?: number;
  contextoId?: string;
  metricas?: MetricasDesempenho;
  metadados?: Record<string, number | boolean | null>;
  resumoIpc?: ResumoIpcDesempenho[];
}
