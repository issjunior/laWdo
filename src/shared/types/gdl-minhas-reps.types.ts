export type StatusMinhaRepGdl = 'Aberta e Distribuída' | 'Laudo em Execução' | 'Concluída e Não Remetida';

export interface MinhaRepGdl {
  oficioReiterando?: boolean;
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

export const etapasFalhaListaRepsGdl = [
  'consulta_lista', 'preferencia', 'salvar_cache', 'configuracao', 'rede_gdl',
  'formulario_login', 'login_web', 'abrir_lista', 'detalhes_reps', 'conferir_lista',
  'sessao_web', 'interpretar_lista', 'carregar_formulario', 'validar_formulario',
  'submeter_login', 'validar_login',
] as const;
export type EtapaFalhaListaRepsGdl = typeof etapasFalhaListaRepsGdl[number];

export const codigosSistemaFalhaGdl = [
  'EACCES', 'EPERM', 'ENOSPC', 'EROFS', 'EMFILE', 'ENOTFOUND', 'ECONNREFUSED',
  'ECONNRESET', 'ECONNABORTED', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE',
  'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET',
  'ERR_CONNECTION_REFUSED', 'ERR_CONNECTION_RESET', 'ERR_CONNECTION_CLOSED',
  'ERR_CONNECTION_ABORTED', 'ERR_CONNECTION_TIMED_OUT', 'ERR_NAME_NOT_RESOLVED',
  'ERR_INTERNET_DISCONNECTED', 'ERR_NETWORK_CHANGED', 'ERR_ADDRESS_UNREACHABLE',
  'ERR_PROXY_CONNECTION_FAILED', 'ERR_TUNNEL_CONNECTION_FAILED', 'ERR_TIMED_OUT',
  'ERR_CERT_AUTHORITY_INVALID', 'ERR_CERT_DATE_INVALID', 'ERR_SSL_PROTOCOL_ERROR',
] as const;
export type CodigoSistemaFalhaGdl = typeof codigosSistemaFalhaGdl[number];

export interface FalhaListaRepsGdl {
  codigo: CodigoFalhaListaRepsGdl;
  detalhes: string;
  referencia: string;
  etapa?: EtapaFalhaListaRepsGdl;
  codigoSistema?: CodigoSistemaFalhaGdl;
  statusHttp?: number;
  bloqueioTemporario?: boolean;
  tentarNovamenteEmSegundos?: number;
}
