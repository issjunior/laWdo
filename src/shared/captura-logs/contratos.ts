export const SONDAS_CAPTURA_LOGS = ['sistema', 'auditoria', 'linha_tempo', 'desempenho'] as const;

export type SondaCapturaLogs = typeof SONDAS_CAPTURA_LOGS[number];
export type MotivoEncerramentoCapturaLogs = 'manual' | 'expirada' | 'interrompida';
export type QualidadeCapturaLogs = 'suficiente' | 'parcial' | 'sem_evidencia';
export type NivelCapturaLogs = 'info' | 'aviso' | 'erro' | 'critico';
export type TipoAchadoCapturaLogs = 'sonda_sem_evidencia' | 'erro_detectado' | 'erros_repetidos' | 'operacao_lenta' | 'atraso_event_loop' | 'long_tasks' | 'memoria_crescente';

export interface CapturaLogsAtiva {
  id: string;
  sondas: SondaCapturaLogs[];
  iniciadaEm: string;
  terminaEm: string;
}

export interface EstadoCapturaLogs {
  ativa: CapturaLogsAtiva | null;
}

export interface EventoCapturaLogs {
  timestamp: string;
  sonda: SondaCapturaLogs | 'marcador';
  codigo: string;
  nivel: NivelCapturaLogs;
  dados: Record<string, string | number | boolean | null>;
}

export interface CoberturaSondaCapturaLogs {
  sonda: SondaCapturaLogs;
  quantidadeEventos: number;
  quantidadeAvisos: number;
  quantidadeErros: number;
  possuiEvidencia: boolean;
}

export interface ContagemCodigoCapturaLogs {
  codigo: string;
  quantidade: number;
}

export interface EstatisticaMetricaCapturaLogs {
  metrica: string;
  quantidade: number;
  minimo: number;
  maximo: number;
  media: number;
  p95: number;
}

export interface MarcadorCapturaLogs {
  codigo: string;
  timestamp: string;
}

export interface AchadoCapturaLogs {
  tipo: TipoAchadoCapturaLogs;
  codigo: string;
  nivel: NivelCapturaLogs;
  ocorrencias: number;
  dados: Record<string, string | number | boolean | null>;
}

export interface ResumoAnaliticoCapturaLogs {
  duracaoMs: number;
  quantidadeEventosUteis: number;
  marcadores: MarcadorCapturaLogs[];
  coberturaSondas: CoberturaSondaCapturaLogs[];
  eventosPorCodigo: ContagemCodigoCapturaLogs[];
  metricas: EstatisticaMetricaCapturaLogs[];
  achados: AchadoCapturaLogs[];
}

export interface ResumoCapturaLogs {
  id: string;
  sondas: SondaCapturaLogs[];
  iniciadaEm: string;
  finalizadaEm: string;
  motivoEncerramento: MotivoEncerramentoCapturaLogs;
  quantidadeEventos: number;
  eventosDescartados: number;
  qualidade: QualidadeCapturaLogs;
  coberturaSondas: CoberturaSondaCapturaLogs[];
}

export interface CapturaLogsConcluida extends ResumoCapturaLogs {
  versaoFormato: 2;
  resumo: ResumoAnaliticoCapturaLogs;
  eventos: EventoCapturaLogs[];
}
