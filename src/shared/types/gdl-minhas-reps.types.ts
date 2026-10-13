export type StatusMinhaRepGdl = 'Aberta e Distribuída' | 'Laudo em Execução' | 'Concluída e Não Remetida';

export interface MinhaRepGdl {
  idGdl: number;
  numero: string;
  ano: string;
  naturezaExame: string;
  naturezaExameComCodigo: string | null;
  status: StatusMinhaRepGdl;
  dataDesignacao: string | null;
  quantidadeFotos: number | null;
  naturezaConfirmada?: boolean;
  naturezaDivergente?: boolean;
  naturezaConsultadaEm?: string;
  statusNecessitaAtualizacao?: boolean;
}

export interface PaginaMinhasRepsGdl {
  reps: MinhaRepGdl[];
  listagemId: string;
  paginaAtual: number;
  temAnterior: boolean;
  temProxima: boolean;
}

export interface SnapshotMinhasRepsGdl {
  reps: MinhaRepGdl[];
  atualizadoEm: string;
}

export const codigosFalhaListaRepsGdl = [
  'desativada',
  'credenciais', 'autenticacao', 'rede', 'tempo_esgotado', 'limite_gdl', 'servidor',
  'sessao', 'estrutura', 'detalhes_reps', 'lista_inconsistente',
  'cache_local', 'inesperado',
] as const;

export type CodigoFalhaListaRepsGdl = typeof codigosFalhaListaRepsGdl[number];

export interface FalhaListaRepsGdl {
  codigo: CodigoFalhaListaRepsGdl;
  detalhes: string;
  referencia: string;
}
