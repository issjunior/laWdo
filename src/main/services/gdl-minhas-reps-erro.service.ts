import type { CodigoFalhaListaRepsGdl } from '../../shared/types/gdl-minhas-reps.types.js';

interface ClassificacaoFalhaListaRepsGdl {
  codigo: CodigoFalhaListaRepsGdl;
  etapa: string;
  detalhes: string;
  codigoSistema?: string;
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
  const mensagem = erro instanceof Error ? erro.message : '';
  const tipoErro = erro instanceof Error ? erro.name : 'Erro desconhecido';
  const codigoSistema = obterPropriedadeTexto(erro, 'code');
  let codigo: CodigoFalhaListaRepsGdl = 'inesperado';
  let etapa = 'consulta_lista';

  if (/^(?:EACCES|EPERM|ENOSPC|EROFS|EMFILE)$/.test(codigoSistema ?? '')) {
    codigo = 'cache_local';
    etapa = 'salvar_cache';
  } else if (mensagem === 'Credenciais não configuradas.') {
    codigo = 'credenciais';
    etapa = 'configuracao';
  } else if (/Timeout|timed?\s*out|AbortError|tempo.*esgot|HTTP (?:408|504)\b/i.test(`${tipoErro} ${mensagem}`)) {
    codigo = 'tempo_esgotado';
    etapa = 'rede_gdl';
  } else if (/HTTP 429\b/.test(mensagem)) {
    codigo = 'limite_gdl';
    etapa = 'rede_gdl';
  } else if (/ERR_|fetch failed|Failed to fetch|ENOTFOUND|ECONN|EAI_AGAIN|network/i.test(`${codigoSistema ?? ''} ${mensagem}`)) {
    codigo = 'rede';
    etapa = 'rede_gdl';
  } else if (/validar_formulario|Formulário de autenticação web.*não reconhecido|Campos de autenticação web.*não reconhecidos/i.test(mensagem)) {
    codigo = 'estrutura';
    etapa = 'formulario_login';
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

  const detalhes = codigo === 'inesperado'
    ? `Falha inesperada (${tipoErro}${codigoSistema ? `, ${codigoSistema}` : ''}).`
    : codigo === 'cache_local' ? `Falha ao salvar a lista neste computador (${codigoSistema}).`
      : limparDetalhes(mensagem || `Falha em ${etapa}${codigoSistema ? ` (${codigoSistema})` : ''}.`);
  return { codigo, etapa, detalhes, codigoSistema, tipoErro };
}
