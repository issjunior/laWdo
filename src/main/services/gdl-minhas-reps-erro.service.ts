import { codigosSistemaFalhaGdl, etapasFalhaListaRepsGdl } from '../../shared/types/gdl-minhas-reps.types.js';
import type { CodigoFalhaListaRepsGdl, CodigoSistemaFalhaGdl, EtapaFalhaListaRepsGdl } from '../../shared/types/gdl-minhas-reps.types.js';

interface ClassificacaoFalhaListaRepsGdl {
  codigo: CodigoFalhaListaRepsGdl;
  etapa: EtapaFalhaListaRepsGdl;
  detalhes: string;
  codigoSistema?: CodigoSistemaFalhaGdl;
  statusHttp?: number;
  bloqueioTemporario?: boolean;
  tentarNovamenteEmSegundos?: number;
  tipoErro: string;
}

function obterPropriedadeTexto(erro: unknown, propriedade: string): string | undefined {
  if (!erro || typeof erro !== 'object' || !(propriedade in erro)) return undefined;
  const valor = Reflect.get(erro, propriedade) as unknown;
  return typeof valor === 'string' ? valor : undefined;
}

function limparDetalhes(mensagem: string): string {
  return mensagem
    .replace(/https?:\/\/\S+/gi, '[endereço omitido]')
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, '[autenticação omitida]')
    .replace(/(?:senha|password|token)\s*[:=]\s*\S+/gi, '[credencial omitida]')
    .slice(0, 240);
}

