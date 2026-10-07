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
}

export interface PaginaMinhasRepsGdl {
  reps: MinhaRepGdl[];
  listagemId: string;
  paginaAtual: number;
  temAnterior: boolean;
  temProxima: boolean;
}

export interface NaturezaMinhaRepGdl {
  idGdl: number;
  naturezaExameComCodigo: string | null;
}

export interface SnapshotMinhasRepsGdl {
  reps: MinhaRepGdl[];
  atualizadoEm: string;
}

export const codigosFalhaListaRepsGdl = [
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
