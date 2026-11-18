import type { AnaliseBkpLaudo, PacoteLaudo, PreviaBkpLaudo } from './laudo-bkp.types.js';

export interface RespostaGoogleDrive<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface EstadoGoogleDrive {
  conectado: boolean;
  email?: string;
  caminho?: string;
  usoBytes?: number;
  limiteBytes?: number;
  backupsBytes?: number;
  limiteBackupsBytes?: number;
  backupsDisponiveisBytes?: number;
  percentualBackups?: number;
  ultimoEnvioEm?: string;
  envioAutomatico: boolean;
  pendencias: number;
  falhaFila?: string;
  filaAguardaCorrecao?: boolean;
  filaAguardaEspaco?: boolean;
  protecaoChave?: 'protegida' | 'aguardando_primeiro_envio' | 'migracao_pendente' | 'reconexao_necessaria' | 'indisponivel';
  aviso?: string;
}

export interface CopiaGoogleDrive {
  id: string;
  laudoId: string;
  numeroRep: string;
  nome: string;
  tamanho: number;
  modificadaEm: string;
  revisao: string;
  verificadaEm?: string;
}

export interface ResumoGoogleDrive {
  estado: EstadoGoogleDrive;
  copias: CopiaGoogleDrive[];
  atualizadoEm?: string;
  origem: 'drive' | 'cache';
  desatualizado?: boolean;
}

export interface LaudoElegivelGoogleDrive {
  id: string;
  numeroRep: string;
  concluidoEm: string;
}

export interface PreviaRestauracaoGoogleDrive extends AnaliseBkpLaudo {
  copiaId: string;
  revisao: string;
}

export interface VisualizacaoGoogleDrive {
  cacheId: string;
  html: string;
  titulo: string;
  contexto: Pick<PacoteLaudo, 'rep' | 'tipoExame' | 'solicitante' | 'placeholders'>;
  apresentacaoJson?: string;
}

export interface ProgressoVerificacaoGoogleDrive {
  operacaoId: string;
  recebidos: number;
  total?: number;
}

export interface ApiGoogleDrive {
  estadoRapido: () => Promise<RespostaGoogleDrive<EstadoGoogleDrive>>;
  estado: () => Promise<RespostaGoogleDrive<EstadoGoogleDrive>>;
  resumoCache: () => Promise<RespostaGoogleDrive<ResumoGoogleDrive | null>>;
  resumo: (forcarAtualizacao?: boolean) => Promise<RespostaGoogleDrive<ResumoGoogleDrive>>;
  conectar: () => Promise<RespostaGoogleDrive<EstadoGoogleDrive>>;
  desconectar: () => Promise<RespostaGoogleDrive>;
  definirEnvioAutomatico: (ativo: boolean) => Promise<RespostaGoogleDrive<EstadoGoogleDrive>>;
  listarCopias: () => Promise<RespostaGoogleDrive<CopiaGoogleDrive[]>>;
  listarLaudosConcluidos: () => Promise<RespostaGoogleDrive<LaudoElegivelGoogleDrive[]>>;
  enviarLaudo: (laudoId: string, confirmarSubstituicao: boolean) => Promise<RespostaGoogleDrive>;
  verificar: (copiaId: string, operacaoId: string) => Promise<RespostaGoogleDrive<{ previa: PreviaBkpLaudo }>>;
  cancelarVerificacao: (operacaoId: string) => Promise<RespostaGoogleDrive>;
  onProgressoVerificacao: (callback: (progresso: ProgressoVerificacaoGoogleDrive) => void) => () => void;
  prepararVisualizacao: (copiaId: string) => Promise<RespostaGoogleDrive<VisualizacaoGoogleDrive>>;
  analisarRestauracao: (copiaId: string) => Promise<RespostaGoogleDrive<PreviaRestauracaoGoogleDrive>>;
  confirmarRestauracao: (operacaoId: string, confirmarSubstituicao: boolean) => Promise<RespostaGoogleDrive<{ laudoId: string }>>;
  cancelarRestauracao: (operacaoId: string) => Promise<RespostaGoogleDrive>;
  moverParaLixeira: (copiaId: string, revisao: string) => Promise<RespostaGoogleDrive>;
}