export function classificarFalhaListaRepsGdl(erro: unknown): ClassificacaoFalhaListaRepsGdl {
  const causas: unknown[] = [];
  const visitados = new Set<unknown>();
  let causa: unknown = erro;
  while (causa && typeof causa === 'object' && !visitados.has(causa) && causas.length < 8) {
    causas.push(causa);
    visitados.add(causa);
    causa = 'cause' in causa ? causa.cause : undefined;
  }
  const mensagens = causas.map(item => obterPropriedadeTexto(item, 'message') ?? '');
  const mensagem = mensagens.join(' ');
  const tipoErro = erro instanceof Error && ['Error', 'TypeError', 'TimeoutError', 'AbortError'].includes(erro.name) ? erro.name : 'Erro desconhecido';
  const codigoSistema = codigosSistemaFalhaGdl.find(codigo => causas.some(item => obterPropriedadeTexto(item, 'code') === codigo)
    || mensagens.some(texto => new RegExp(`\\b${codigo}\\b`).test(texto)));
  const obterNumero = (propriedade: string): number | undefined => {
    for (const item of causas) {
      if (item && typeof item === 'object' && propriedade in item) {
        const valor: unknown = Reflect.get(item, propriedade);
        if (typeof valor === 'number' && Number.isSafeInteger(valor)) return valor;
      }
    }
    return undefined;
  };
  const http = obterNumero('statusHttp') ?? Number(mensagem.match(/HTTP[ _](\d{3})\b/i)?.[1]);
  const statusHttp = http >= 100 && http <= 599 ? http : undefined;
  const segundos = obterNumero('tentarNovamenteEmSegundos');
  const tentarNovamenteEmSegundos = segundos !== undefined && segundos > 0 && segundos <= 60 ? segundos : undefined;
  const etapaOriginal = etapasFalhaListaRepsGdl.find(etapa => causas.some(item => obterPropriedadeTexto(item, 'etapa') === etapa));
  const falhaTransporte = /fetch failed|Failed to fetch|network|ERR_/i.test(mensagem) || causas.some(item => /^(?:connect|getaddrinfo)$/.test(obterPropriedadeTexto(item, 'syscall') ?? ''));
  let codigo: CodigoFalhaListaRepsGdl = 'inesperado';
  let etapa: EtapaFalhaListaRepsGdl = 'consulta_lista';

  if (/listagem de REPs do GDL está desativada/i.test(mensagem)) {
    codigo = 'desativada';
    etapa = 'preferencia';
  } else if (!falhaTransporte && /^(?:EACCES|EPERM|ENOSPC|EROFS|EMFILE)$/.test(codigoSistema ?? '')) {
    codigo = 'cache_local';
    etapa = 'salvar_cache';
  } else if (/Credenciais(?: do GDL)? não configuradas\./i.test(mensagem)) {
    codigo = 'credenciais';
    etapa = 'configuracao';
  } else if ((codigoSistema && /TIME(?:D_?)?OUT/.test(codigoSistema)) || causas.some(item => /^(?:TimeoutError|AbortError)$/.test(obterPropriedadeTexto(item, 'name') ?? '')) || statusHttp === 408 || statusHttp === 504 || /Timeout|timed?\s*out|AbortError|tempo.*esgot|HTTP (?:408|504)\b/i.test(`${tipoErro} ${mensagem}`)) {
    codigo = 'tempo_esgotado';
    etapa = 'rede_gdl';
  } else if (statusHttp === 429) {
    codigo = 'limite_gdl';
    etapa = 'rede_gdl';
  } else if (codigoSistema || /ERR_|fetch failed|Failed to fetch|ENOTFOUND|ECONN|EAI_AGAIN|network/i.test(`${codigoSistema ?? ''} ${mensagem}`)) {
    codigo = 'rede';
    etapa = 'rede_gdl';
  } else if (statusHttp !== undefined && statusHttp !== 200 && statusHttp !== 401 && statusHttp !== 403) {
    codigo = 'servidor';
    etapa = 'rede_gdl';
  } else if (/validar_formulario|Formulário de autenticação web.*não reconhecido|Campos de autenticação web.*não reconhecidos/i.test(mensagem)) {
    codigo = 'estrutura';
    etapa = 'formulario_login';
  } else if (/nova autenticação|sessão.*expir/i.test(mensagem) && statusHttp !== 401 && statusHttp !== 403) {
    codigo = 'sessao';
    etapa = 'sessao_web';
  } else if (/autentica|login web|página de autenticação|campos de autenticação|HTTP (?:401|403)\b/i.test(mensagem)) {
    codigo = 'autenticacao';
    etapa = 'login_web';
  } else if (/Não foi possível abrir Minhas REPs|sessão de Minhas REPs não está disponível/i.test(mensagem)) {
    codigo = 'servidor';
    etapa = 'abrir_lista';
  } else if (/Não foi possível consultar todos os códigos de exame|Resposta de detalhe indisponível/i.test(mensagem)) {
    codigo = 'detalhes_reps';
    etapa = 'detalhes_reps';
  } else if (/paginação|limite de páginas|códigos de exame não correspondem|configuração do GDL mudou|listagem de REPs foi atualizada/i.test(mensagem)) {
    codigo = 'lista_inconsistente';
    etapa = 'conferir_lista';
  } else if (/sessão da listagem|Abra novamente a lista/i.test(mensagem)) {
    codigo = 'sessao';
    etapa = 'sessao_web';
  } else if (/grade|formulário Minhas REPs|filtro geral|data de designação|quantidade de fotos|formato inesperado/i.test(mensagem)) {
    codigo = 'estrutura';
    etapa = 'interpretar_lista';
  }

  etapa = etapaOriginal ?? etapa;
  const detalhes = codigo === 'inesperado'
    ? `Falha inesperada (${tipoErro}${codigoSistema ? `, ${codigoSistema}` : ''}).`
    : codigo === 'cache_local' ? `Falha ao salvar a lista neste computador (${codigoSistema}).`
      : limparDetalhes(mensagem || `Falha em ${etapa}${codigoSistema ? ` (${codigoSistema})` : ''}.`);
  return { codigo, etapa, detalhes, codigoSistema, tipoErro, statusHttp, bloqueioTemporario: tentarNovamenteEmSegundos ? true : undefined, tentarNovamenteEmSegundos };
}
