import { createHash, randomUUID } from 'node:crypto';
import { session, type Session } from 'electron';

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
  autenticando?: Promise<void>;
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
  if (metodo !== 'GET') return false;
  if (caminho === `${prefixo}default.aspx`) return !url.search;
  return caminho === `${prefixo}rep/default.aspx` && /^\?rep_id=[1-9]\d*$/.test(url.search);
}

export function paginaGdlExigeLogin(html: string): boolean {
  return /(?:location(?:\.href)?\s*=\s*|location\.(?:replace|assign)\s*\(\s*)["'][^"']*\/Account\/Login\.aspx/i.test(html)
    || /<input\b[^>]*id=["']Content_txtPass["']/i.test(html);
}

async function lerPagina(rede: Session, url: string, corpo?: string) {
  const resposta = await rede.fetch(url, {
    method: corpo === undefined ? 'GET' : 'POST',
    redirect: 'follow', credentials: 'include', cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    headers: corpo === undefined ? { Accept: 'text/html' } : { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    ...(corpo === undefined ? {} : { body: corpo }),
  });
  const charset = resposta.headers.get('content-type')?.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1] ?? 'utf-8';
  const data = new TextDecoder(charset).decode(await resposta.arrayBuffer());
  return { statusCode: resposta.status, data, redirecionado: resposta.redirected,
    paginaAutenticacao: Boolean(resposta.url && /\/Account\/Login\.aspx/i.test(new URL(resposta.url).pathname)) || paginaGdlExigeLogin(data) };
}

export async function consultarPaginaRepGdl(credenciais: CredenciaisPaginaGdl, codRep: number, prepararRede: (rede: Session) => void) {
  if (!Number.isSafeInteger(codRep) || codRep <= 0) throw new Error('Identificador de REP inválido.');
  const base = credenciais.baseUrl.replace(/\/api$/i, '');
  const assinatura = createHash('sha256').update(JSON.stringify(credenciais)).digest('hex');
  let estado = sessoes.get(base);
  if (!estado || estado.assinatura !== assinatura) {
    if (estado) await estado.rede.clearStorageData({ storages: ['cookies'] });
    const rede = session.fromPartition(`gdl-web-${randomUUID()}`, { cache: false });
    prepararRede(rede);
    rede.webRequest.onBeforeRequest((requisicao, callback) => {
      callback({ cancel: !destinoPaginaGdlPermitido(base, requisicao.url, requisicao.method) });
    });
    estado = { assinatura, rede, autenticada: false, tentarApos: 0 };
    sessoes.set(base, estado);
  }
  const atual = estado;
  if (Date.now() < atual.tentarApos) throw new Error('Autenticação web indisponível; aguarde um minuto antes de tentar novamente.');
  if (!atual.autenticada) {
    if (!atual.autenticando) {
      atual.autenticando = (async () => {
        let etapa = 'carregar_formulario';
        try {
          const urlLogin = `${base}/Account/Login.aspx`;
          const formulario = await lerPagina(atual.rede, urlLogin);
          if (formulario.statusCode !== 200) throw new Error('Página de autenticação indisponível.');
          etapa = 'validar_formulario';
          const corpo = montarFormularioLoginGdl(formulario.data, urlLogin, credenciais.login, credenciais.senha);
          etapa = 'submeter_login';
          const resultado = await lerPagina(atual.rede, urlLogin, corpo);
          etapa = `validar_login_http_${resultado.statusCode}`;
          if (resultado.statusCode !== 200 || resultado.paginaAutenticacao) throw new Error('Login web não concluído; verifique credenciais ou exigências adicionais no GDL.');
          atual.autenticada = true;
        } catch {
          atual.tentarApos = Date.now() + 60000;
          throw new Error(`Não foi possível autenticar a sessão web do GDL (${etapa}). A consulta pela API foi preservada.`);
        } finally {
          atual.autenticando = undefined;
        }
      })();
    }
    await atual.autenticando;
  }
  const resposta = await lerPagina(atual.rede, `${base}/REP/Default.aspx?rep_id=${codRep}`);
  if (resposta.paginaAutenticacao || [401, 403].includes(resposta.statusCode)) atual.autenticada = false;
  return resposta;
}
