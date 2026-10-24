import { atividadeGdlService } from './gdl-atividade.service.js';
import { interpretarDetalhesRepGdl } from './gdl-detalhes.service.js';
import { createHash, randomUUID } from 'node:crypto';
import { session, type Session } from 'electron';
import { interpretarMinhasRepsGdl, montarFormularioMinhasRepsGdl, obterEventoNavegacaoMinhasReps } from './gdl-minhas-reps.service.js';
import { classificarFalhaListaRepsGdl } from './gdl-minhas-reps-erro.service.js';
import type { EtapaFalhaListaRepsGdl } from '../../shared/types/gdl-minhas-reps.types.js';
import type { PaginaMinhasRepsGdl } from '../../shared/types/gdl-minhas-reps.types.js';
import { getLogger } from '../utils/logger.js';

const log = getLogger('gdl');

interface CredenciaisPaginaGdl {
  baseUrl: string;
  login: string;
  senha: string;
  cpfUsuario?: string;
}

interface SessaoPaginaGdl {
  assinatura: string;
  rede: Session;
  autenticada: boolean;
  tentarApos: number;
  ultimaFalha?: ErroAutenticacaoWebGdl;
  autenticando?: Promise<void>;
  paginaMinhasReps?: { numero: number; html: string };
  listagemId?: string;
  detalhesPermitidos: Set<string>;
}

class ErroAutenticacaoWebGdl extends Error {
  constructor(mensagem: string, readonly etapa: EtapaFalhaListaRepsGdl, causa?: unknown,
    readonly statusHttp?: number, readonly tentarNovamenteEmSegundos?: number) {
    super(mensagem, { cause: causa });
  }
}

const sessoes = new Map<string, SessaoPaginaGdl>();

