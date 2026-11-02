export const MENSAGEM_ACESSO_REDE_GDL = 'O GDL não está acessível. É necessário estar conectado à rede da Polícia Científica do Paraná ou utilizar uma VPN autorizada com acesso a essa rede.';

const codigosIndisponibilidade = new Set([
  'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE',
  'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET',
  'ERR_CONNECTION_REFUSED', 'ERR_CONNECTION_RESET', 'ERR_CONNECTION_CLOSED', 'ERR_CONNECTION_ABORTED',
  'ERR_CONNECTION_TIMED_OUT', 'ERR_NAME_NOT_RESOLVED', 'ERR_INTERNET_DISCONNECTED', 'ERR_NETWORK_CHANGED',
  'ERR_ADDRESS_UNREACHABLE', 'ERR_PROXY_CONNECTION_FAILED', 'ERR_TUNNEL_CONNECTION_FAILED', 'ERR_TIMED_OUT',
]);

export function acessoInstitucionalIndisponivel(dados: { codigoSistema?: string; statusHttp?: number; respostaRecebida?: boolean }): boolean {
  return dados.statusHttp === undefined && dados.respostaRecebida !== true && codigosIndisponibilidade.has(dados.codigoSistema ?? '');
}