function atributoHtml(tag: string, nome: string): string {
  const valor = tag.match(new RegExp(`\\b${nome}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? '';
  return valor.replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, '&');
}

export function montarFormularioLoginGdl(html: string, urlLogin: string, login: string, senha: string): string {
  const formulario = html.match(/<form\b[^>]*>[\s\S]*?<\/form>/i)?.[0];
  const tag = formulario?.match(/^<form\b[^>]*>/i)?.[0] ?? '';
  if (!formulario || atributoHtml(tag, 'method').toLowerCase() !== 'post'
    || new URL(atributoHtml(tag, 'action'), urlLogin).href !== urlLogin) {
    throw new Error('Formulário de autenticação web do GDL não reconhecido.');
  }
  const corpo = new URLSearchParams();
  const nomes = new Set<string>();
  for (const [entrada] of formulario.matchAll(/<input\b[^>]*>/gi)) {
    const nome = atributoHtml(entrada, 'name');
    nomes.add(nome);
    if (atributoHtml(entrada, 'type').toLowerCase() === 'hidden'
      && /^__(?:EVENTTARGET|EVENTARGUMENT|VIEWSTATE\d*|VIEWSTATEFIELDCOUNT|VIEWSTATEGENERATOR|PREVIOUSPAGE|EVENTVALIDATION)$/.test(nome)) {
      corpo.set(nome, atributoHtml(entrada, 'value'));
    }
    if (nome === 'ctl00$Content$btnLogin' && atributoHtml(entrada, 'type').toLowerCase() === 'submit') {
      corpo.set(nome, atributoHtml(entrada, 'value'));
    }
  }
  if (!corpo.has('__VIEWSTATE') || !corpo.has('__EVENTVALIDATION') || !corpo.has('ctl00$Content$btnLogin')
    || !nomes.has('ctl00$Content$txtUser') || !nomes.has('ctl00$Content$txtPass')) {
    throw new Error('Campos de autenticação web do GDL não reconhecidos.');
  }
  corpo.set('ctl00$Content$txtUser', login);
  corpo.set('ctl00$Content$txtPass', senha);
  return corpo.toString();
}

export function destinoPaginaGdlPermitido(base: string, endereco: string, metodo: string): boolean {
  const raiz = new URL(`${base}/`);
  const url = new URL(endereco);
  if (url.origin !== raiz.origin || url.username || url.password) return false;
  const caminho = url.pathname.toLowerCase();
  const prefixo = raiz.pathname.toLowerCase();
  if (caminho === `${prefixo}account/login.aspx`) return !url.search && ['GET', 'POST'].includes(metodo);
  if (caminho === `${prefixo}rep/minhasreps.aspx`) return !url.search && ['GET', 'POST'].includes(metodo);
  if (metodo !== 'GET') return false;
  if (caminho === `${prefixo}default.aspx`) return !url.search;
  return false;
}

export function paginaGdlExigeLogin(html: string): boolean {
  return /(?:location(?:\.href)?\s*=\s*|location\.(?:replace|assign)\s*\(\s*)["'][^"']*\/Account\/Login\.aspx/i.test(html)
    || /<input\b[^>]*id=["']Content_txtPass["']/i.test(html);
}

async function lerPagina(rede: Session, url: string, corpo?: string, sinal?: AbortSignal, seguirRedirecionamentos = true) {
  await atividadeGdlService.antesDaRequisicao();
  const resposta = await rede.fetch(url, {
    method: corpo === undefined ? 'GET' : 'POST',
    redirect: seguirRedirecionamentos ? 'follow' : 'manual', credentials: 'include', cache: 'no-store',
    signal: sinal ? AbortSignal.any([sinal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: corpo === undefined ? { Accept: 'text/html' } : { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    ...(corpo === undefined ? {} : { body: corpo }),
  });
  const charset = resposta.headers.get('content-type')?.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1] ?? 'utf-8';
  const data = new TextDecoder(charset).decode(await resposta.arrayBuffer());
  return { statusCode: resposta.status, data, redirecionado: resposta.redirected,
    paginaAutenticacao: Boolean(resposta.url && /\/Account\/Login\.aspx/i.test(new URL(resposta.url).pathname)) || paginaGdlExigeLogin(data) };
}

async function obterSessaoAutenticadaGdl(credenciais: CredenciaisPaginaGdl, prepararRede: (rede: Session) => void, finalidade: 'lista' | 'detalhes' = 'lista') {
  const base = credenciais.baseUrl.replace(/\/api$/i, '');
  const assinatura = createHash('sha256').update(JSON.stringify(credenciais)).digest('hex');
  const chaveSessao = `${base}:${finalidade}`;
  let estado = sessoes.get(chaveSessao);
  if (!estado || estado.assinatura !== assinatura) {
    if (estado) await estado.rede.clearStorageData({ storages: ['cookies'] });
    const rede = session.fromPartition(`gdl-web-${randomUUID()}`, { cache: false });
    prepararRede(rede);
    rede.webRequest.onBeforeRequest((requisicao, callback) => {
      callback({ cancel: !destinoPaginaGdlPermitido(base, requisicao.url, requisicao.method) && !(requisicao.method === 'GET' && estado?.detalhesPermitidos.has(requisicao.url)) });
    });
    estado = { assinatura, rede, autenticada: false, tentarApos: 0, detalhesPermitidos: new Set() };
    sessoes.set(chaveSessao, estado);
  }
  const atual = estado;
  if (Date.now() < atual.tentarApos) throw new ErroAutenticacaoWebGdl('Nova tentativa temporariamente bloqueada após a falha anterior.', atual.ultimaFalha?.etapa ?? 'login_web', atual.ultimaFalha, atual.ultimaFalha?.statusHttp, Math.ceil((atual.tentarApos - Date.now()) / 1000));
  if (!atual.autenticada) {
    if (!atual.autenticando) {
      atual.autenticando = (async () => {
        let etapa: EtapaFalhaListaRepsGdl = 'carregar_formulario';
        let statusHttp: number | undefined;
        const inicio = performance.now();
        try {
          const urlLogin = `${base}/Account/Login.aspx`;
          const formulario = await lerPagina(atual.rede, urlLogin);
          statusHttp = formulario.statusCode;
          if (formulario.statusCode !== 200) throw new Error('Página de autenticação indisponível.');
          etapa = 'validar_formulario';
          const corpo = montarFormularioLoginGdl(formulario.data, urlLogin, credenciais.login, credenciais.senha);
          etapa = 'submeter_login';
          statusHttp = undefined;
          const resultado = await lerPagina(atual.rede, urlLogin, corpo);
          etapa = 'validar_login';
          statusHttp = resultado.statusCode;
          if (resultado.statusCode !== 200 || resultado.paginaAutenticacao) throw new Error('Login web não concluído; verifique credenciais ou exigências adicionais no GDL.');
          atual.autenticada = true;
          atual.ultimaFalha = undefined;
          atual.tentarApos = 0;
        } catch (erro: unknown) {
          const falhaOriginal = new ErroAutenticacaoWebGdl(`Não foi possível autenticar a sessão web do GDL (${etapa}). A consulta pela API foi preservada.`, etapa, erro, statusHttp);
          const falha = classificarFalhaListaRepsGdl(falhaOriginal);
          log.warn('Falha na autenticação web de leitura do GDL.', {
            etapa, duracaoMs: Math.round(performance.now() - inicio), codigo: falha.codigo,
            codigoSistema: falha.codigoSistema, statusHttp: falha.statusHttp,
          });
          atual.tentarApos = Date.now() + 60000;
          atual.ultimaFalha = falhaOriginal;
          throw falhaOriginal;
        } finally {
          atual.autenticando = undefined;
        }
      })();
    }
    await atual.autenticando;
  }
  return { base, estado: atual };
}

async function lerPaginaListagem(rede: Session, url: string, etapa: string, corpo?: string) {
  const inicio = performance.now();
  try {
    const resposta = await lerPagina(rede, url, corpo);
    if (resposta.statusCode !== 200 || resposta.paginaAutenticacao) {
      log.warn('Resposta inesperada na listagem de REPs do GDL.', {
        etapa, duracaoMs: Math.round(performance.now() - inicio), statusCode: resposta.statusCode,
      });
    }
    const duracaoMs = Math.round(performance.now() - inicio);
    if (duracaoMs >= 3000) log.warn('Leitura demorada da grade de REPs do GDL.', { etapa, duracaoMs });
    return resposta;
  } catch (erro: unknown) {
    log.warn('Falha na leitura da listagem de REPs do GDL.', {
      etapa, duracaoMs: Math.round(performance.now() - inicio),
      erro: erro instanceof Error ? erro.message : 'Erro inesperado',
    });
    throw erro;
  }
}

export async function listarPaginaMinhasRepsGdl(
  credenciais: CredenciaisPaginaGdl,
  pagina: number,
  prepararRede: (rede: Session) => void,
): Promise<PaginaMinhasRepsGdl> {
  if (!Number.isSafeInteger(pagina) || pagina < 1) throw new Error('Página de REPs inválida.');
  const { base, estado } = await obterSessaoAutenticadaGdl(credenciais, prepararRede);
  const url = `${base}/REP/MinhasReps.aspx`;
  let resposta;
  if (pagina === 1) {
    estado.listagemId = randomUUID();
    estado.paginaMinhasReps = undefined;
    const inicial = await lerPaginaListagem(estado.rede, url, 'grade_inicial');
    if (inicial.statusCode !== 200 || inicial.paginaAutenticacao) {
      estado.autenticada = false;
      throw new Error(inicial.paginaAutenticacao
        ? 'O GDL solicitou nova autenticação ao abrir Minhas REPs.'
        : `Não foi possível abrir Minhas REPs no GDL (HTTP ${inicial.statusCode}).`);
    }
    resposta = await lerPaginaListagem(estado.rede, url, 'grade_filtro', montarFormularioMinhasRepsGdl(inicial.data, url, 'filtrar'));
  } else {
    const anterior = estado.paginaMinhasReps;
    if (!anterior || !estado.listagemId) throw new Error('Abra novamente a lista de REPs para iniciar a paginação.');
    const evento = obterEventoNavegacaoMinhasReps(anterior.html, anterior.numero, pagina);
    resposta = await lerPaginaListagem(estado.rede, url, 'grade_paginacao', montarFormularioMinhasRepsGdl(anterior.html, url, evento));
  }
  if (resposta.statusCode !== 200 || resposta.paginaAutenticacao) {
    estado.autenticada = false;
    estado.paginaMinhasReps = undefined;
    throw new Error(resposta.paginaAutenticacao
      ? 'O GDL solicitou nova autenticação durante a listagem de REPs.'
      : `A sessão de Minhas REPs não está disponível no GDL (HTTP ${resposta.statusCode}).`);
  }
  const resultado = interpretarMinhasRepsGdl(resposta.data, pagina);
  estado.paginaMinhasReps = { numero: pagina, html: resposta.data };
  if (!estado.listagemId) throw new Error('Sessão da listagem de REPs inválida.');
  return { ...resultado, listagemId: estado.listagemId };
}


export async function lerDetalhesRepAutorizadaGdl(
  credenciais: CredenciaisPaginaGdl, id: number, numero: string, ano: string,
  prepararRede: (rede: Session) => void, validarContexto: () => Promise<void>, sinal: AbortSignal,
) {
  await validarContexto();
  if (sinal.aborted) throw new Error('Consulta substituída.');
  const { base, estado } = await obterSessaoAutenticadaGdl(credenciais, prepararRede, 'detalhes');
  await validarContexto();
  if (sinal.aborted) throw new Error('Consulta substituída.');
  const url = `${base}/REP/Default.aspx?rep_id=${id}`;
  // A sessão permite somente esta URL durante a leitura individual autorizada.
  if (estado.detalhesPermitidos.has(url)) throw new Error('Uma leitura detalhada desta REP já está em andamento.');
  estado.detalhesPermitidos.add(url);
  try {
    const resposta = await lerPagina(estado.rede, url, undefined, sinal, false);
    if (resposta.statusCode !== 200 || resposta.paginaAutenticacao) throw new Error('A leitura dos detalhes não foi concluída. A API foi preservada.');
    await validarContexto();
    return interpretarDetalhesRepGdl(resposta.data, id, numero, ano);
  } finally { estado.detalhesPermitidos.delete(url); }
}
