import { app, shell } from 'electron';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { configuracaoService } from './configuracao.service.js';
import { exportarBkpLaudo, lerBkpLaudo } from './laudo-bkp.service.js';
import { cifrarPacoteGoogleDrive, criarChavePacoteGoogleDrive, decifrarPacoteGoogleDrive } from './google-drive-pacote.service.js';
import { obterIdentificacaoBkpLaudo } from '../../shared/utils/nomes-documentos-rep.js';
import { executeNonQuery, executeQuery, withTransaction } from '../database/sqlite.js';
import { getLogger } from '../utils/logger.js';
import { safeStorageService } from './safe-storage.service.js';
import { CLIENT_ID_GOOGLE_DRIVE, obterSegredoClienteGoogleDrive } from './google-drive-oauth.service.js';
import type { PacoteLaudo } from '../../shared/types/laudo-bkp.types.js';
import type { CopiaGoogleDrive, EstadoGoogleDrive, LaudoElegivelGoogleDrive, ResumoGoogleDrive } from '../../shared/types/google-drive.types.js';

const CLIENT_ID = CLIENT_ID_GOOGLE_DRIVE;
const ESCOPO_DRIVE_ARQUIVOS = 'https://www.googleapis.com/auth/drive.file';
const ESCOPO_DADOS_APP = 'https://www.googleapis.com/auth/drive.appdata';
const ESCOPO = `openid email profile ${ESCOPO_DRIVE_ARQUIVOS} ${ESCOPO_DADOS_APP}`;
const MIME_PASTA = 'application/vnd.google-apps.folder';
const DOMINIO_INSTITUCIONAL = 'policiacientifica.pr.gov.br';
const VERSAO_VALIDACAO_FILA = 2;
const DURACAO_CACHE_RESUMO_MS = 5 * 60 * 1000;
const LIMITE_BACKUPS_BYTES = 10 * 1024 ** 3;
const TEMPO_LIMITE_REQUISICAO_MS = 45_000;
const MARGEM_RENOVACAO_TOKEN_MS = 90_000;
const TEMPO_LIMITE_INATIVIDADE_DOWNLOAD_MS = 90_000;
const TAMANHO_BLOCO_UPLOAD = 8 * 1024 * 1024;
const TENTATIVAS_RECUPERACAO_UPLOAD = 3;
const ESPERA_PADRAO_RECUPERACAO_MS = 1_000;
const ESPERA_MAXIMA_RECUPERACAO_MS = 30_000;
const CHAVES_PUBLICAS_GOOGLE = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

interface Tokens { access_token: string; refresh_token?: string; expires_at: number; escopos?: string[] }
interface ArquivoDrive { id: string; name: string; mimeType?: string; modifiedTime?: string; size?: string; version?: string; appProperties?: Record<string, string>; parents?: string[] }
interface CopiaGoogleDriveLocalizada extends CopiaGoogleDrive { versaoDrive: string }
interface ControleGoogleDrive { formato: 1; chave: string }
interface ItemFilaGoogleDrive {
  laudoId: string;
  contaGoogle: string;
  enfileiradoEm: string;
  tentativas: number;
  ultimoErro?: string;
  estado?: 'pendente' | 'aguardando_correcao';
  versaoValidacao?: number;
  motivoEspera?: 'conteudo' | 'cota';
}
interface RevisoesGoogleDrive { [laudoId: string]: string }
interface VerificacoesGoogleDrive { [revisao: string]: string }
interface CacheResumoGoogleDrive {
  versao: 1;
  email: string;
  atualizadoEm: string;
  estado: EstadoGoogleDrive;
  copias: CopiaGoogleDrive[];
}
type RegistradorDiagnosticoGoogleDrive = (dados: {
  evento: 'envio_automatico_falhou';
  etapa: EtapaDiagnosticoGoogleDrive | 'desconhecida';
  codigo: string;
  tentativa: number;
}) => void;
export type EtapaDiagnosticoGoogleDrive = 'renovar_token' | 'trocar_codigo_oauth' | 'perfil_conta' | 'validar_conta_institucional' | 'localizar_raiz_drive' | 'criar_raiz_drive' | 'consultar_cota' | 'criar_pacote' | 'enviar_pacote' | 'verificar_pacote' | 'autorizar_dados_privados' | 'migrar_chave' | 'verificar_cota';

export class ErroGoogleDrive extends Error {
  constructor(public readonly etapa: EtapaDiagnosticoGoogleDrive, mensagem: string, public readonly codigo?: string) {
    super(mensagem);
    this.name = 'ErroGoogleDrive';
  }
}

const log = getLogger('backup');

function chave(tipo: string, usuarioId: string) { return `google_drive_${tipo}_${usuarioId}`; }
function base64Url(valor: Buffer) { return valor.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function escaparConsultaDrive(valor: string) { return valor.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function nomePastaLaudo(numero: string) { return numero.replace(/[\\/:*?"<>|]/g, '-').trim() || 'sem-numero'; }
function temEscopoDadosApp(tokens: Tokens): boolean { return tokens.escopos?.includes(ESCOPO_DADOS_APP) ?? false; }
function escoposAutorizados(valor: unknown): string[] {
  return typeof valor === 'string' ? valor.split(/\s+/).filter(Boolean) : [];
}
function temEscoposObrigatorios(escopos: string[]): boolean {
  return escopos.includes(ESCOPO_DRIVE_ARQUIVOS) && escopos.includes(ESCOPO_DADOS_APP);
}
async function hashArquivo(caminho: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const parte of createReadStream(caminho)) hash.update(parte);
  return hash.digest('hex');
}

function codigoErroOAuth(dados: unknown, status: number): string {
  const codigosPermitidos = ['invalid_request', 'invalid_client', 'invalid_grant', 'unauthorized_client', 'unsupported_grant_type', 'invalid_scope', 'access_denied', 'admin_policy_enforced'];
  const codigo = dados && typeof dados === 'object' && 'error' in dados ? dados.error : undefined;
  if (typeof codigo !== 'string' || !codigosPermitidos.includes(codigo)) return `http_${status}`;
  const descricao = dados && typeof dados === 'object' && 'error_description' in dados && typeof dados.error_description === 'string'
    ? dados.error_description : '';
  const motivos: Array<[RegExp, string]> = [
    [/client[_ ]secret/i, 'client_secret_rejeitado'],
    [/code[_ ]verifier/i, 'code_verifier_rejeitado'],
    [/redirect[_ ]uri/i, 'redirect_uri_rejeitado'],
    [/client[_ ]id/i, 'client_id_rejeitado'],
    [/grant[_ ]type/i, 'grant_type_rejeitado'],
    [/(?:missing|required|not provided)[^\n]{0,80}(?:authorization )?code\b/i, 'codigo_autorizacao_ausente'],
  ];
  const motivo = motivos.find(([padrao]) => padrao.test(descricao))?.[1];
  return motivo ? `${codigo}_${motivo}` : codigo;
}

async function obterLogoRetornoOAuth(): Promise<string | null> {
  const candidatos = app.isPackaged
    ? [path.join(process.resourcesPath, 'assets', 'icone-linux.png')]
    : [path.join(app.getAppPath(), 'src', 'renderer', 'assets', 'logo.png')];
  for (const candidato of candidatos) {
    try { return `data:image/png;base64,${(await readFile(candidato)).toString('base64')}`; }
    catch { /* Tenta o próximo caminho de distribuição. */ }
  }
  return null;
}

function paginaRetornoOAuth(logo: string | null, sucesso: boolean): string {
  const titulo = sucesso ? 'Autorização recebida' : 'Não foi possível concluir a autorização';
  const mensagem = sucesso
    ? 'O laWdo recebeu a resposta do Google e está concluindo a conexão. Confira o resultado no aplicativo.'
    : 'Volte ao laWdo e tente conectar a conta novamente.';
  const marca = logo ? `<img src="${logo}" alt="laWdo" class="logo">` : '<span class="marca-texto">laWdo</span>';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo} · laWdo</title><style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; } body { margin:0; min-height:100vh; display:grid; place-items:center; overflow:hidden; padding:24px; color:#16213f; background:radial-gradient(circle at 15% 12%,#dbeafe 0,transparent 34%),radial-gradient(circle at 85% 85%,#e0e7ff 0,transparent 36%),linear-gradient(135deg,#e2e8f0,#eef2ff 52%,#dbeafe); position:relative; }
    body::before { content:""; position:fixed; inset:0; pointer-events:none; opacity:.24; background-image:linear-gradient(rgba(75,85,99,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(75,85,99,.18) 1px,transparent 1px); background-size:10px 10px; mask-image:radial-gradient(ellipse at center,black,transparent 72%); }
    .cartao { position:relative; z-index:1; width:min(100%,560px); padding:42px 44px; text-align:center; background:rgba(255,255,255,.86); border:1px solid rgba(37,99,235,.16); border-radius:24px; box-shadow:0 22px 52px rgba(30,64,175,.16); backdrop-filter:blur(14px); }
    .logo { width:min(280px,100%); height:auto; margin:0 auto 30px; display:block; } .marca-texto { display:block; margin-bottom:30px; font-size:40px; font-weight:800; letter-spacing:-2px; color:#1d4ed8; }
    .sucesso { width:56px; height:56px; border-radius:999px; margin:0 auto 18px; display:grid; place-items:center; color:#fff; background:#16a34a; box-shadow:0 10px 24px rgba(22,163,74,.25); font-size:31px; font-weight:700; }
    .erro { background:#dc2626; box-shadow:0 10px 24px rgba(220,38,38,.22); } h1 { margin:0 0 12px; font-size:26px; line-height:1.25; letter-spacing:-.5px; } p { margin:0 auto; max-width:430px; color:#475569; font-size:16px; line-height:1.6; } .aviso { margin-top:28px; padding:14px 16px; border-radius:12px; background:#eff6ff; color:#1e40af; font-size:14px; line-height:1.45; } .acoes { margin-top:20px; display:flex; justify-content:center; } .fechar { border:0; border-radius:10px; padding:11px 22px; color:#fff; background:#1d4ed8; font:600 14px inherit; cursor:pointer; box-shadow:0 8px 18px rgba(29,78,216,.22); } .fechar:hover { background:#1e40af; } .fechar:focus-visible { outline:3px solid rgba(59,130,246,.35); outline-offset:3px; } .rodape { margin-top:22px; color:#64748b; font-size:13px; }
  </style></head><body><main class="cartao">${marca}<div class="sucesso ${sucesso ? '' : 'erro'}" aria-hidden="true">${sucesso ? '✓' : '!'}</div><h1>${titulo}</h1><p>${mensagem}</p><div class="aviso">Você já pode fechar esta aba e retornar ao aplicativo.</div><div class="acoes"><button class="fechar" type="button" onclick="window.close()">Fechar aba</button></div><div class="rodape">laWdo · Polícia Científica do Paraná</div></main></body></html>`;
}

class GoogleDriveService {
  private readonly processamentosFila = new Map<string, Promise<void>>();
  private readonly temporizadoresFila = new Map<string, NodeJS.Timeout>();
  private readonly conexoesEmAndamento = new Map<string, Promise<EstadoGoogleDrive>>();
  private readonly renovacoesTokens = new Map<string, Promise<string>>();
  private readonly versoesConexao = new Map<string, number>();
  private readonly tokensTemporarios = new Map<string, { versao: number; tokens: Tokens }>();
  private registradorDiagnostico?: RegistradorDiagnosticoGoogleDrive;

  configurarRegistradorDiagnostico(registrador?: RegistradorDiagnosticoGoogleDrive): void {
    this.registradorDiagnostico = registrador;
  }

  private async obterTokens(usuarioId: string): Promise<Tokens | null> {
    if (!safeStorageService.isSecurelyAvailable()) return null;
    const temporario = this.tokensTemporarios.get(usuarioId);
    if (temporario) return temporario.tokens;
    const valor = await configuracaoService.obter(chave('tokens', usuarioId));
    if (!valor) return null;
    try {
      const dado: unknown = JSON.parse(valor);
      if (!dado || typeof dado !== 'object' || typeof (dado as Record<string, unknown>).access_token !== 'string') return null;
      return dado as Tokens;
    } catch { return null; }
  }

  private async salvarTokens(usuarioId: string, tokens: Tokens) {
    if (!safeStorageService.isSecurelyAvailable()) throw new ErroGoogleDrive('trocar_codigo_oauth', 'A proteção local de credenciais não está disponível neste dispositivo.', 'protecao_local_indisponivel');
    await configuracaoService.salvar(chave('tokens', usuarioId), JSON.stringify(tokens), 'api_key', 'Tokens OAuth do Google Drive');
  }

  private confirmarConexaoAtiva(usuarioId: string, versao: number): void {
    if (this.versoesConexao.get(usuarioId) !== versao) {
      throw new ErroGoogleDrive('trocar_codigo_oauth', 'A conexão com o Google Drive foi cancelada.', 'conexao_cancelada');
    }
  }

  private async validarIdentidadeGoogle(idToken: unknown, nonce: string): Promise<{ email: string; sub: string }> {
    if (typeof idToken !== 'string') {
      throw new ErroGoogleDrive('validar_conta_institucional', 'O Google não devolveu a identificação da conta autorizada.', 'id_token_ausente');
    }
    let payload: Record<string, unknown>;
    try {
      const resultado = await jwtVerify(idToken, CHAVES_PUBLICAS_GOOGLE, {
        algorithms: ['RS256'],
        audience: CLIENT_ID,
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
      });
      payload = resultado.payload;
    } catch {
      throw new ErroGoogleDrive('validar_conta_institucional', 'Não foi possível validar a identidade da conta Google autorizada.', 'id_token_invalido');
    }
    const email = payload.email;
    if (payload.nonce !== nonce || typeof payload.sub !== 'string' || typeof email !== 'string'
      || payload.email_verified !== true || payload.hd !== DOMINIO_INSTITUCIONAL
      || !email.toLowerCase().endsWith(`@${DOMINIO_INSTITUCIONAL}`)) {
      throw new ErroGoogleDrive('validar_conta_institucional', 'Esta conta não é institucional ou não foi autorizada pela organização.', 'conta_institucional_nao_confirmada');
    }
    return { email, sub: payload.sub };
  }

  private async salvarConexao(usuarioId: string, tokens: Tokens, identidade: { email: string; sub: string }): Promise<void> {
    await withTransaction(async () => {
      await this.salvarTokens(usuarioId, tokens);
      await configuracaoService.salvar(chave('email', usuarioId), identidade.email, 'texto', 'Conta Google Drive autorizada');
      await configuracaoService.salvar(chave('sub', usuarioId), identidade.sub, 'texto', 'Identificador estável da conta Google Drive');
    });
  }

  private async obterFila(usuarioId: string): Promise<ItemFilaGoogleDrive[]> {
    const valor = await configuracaoService.obter(chave('fila', usuarioId));
    if (!valor) return [];
    try {
      const bruto: unknown = JSON.parse(valor);
      if (!Array.isArray(bruto)) return [];
      return bruto.filter((item): item is ItemFilaGoogleDrive => {
        if (!item || typeof item !== 'object') return false;
        const fila = item as Record<string, unknown>;
        return typeof fila.laudoId === 'string' && typeof fila.contaGoogle === 'string' && typeof fila.enfileiradoEm === 'string'
          && typeof fila.tentativas === 'number' && (fila.ultimoErro === undefined || typeof fila.ultimoErro === 'string')
          && (fila.estado === undefined || fila.estado === 'pendente' || fila.estado === 'aguardando_correcao')
          && (fila.versaoValidacao === undefined || (typeof fila.versaoValidacao === 'number' && Number.isInteger(fila.versaoValidacao) && fila.versaoValidacao > 0))
          && (fila.motivoEspera === undefined || fila.motivoEspera === 'conteudo' || fila.motivoEspera === 'cota');
      });
    } catch {
      return [];
    }
  }

  private async salvarFila(usuarioId: string, fila: ItemFilaGoogleDrive[]): Promise<void> {
    await configuracaoService.salvar(chave('fila', usuarioId), JSON.stringify(fila), 'json', 'Fila de envio automático ao Google Drive');
  }

  private async obterCacheResumo(usuarioId: string): Promise<CacheResumoGoogleDrive | null> {
    const valor = await configuracaoService.obter(chave('cache_resumo', usuarioId));
    if (!valor) return null;
    try {
      const bruto: unknown = JSON.parse(valor);
      if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return null;
      const cache = bruto as Record<string, unknown>;
      if (cache.versao !== 1 || typeof cache.email !== 'string' || typeof cache.atualizadoEm !== 'string'
        || !cache.estado || typeof cache.estado !== 'object' || Array.isArray(cache.estado) || !Array.isArray(cache.copias)) return null;
      const atualizadoEm = new Date(cache.atualizadoEm).getTime();
      if (Number.isNaN(atualizadoEm)) return null;
      const estado = cache.estado as Record<string, unknown>;
      if (typeof estado.conectado !== 'boolean' || typeof estado.envioAutomatico !== 'boolean' || typeof estado.pendencias !== 'number') return null;
      const protecaoChave = estado.protecaoChave;
      if (protecaoChave !== undefined && protecaoChave !== 'protegida' && protecaoChave !== 'aguardando_primeiro_envio' && protecaoChave !== 'migracao_pendente' && protecaoChave !== 'reconexao_necessaria' && protecaoChave !== 'indisponivel') return null;
      const estadoCache: EstadoGoogleDrive = {
        conectado: estado.conectado,
        envioAutomatico: estado.envioAutomatico,
        pendencias: estado.pendencias,
        ...(typeof estado.email === 'string' ? { email: estado.email } : {}),
        ...(typeof estado.caminho === 'string' ? { caminho: estado.caminho } : {}),
        ...(typeof estado.usoBytes === 'number' ? { usoBytes: estado.usoBytes } : {}),
        ...(typeof estado.limiteBytes === 'number' ? { limiteBytes: estado.limiteBytes } : {}),
        ...(typeof estado.backupsBytes === 'number' ? { backupsBytes: estado.backupsBytes } : {}),
        ...(typeof estado.limiteBackupsBytes === 'number' ? { limiteBackupsBytes: estado.limiteBackupsBytes } : {}),
        ...(typeof estado.backupsDisponiveisBytes === 'number' ? { backupsDisponiveisBytes: estado.backupsDisponiveisBytes } : {}),
        ...(typeof estado.percentualBackups === 'number' ? { percentualBackups: estado.percentualBackups } : {}),
        ...(typeof estado.ultimoEnvioEm === 'string' ? { ultimoEnvioEm: estado.ultimoEnvioEm } : {}),
        ...(typeof estado.falhaFila === 'string' ? { falhaFila: estado.falhaFila } : {}),
        ...(typeof estado.filaAguardaCorrecao === 'boolean' ? { filaAguardaCorrecao: estado.filaAguardaCorrecao } : {}),
        ...(typeof estado.filaAguardaEspaco === 'boolean' ? { filaAguardaEspaco: estado.filaAguardaEspaco } : {}),
        ...(protecaoChave ? { protecaoChave } : {}),
        ...(typeof estado.aviso === 'string' ? { aviso: estado.aviso } : {}),
      };
      const copias = cache.copias.filter((copia): copia is CopiaGoogleDrive => {
        if (!copia || typeof copia !== 'object' || Array.isArray(copia)) return false;
        const item = copia as Record<string, unknown>;
        return typeof item.id === 'string' && typeof item.laudoId === 'string' && typeof item.numeroRep === 'string'
          && typeof item.nome === 'string' && typeof item.tamanho === 'number' && typeof item.modificadaEm === 'string' && typeof item.revisao === 'string'
          && (item.verificadaEm === undefined || typeof item.verificadaEm === 'string');
      });
      if (copias.length !== cache.copias.length) return null;
      return { versao: 1, email: cache.email, atualizadoEm: cache.atualizadoEm, estado: estadoCache, copias };
    } catch {
      return null;
    }
  }

  private async salvarCacheResumo(usuarioId: string, email: string, estado: EstadoGoogleDrive, copias: CopiaGoogleDrive[]): Promise<void> {
    const cache: CacheResumoGoogleDrive = { versao: 1, email, atualizadoEm: new Date().toISOString(), estado, copias };
    await configuracaoService.salvar(chave('cache_resumo', usuarioId), JSON.stringify(cache), 'json', 'Resumo em cache dos backups Google Drive');
  }

  private async invalidarCacheResumo(usuarioId: string): Promise<void> {
    await configuracaoService.salvar(chave('cache_resumo', usuarioId), '', 'json', 'Resumo em cache dos backups Google Drive');
  }

  private async obterRevisoes(usuarioId: string): Promise<RevisoesGoogleDrive> {
    const valor = await configuracaoService.obter(chave('revisoes', usuarioId));
    if (!valor) return {};
    try {
      const bruto: unknown = JSON.parse(valor);
      if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {};
      return Object.fromEntries(Object.entries(bruto).filter(([, revisao]) => typeof revisao === 'string'));
    } catch { return {}; }
  }

  private async registrarRevisao(usuarioId: string, laudoId: string, revisao: string): Promise<void> {
    const revisoes = await this.obterRevisoes(usuarioId);
    revisoes[laudoId] = revisao;
    await configuracaoService.salvar(chave('revisoes', usuarioId), JSON.stringify(revisoes), 'json', 'Revisões conhecidas dos backups Google Drive');
  }

  private async obterVerificacoes(usuarioId: string): Promise<VerificacoesGoogleDrive> {
    const valor = await configuracaoService.obter(chave('verificacoes', usuarioId));
    if (!valor) return {};
    try {
      const bruto: unknown = JSON.parse(valor);
      if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {};
      return Object.fromEntries(Object.entries(bruto).filter(([, data]) => typeof data === 'string'));
    } catch { return {}; }
  }

  private async registrarVerificacao(usuarioId: string, revisao: string): Promise<void> {
    const verificacoes = await this.obterVerificacoes(usuarioId);
    verificacoes[revisao] = new Date().toISOString();
    await configuracaoService.salvar(chave('verificacoes', usuarioId), JSON.stringify(verificacoes), 'json', 'Verificações dos backups Google Drive');
  }

  async registrarVerificacaoConcluida(usuarioId: string, revisao: string): Promise<void> {
    await this.registrarVerificacao(usuarioId, revisao);
    await this.invalidarCacheResumo(usuarioId);
  }

  private agendarProcessamentoFila(usuarioId: string): void {
    if (this.temporizadoresFila.has(usuarioId)) return;
    const temporizador = setTimeout(() => {
      this.temporizadoresFila.delete(usuarioId);
      void this.processarFila(usuarioId);
    }, 60_000);
    this.temporizadoresFila.set(usuarioId, temporizador);
  }

  private async tokenValido(usuarioId: string): Promise<string> {
    if (!safeStorageService.isSecurelyAvailable()) throw new ErroGoogleDrive('renovar_token', 'A proteção local de credenciais não está disponível neste dispositivo.', 'protecao_local_indisponivel');
    const tokens = await this.obterTokens(usuarioId);
    if (!tokens) throw new Error('Conecte uma conta institucional do Google Drive.');
    if (tokens.expires_at > Date.now() + MARGEM_RENOVACAO_TOKEN_MS) return tokens.access_token;
    if (!tokens.refresh_token) throw new ErroGoogleDrive('renovar_token', 'A autorização do Google Drive expirou. Conecte a conta novamente.', 'refresh_token_ausente');
    const emAndamento = this.renovacoesTokens.get(usuarioId);
    if (emAndamento) return emAndamento;
    const renovacao = this.renovarToken(usuarioId, tokens).finally(() => this.renovacoesTokens.delete(usuarioId));
    this.renovacoesTokens.set(usuarioId, renovacao);
    return renovacao;
  }

  private async obterSegredoClienteObrigatorio(etapa: 'trocar_codigo_oauth' | 'renovar_token'): Promise<string> {
    const segredo = await obterSegredoClienteGoogleDrive();
    if (segredo) return segredo;
    throw new ErroGoogleDrive(etapa, 'A integração Google Drive precisa ser configurada pelo responsável.', 'configuracao_oauth_indisponivel');
  }

  private async renovarToken(usuarioId: string, tokens: Tokens): Promise<string> {
    const clientSecret = await this.obterSegredoClienteObrigatorio('renovar_token');
    let resposta: Response;
    try {
      resposta = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: tokens.refresh_token! }),
        signal: AbortSignal.timeout(TEMPO_LIMITE_REQUISICAO_MS),
      });
    } catch {
      throw new ErroGoogleDrive('renovar_token', 'Não foi possível renovar a autorização do Google Drive.', 'rede_indisponivel');
    }
    const dados: unknown = await resposta.json().catch(() => null);
    if (!resposta.ok || !dados || typeof dados !== 'object' || typeof (dados as Record<string, unknown>).access_token !== 'string') {
      const codigo = codigoErroOAuth(dados, resposta.status);
      if (codigo.startsWith('invalid_grant')) await this.limparConexaoLocal(usuarioId);
      throw new ErroGoogleDrive('renovar_token', 'A autorização do Google Drive expirou. Conecte a conta novamente.', codigo);
    }
    const novo = dados as Record<string, unknown>;
    const atualizados: Tokens = {
      access_token: String(novo.access_token),
      refresh_token: typeof novo.refresh_token === 'string' ? novo.refresh_token : tokens.refresh_token,
      expires_at: Date.now() + Number(novo.expires_in ?? 3600) * 1000,
      escopos: typeof novo.scope === 'string' ? escoposAutorizados(novo.scope) : tokens.escopos,
    };
    await this.salvarTokens(usuarioId, atualizados);
    return atualizados.access_token;
  }

  private async requisitar(usuarioId: string, url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.tokenValido(usuarioId);
    const enviar = async (tokenAtual: string): Promise<Response> => {
      const prazo = new AbortController();
      const temporizador = setTimeout(() => prazo.abort(), TEMPO_LIMITE_REQUISICAO_MS);
      const sinal = init.signal ? AbortSignal.any([init.signal, prazo.signal]) : prazo.signal;
      try { return await fetch(url, { ...init, signal: sinal, headers: { ...init.headers, Authorization: `Bearer ${tokenAtual}` } }); }
      catch (erro) {
        if (init.signal?.aborted) throw new ErroGoogleDrive('verificar_pacote', 'A conferência de integridade foi cancelada.', 'verificacao_cancelada');
        if (prazo.signal.aborted) throw new ErroGoogleDrive('verificar_pacote', 'O Google Drive demorou demais para iniciar a resposta. Tente novamente.', 'tempo_limite_drive');
        throw erro;
      } finally { clearTimeout(temporizador); }
    };
    const resposta = await enviar(token);
    if (resposta.status !== 401) return resposta;
    const tokens = await this.obterTokens(usuarioId);
    if (tokens) { tokens.expires_at = 0; await this.salvarTokens(usuarioId, tokens); }
    const renovado = await this.tokenValido(usuarioId);
    return enviar(renovado);
  }

  async conectar(usuarioId: string): Promise<EstadoGoogleDrive> {
    const emAndamento = this.conexoesEmAndamento.get(usuarioId);
    if (emAndamento) return emAndamento;
    const versao = (this.versoesConexao.get(usuarioId) ?? 0) + 1;
    this.versoesConexao.set(usuarioId, versao);
    const operacao = this.conectarConta(usuarioId, versao).finally(() => {
      if (this.conexoesEmAndamento.get(usuarioId) === operacao) this.conexoesEmAndamento.delete(usuarioId);
      const temporario = this.tokensTemporarios.get(usuarioId);
      if (temporario?.versao === versao) this.tokensTemporarios.delete(usuarioId);
    });
    this.conexoesEmAndamento.set(usuarioId, operacao);
    return operacao;
  }

  private async conectarConta(usuarioId: string, versao: number): Promise<EstadoGoogleDrive> {
    if (!safeStorageService.isSecurelyAvailable()) throw new ErroGoogleDrive('trocar_codigo_oauth', 'A proteção local de credenciais não está disponível neste dispositivo.', 'protecao_local_indisponivel');
    const clientSecret = await this.obterSegredoClienteObrigatorio('trocar_codigo_oauth');
    const servidor = createServer();
    const retorno = await new Promise<{ codigo: string; redirectUri: string; nonce: string }>((resolve, reject) => {
      const state = base64Url(randomBytes(32));
      const nonce = base64Url(randomBytes(32));
      const verifier = base64Url(randomBytes(64));
      const challenge = base64Url(createHash('sha256').update(verifier).digest());
      let redirectUri = '';
      let concluido = false;
      const encerrarComErro = (erro: Error) => {
        if (concluido) return;
        concluido = true;
        clearTimeout(tempo);
        servidor.close();
        reject(erro);
      };
      const tempo = setTimeout(() => encerrarComErro(new Error('A autorização do Google Drive expirou.')), 300_000);
      servidor.once('error', () => encerrarComErro(new Error('Não foi possível iniciar a autorização segura.')));
      servidor.on('request', async (requisicao, resposta) => {
        const origem = new URL(redirectUri);
        const url = new URL(requisicao.url ?? '/', redirectUri);
        const autorizado = !concluido
          && requisicao.method === 'GET'
          && requisicao.headers.host === origem.host
          && url.pathname === '/oauth2callback'
          && url.searchParams.get('state') === state
          && Boolean(url.searchParams.get('code'));
        const pagina = paginaRetornoOAuth(await obterLogoRetornoOAuth(), autorizado);
        resposta.writeHead(autorizado ? 200 : 400, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
          'Referrer-Policy': 'no-referrer',
        });
        resposta.end(pagina);
        if (!autorizado) return;
        concluido = true;
        clearTimeout(tempo);
        resolve({ codigo: url.searchParams.get('code')!, redirectUri, nonce });
        servidor.close();
      });
      servidor.listen(0, '127.0.0.1', () => {
        const porta = (servidor.address() as import('node:net').AddressInfo).port;
        redirectUri = `http://127.0.0.1:${porta}/oauth2callback`;
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.search = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', scope: ESCOPO, state, nonce, code_challenge: challenge, code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent' }).toString();
        void shell.openExternal(url.toString());
      });
      void verifier;
      // O verifier é necessário no escopo da callback; associa-o sem expô-lo ao renderer.
      (servidor as unknown as { verifier?: string }).verifier = verifier;
    });
    const verifier = (servidor as unknown as { verifier?: string }).verifier;
    if (!verifier) throw new Error('Não foi possível iniciar a autorização segura.');
    let resposta: Response;
    try { resposta = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: clientSecret, code: retorno.codigo, code_verifier: verifier, redirect_uri: retorno.redirectUri, grant_type: 'authorization_code' }), signal: AbortSignal.timeout(TEMPO_LIMITE_REQUISICAO_MS) }); }
    catch { throw new ErroGoogleDrive('trocar_codigo_oauth', 'Não foi possível concluir a autorização com o Google.', 'rede_indisponivel'); }
    const dados: unknown = await resposta.json().catch(() => null);
    if (!resposta.ok || !dados || typeof dados !== 'object' || typeof (dados as Record<string, unknown>).access_token !== 'string') throw new ErroGoogleDrive('trocar_codigo_oauth', 'O Google não concluiu a autorização. Confira a configuração da integração e tente novamente.', codigoErroOAuth(dados, resposta.status));
    const bruto = dados as Record<string, unknown>;
    const escopos = escoposAutorizados(bruto.scope);
    if (!temEscoposObrigatorios(escopos)) throw new ErroGoogleDrive('validar_conta_institucional', 'A conta não concedeu todas as permissões necessárias ao Google Drive.', 'escopos_insuficientes');
    const identidade = await this.validarIdentidadeGoogle(bruto.id_token, retorno.nonce);
    const tokens: Tokens = { access_token: String(bruto.access_token), refresh_token: typeof bruto.refresh_token === 'string' ? bruto.refresh_token : undefined, expires_at: Date.now() + Number(bruto.expires_in ?? 3600) * 1000, escopos };
    this.confirmarConexaoAtiva(usuarioId, versao);
    this.tokensTemporarios.set(usuarioId, { versao, tokens });
    try {
      const raizId = await this.obterRaiz(usuarioId);
      await this.verificarAcessoDadosApp(usuarioId);
      await this.migrarControleLegado(usuarioId, raizId);
    } catch (erro) { throw erro instanceof ErroGoogleDrive ? erro : new ErroGoogleDrive('localizar_raiz_drive', 'Não foi possível preparar a pasta laWdo no Google Drive.', 'falha_nao_classificada'); }
    this.confirmarConexaoAtiva(usuarioId, versao);
    await this.salvarConexao(usuarioId, tokens, identidade);
    await this.invalidarCacheResumo(usuarioId);
    const estado = await this.estado(usuarioId);
    if (!estado.conectado) throw new ErroGoogleDrive('localizar_raiz_drive', estado.aviso ?? 'Não foi possível concluir a conexão com o Google Drive.', 'estado_indisponivel');
    void this.processarFila(usuarioId);
    return estado;
  }

  private async limparConexaoLocal(usuarioId: string): Promise<void> {
    this.versoesConexao.set(usuarioId, (this.versoesConexao.get(usuarioId) ?? 0) + 1);
    this.tokensTemporarios.delete(usuarioId);
    await executeNonQuery('DELETE FROM configuracoes WHERE chave = ?', [chave('tokens', usuarioId)]);
    await configuracaoService.salvar(chave('email', usuarioId), '', 'texto', 'Conta Google Drive removida');
    await configuracaoService.salvar(chave('sub', usuarioId), '', 'texto', 'Identificador da conta Google Drive removido');
    await this.invalidarCacheResumo(usuarioId);
  }

  async desconectar(usuarioId: string): Promise<{ revogacaoRemota: boolean }> {
    const tokens = await this.obterTokens(usuarioId);
    const tokenRevogacao = tokens?.refresh_token ?? tokens?.access_token;
    let revogacaoRemota = !tokenRevogacao;
    if (tokenRevogacao) {
      try {
        const resposta = await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: tokenRevogacao }),
          signal: AbortSignal.timeout(TEMPO_LIMITE_REQUISICAO_MS),
        });
        revogacaoRemota = resposta.ok;
      } catch {
        revogacaoRemota = false;
      }
    }
    await this.limparConexaoLocal(usuarioId);
    if (!revogacaoRemota) log.warn('Revogação remota do Google Drive não confirmada.', { usuarioId });
    return { revogacaoRemota };
  }

  private async listar(usuarioId: string, consulta: string, campos: string, sinal?: AbortSignal): Promise<ArquivoDrive[]> {
    const arquivos: ArquivoDrive[] = [];
    let pagina: string | undefined;
    do {
      const parametros = new URLSearchParams({ q: consulta, fields: `nextPageToken,files(${campos})`, pageSize: '1000', spaces: 'drive' });
      if (pagina) parametros.set('pageToken', pagina);
      const resposta = await this.requisitar(usuarioId, `https://www.googleapis.com/drive/v3/files?${parametros}`, { signal: sinal });
      const json: unknown = await resposta.json();
      if (!resposta.ok) throw new ErroGoogleDrive('localizar_raiz_drive', 'Não foi possível consultar a pasta do laWdo no Google Drive.', `http_${resposta.status}`);
      if (!json || typeof json !== 'object' || !('files' in json) || !Array.isArray(json.files)) throw new ErroGoogleDrive('localizar_raiz_drive', 'O Google Drive retornou uma resposta inválida.', 'resposta_invalida');
      const validos = json.files.filter((item): item is ArquivoDrive => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string');
      if (validos.length !== json.files.length) throw new ErroGoogleDrive('localizar_raiz_drive', 'O Google Drive retornou uma resposta inválida.', 'resposta_invalida');
      arquivos.push(...validos);
      pagina = 'nextPageToken' in json && typeof json.nextPageToken === 'string' ? json.nextPageToken : undefined;
    } while (pagina);
    return arquivos;
  }

  private async listarDadosApp(usuarioId: string, consulta: string, campos: string): Promise<ArquivoDrive[]> {
    const arquivos: ArquivoDrive[] = [];
    let pagina: string | undefined;
    do {
      const parametros = new URLSearchParams({ q: consulta, fields: `nextPageToken,files(${campos})`, pageSize: '1000', spaces: 'appDataFolder' });
      if (pagina) parametros.set('pageToken', pagina);
      const resposta = await this.requisitar(usuarioId, `https://www.googleapis.com/drive/v3/files?${parametros}`);
      const json: unknown = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        const mensagem = resposta.status === 401 || resposta.status === 403
          ? 'A autorização para proteger a chave dos backups precisa ser renovada. Reconecte a conta institucional.'
          : 'Não foi possível acessar os dados privados do laWdo no Google Drive.';
        throw new ErroGoogleDrive('autorizar_dados_privados', mensagem, `http_${resposta.status}`);
      }
      if (!json || typeof json !== 'object' || !('files' in json) || !Array.isArray(json.files)) {
        throw new ErroGoogleDrive('autorizar_dados_privados', 'O Google Drive retornou uma resposta inválida para os dados privados.', 'resposta_invalida');
      }
      const encontrados = json.files.filter((item): item is ArquivoDrive => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string');
      if (encontrados.length !== json.files.length) throw new ErroGoogleDrive('autorizar_dados_privados', 'O Google Drive retornou uma resposta inválida para os dados privados.', 'resposta_invalida');
      arquivos.push(...encontrados);
      pagina = 'nextPageToken' in json && typeof json.nextPageToken === 'string' ? json.nextPageToken : undefined;
    } while (pagina);
    return arquivos;
  }

  private async verificarAcessoDadosApp(usuarioId: string): Promise<void> {
    const tokens = await this.obterTokens(usuarioId);
    if (!tokens || !temEscopoDadosApp(tokens)) {
      throw new ErroGoogleDrive('autorizar_dados_privados', 'A proteção privada da chave requer uma nova autorização da conta institucional.', 'reconexao_necessaria');
    }
    await this.listarDadosApp(usuarioId, "trashed = false and appProperties has { key='lawdoControlePrivado' and value='1' }", 'id,name,appProperties');
  }

  private async criarPasta(usuarioId: string, nome: string, paiId: string, raizId: string): Promise<string> {
    const existentes = await this.listar(usuarioId, `'${escaparConsultaDrive(paiId)}' in parents and trashed = false and mimeType = '${MIME_PASTA}' and name = '${escaparConsultaDrive(nome)}'`, 'id,name,appProperties');
    if (existentes.length > 1) throw new ErroGoogleDrive('localizar_raiz_drive', `Foram encontradas pastas duplicadas em ${nome}. A integração foi pausada para proteção dos backups.`, 'pastas_duplicadas');
    if (existentes.length === 1) {
      if (existentes[0].appProperties?.lawdoRaizId !== raizId || existentes[0].appProperties?.lawdoPasta !== '1') {
        throw new ErroGoogleDrive('localizar_raiz_drive', `Já existe uma pasta ${nome} que não pertence ao laWdo. A integração não a reutilizou.`, 'conflito_pasta_homonima');
      }
      return existentes[0].id;
    }
    const resposta = await this.requisitar(usuarioId, 'https://www.googleapis.com/drive/v3/files', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nome, mimeType: MIME_PASTA, parents: [paiId], appProperties: { lawdoPasta: '1', lawdoRaizId: raizId } }),
    });
    const criada: unknown = await resposta.json().catch(() => null);
    if (!resposta.ok || !criada || typeof criada !== 'object' || typeof (criada as Record<string, unknown>).id !== 'string') {
      throw new ErroGoogleDrive('criar_raiz_drive', `Não foi possível criar a pasta ${nome} no Google Drive.`, `http_${resposta.status}`);
    }
    return String((criada as Record<string, unknown>).id);
  }

  private async listarDescendentes(usuarioId: string, raizId: string, sinal?: AbortSignal): Promise<ArquivoDrive[]> {
    const encontrados: ArquivoDrive[] = [];
    const pendentes = [raizId];
    const visitados = new Set<string>();
    while (pendentes.length) {
      const pai = pendentes.pop()!;
      if (visitados.has(pai)) continue;
      visitados.add(pai);
      const filhos = await this.listar(usuarioId, `'${escaparConsultaDrive(pai)}' in parents and trashed = false`, 'id,name,mimeType,size,modifiedTime,version,appProperties,parents', sinal);
      encontrados.push(...filhos);
      for (const filho of filhos) if (filho.mimeType === MIME_PASTA) pendentes.push(filho.id);
    }
    return encontrados;
  }

  private async obterArquivoDrive(usuarioId: string, arquivoId: string, sinal?: AbortSignal): Promise<ArquivoDrive | null> {
    if (!/^[\w-]+$/.test(arquivoId)) return null;
    const campos = 'id,name,mimeType,size,modifiedTime,version,appProperties,parents';
    const resposta = await this.requisitar(usuarioId, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(arquivoId)}?fields=${encodeURIComponent(campos)}`, { signal: sinal });
    if (resposta.status === 404) return null;
    const bruto: unknown = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new ErroGoogleDrive('verificar_pacote', 'Não foi possível confirmar a cópia no Google Drive.', `http_${resposta.status}`);
    if (!bruto || typeof bruto !== 'object' || typeof (bruto as Record<string, unknown>).id !== 'string' || typeof (bruto as Record<string, unknown>).name !== 'string') {
      throw new ErroGoogleDrive('verificar_pacote', 'O Google Drive retornou uma cópia inválida.', 'resposta_invalida');
    }
    return bruto as ArquivoDrive;
  }

  private async listarCopiasDoLaudo(usuarioId: string, raizId: string, laudoId: string, sinal?: AbortSignal): Promise<CopiaGoogleDriveLocalizada[]> {
    const consulta = [
      'trashed = false',
      "appProperties has { key='lawdoBackup' and value='1' }",
      `appProperties has { key='lawdoRaizId' and value='${escaparConsultaDrive(raizId)}' }`,
      `appProperties has { key='lawdoLaudoId' and value='${escaparConsultaDrive(laudoId)}' }`,
    ].join(' and ');
    const arquivos = await this.listar(usuarioId, consulta, 'id,name,mimeType,size,modifiedTime,version,appProperties,parents', sinal);
    const cache = new Map<string, ArquivoDrive>();
    for (const arquivo of arquivos) cache.set(arquivo.id, arquivo);
    const obterPai = async (filho: ArquivoDrive): Promise<ArquivoDrive | null> => {
      if (filho.parents?.length !== 1) return null;
      const paiId = filho.parents[0]!;
      const conhecido = cache.get(paiId);
      if (conhecido) return conhecido;
      const pai = await this.obterArquivoDrive(usuarioId, paiId, sinal);
      if (pai) cache.set(pai.id, pai);
      return pai;
    };
    const ehPastaLaWdo = (arquivo: ArquivoDrive | null): arquivo is ArquivoDrive => arquivo?.mimeType === MIME_PASTA
      && arquivo.appProperties?.lawdoPasta === '1' && arquivo.appProperties.lawdoRaizId === raizId;

    const copias: CopiaGoogleDriveLocalizada[] = [];
    for (const arquivo of arquivos) {
      const pastaRep = await obterPai(arquivo);
      const pastaMes = pastaRep ? await obterPai(pastaRep) : null;
      const pastaAno = pastaMes ? await obterPai(pastaMes) : null;
      const pertenceARaiz = pastaAno?.parents?.length === 1 && pastaAno.parents[0] === raizId;
      if (arquivo.appProperties?.lawdoBackup !== '1' || arquivo.appProperties.lawdoRaizId !== raizId
        || arquivo.appProperties.lawdoLaudoId !== laudoId || !ehPastaLaWdo(pastaRep)
        || !ehPastaLaWdo(pastaMes) || !ehPastaLaWdo(pastaAno) || !pertenceARaiz) {
        throw new ErroGoogleDrive('verificar_pacote', 'A pasta exclusiva de uma cópia encontrada não pôde ser confirmada. Nenhuma cópia foi substituída.', 'pasta_copia_invalida');
      }
      copias.push({
        id: arquivo.id,
        laudoId,
        numeroRep: arquivo.appProperties.lawdoNumeroRep ?? '',
        nome: arquivo.name,
        tamanho: Number(arquivo.size ?? 0),
        modificadaEm: arquivo.modifiedTime ?? '',
        revisao: arquivo.appProperties.lawdoHash ?? arquivo.version ?? '',
        versaoDrive: arquivo.version ?? '',
      });
    }
    return copias;
  }

  private async obterPastaExclusivaDaCopia(usuarioId: string, copiaId: string): Promise<ArquivoDrive> {
    const raizId = await this.obterRaiz(usuarioId);
    const descendentes = await this.listarDescendentes(usuarioId, raizId);
    const porId = new Map(descendentes.map(item => [item.id, item]));
    const copia = porId.get(copiaId);
    const obterPaiUnico = (item: ArquivoDrive | undefined): ArquivoDrive | undefined => {
      if (!item || item.parents?.length !== 1) return undefined;
      return porId.get(item.parents[0]);
    };
    const pastaRep = obterPaiUnico(copia);
    const pastaMes = obterPaiUnico(pastaRep);
    const pastaAno = obterPaiUnico(pastaMes);
    const raiz = pastaAno?.parents?.length === 1 && pastaAno.parents[0] === raizId;
    const pastaLaWdo = (pasta: ArquivoDrive | undefined) => pasta?.mimeType === MIME_PASTA
      && pasta.appProperties?.lawdoPasta === '1' && pasta.appProperties.lawdoRaizId === raizId;

    if (!copia || !pastaRep || !pastaMes || !pastaAno || copia.appProperties?.lawdoBackup !== '1'
      || copia.appProperties.lawdoRaizId !== raizId || !pastaLaWdo(pastaRep)
      || !pastaLaWdo(pastaMes) || !pastaLaWdo(pastaAno) || !raiz) {
      throw new ErroGoogleDrive('verificar_pacote', 'A pasta exclusiva desta cópia não pôde ser confirmada. Nenhum arquivo foi enviado para a Lixeira.', 'pasta_copia_invalida');
    }
    return pastaRep;
  }

  private async conferirCotaAntesDoEnvio(usuarioId: string, raizId: string, tamanhoNovoBackup: number): Promise<void> {
    const [arquivos, respostaCota] = await Promise.all([
      this.listarDescendentes(usuarioId, raizId),
      this.requisitar(usuarioId, 'https://www.googleapis.com/drive/v3/about?fields=storageQuota'),
    ]);
    const usados = arquivos.filter(item => item.appProperties?.lawdoBackup === '1' && item.appProperties?.lawdoRaizId === raizId)
      .reduce((total, item) => total + Number(item.size ?? 0), 0);
    if (usados + tamanhoNovoBackup > LIMITE_BACKUPS_BYTES) {
      const disponivel = Math.max(0, LIMITE_BACKUPS_BYTES - usados);
      throw new ErroGoogleDrive('verificar_cota', `A cota de backups do laWdo é de 10 GB. Há ${(disponivel / 1024 ** 3).toFixed(1)} GB disponíveis, mas esta cópia precisa de ${(tamanhoNovoBackup / 1024 ** 3).toFixed(1)} GB.`, 'cota_backups_excedida');
    }
    const dados: unknown = await respostaCota.json().catch(() => null);
    const quota = dados && typeof dados === 'object' ? (dados as { storageQuota?: Record<string, unknown> }).storageQuota : undefined;
    const usoConta = Number(quota?.usage ?? 0);
    const limiteConta = quota?.limit === undefined ? undefined : Number(quota.limit);
    if (!respostaCota.ok || !Number.isFinite(usoConta) || (limiteConta !== undefined && !Number.isFinite(limiteConta))) throw new ErroGoogleDrive('verificar_cota', 'Não foi possível conferir o espaço disponível na conta Google.', 'cota_conta_indisponivel');
    if (limiteConta !== undefined && usoConta + tamanhoNovoBackup > limiteConta) throw new ErroGoogleDrive('verificar_cota', 'Não há espaço suficiente na conta Google para enviar esta cópia.', 'cota_conta_excedida');
  }

  private async baixarArquivo(usuarioId: string, arquivoId: string, destino: string, sinal?: AbortSignal, aoProgresso?: (recebidos: number, total?: number) => void): Promise<void> {
    const inatividade = new AbortController();
    let temporizadorInatividade: NodeJS.Timeout | undefined;
    const reiniciarInatividade = () => {
      if (temporizadorInatividade) clearTimeout(temporizadorInatividade);
      temporizadorInatividade = setTimeout(() => inatividade.abort(), TEMPO_LIMITE_INATIVIDADE_DOWNLOAD_MS);
    };
    const sinalDownload = sinal ? AbortSignal.any([sinal, inatividade.signal]) : inatividade.signal;
    try {
      const resposta = await this.requisitar(usuarioId, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(arquivoId)}?alt=media`, { signal: sinalDownload });
      if (!resposta.ok || !resposta.body) throw new ErroGoogleDrive('verificar_pacote', 'Não foi possível baixar a cópia do Google Drive.', `http_${resposta.status}`);
      const tamanhoCabecalho = Number(resposta.headers.get('content-length'));
      const total = Number.isFinite(tamanhoCabecalho) && tamanhoCabecalho > 0 ? tamanhoCabecalho : undefined;
      let recebidos = 0;
      reiniciarInatividade();
      const fluxo = Readable.fromWeb(resposta.body as import('node:stream/web').ReadableStream);
      const medidor = new Transform({
        transform(parte: Buffer, _codificacao, concluir) {
          recebidos += parte.length;
          reiniciarInatividade();
          aoProgresso?.(recebidos, total);
          concluir(null, parte);
        },
      });
      await pipeline(fluxo, medidor, createWriteStream(destino, { flags: 'wx' }), { signal: sinalDownload });
    } catch (erro) {
      if (sinal?.aborted) throw new ErroGoogleDrive('verificar_pacote', 'A conferência de integridade foi cancelada.', 'verificacao_cancelada');
      if (inatividade.signal.aborted) throw new ErroGoogleDrive('verificar_pacote', 'O download ficou sem receber dados por muito tempo. Tente novamente.', 'download_inativo');
      throw erro;
    } finally { if (temporizadorInatividade) clearTimeout(temporizadorInatividade); }
  }

  private async iniciarEnvioResumivel(usuarioId: string, tamanho: number, metadados: Record<string, unknown>): Promise<string> {
    const inicio = await this.requisitar(usuarioId, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/octet-stream', 'X-Upload-Content-Length': String(tamanho) },
      body: JSON.stringify(metadados),
    });
    const destino = inicio.headers.get('location');
    if (!inicio.ok || !destino) throw new ErroGoogleDrive('enviar_pacote', 'Não foi possível iniciar o envio ao Google Drive.', `http_${inicio.status}`);
    let url: URL;
    try { url = new URL(destino); }
    catch { throw new ErroGoogleDrive('enviar_pacote', 'O Google Drive retornou um destino de envio inválido.', 'destino_upload_invalido'); }
    if (url.protocol !== 'https:' || url.hostname !== 'www.googleapis.com') {
      throw new ErroGoogleDrive('enviar_pacote', 'O Google Drive retornou um destino de envio não confiável.', 'destino_upload_nao_confiavel');
    }
    return url.toString();
  }

  private proximoByteRecebido(resposta: Response, tamanho: number): number {
    const faixa = resposta.headers.get('range');
    if (!faixa) return 0;
    const correspondencia = /^bytes=(\d+)-(\d+)$/.exec(faixa);
    if (!correspondencia) throw new ErroGoogleDrive('enviar_pacote', 'O Google Drive retornou o progresso do envio em formato inválido.', 'progresso_upload_invalido');
    const inicio = Number(correspondencia[1]);
    const fim = Number(correspondencia[2]);
    if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(fim) || inicio !== 0 || fim < inicio || fim >= tamanho) {
      throw new ErroGoogleDrive('enviar_pacote', 'O Google Drive retornou um progresso de envio inválido.', 'progresso_upload_invalido');
    }
    return fim + 1;
  }

  private async lerArquivoEnviado(resposta: Response): Promise<ArquivoDrive> {
    const arquivo: unknown = await resposta.json().catch(() => null);
    if (!arquivo || typeof arquivo !== 'object' || typeof (arquivo as Record<string, unknown>).id !== 'string' || typeof (arquivo as Record<string, unknown>).name !== 'string') {
      throw new ErroGoogleDrive('enviar_pacote', 'O Google Drive não confirmou o envio do pacote.', 'resposta_upload_invalida');
    }
    return arquivo as ArquivoDrive;
  }

  private esperaRecuperacaoUpload(resposta?: Response): number {
    const valor = resposta?.headers.get('retry-after');
    if (!valor) return ESPERA_PADRAO_RECUPERACAO_MS;
    const segundos = Number(valor);
    if (Number.isFinite(segundos) && segundos >= 0) return Math.min(ESPERA_MAXIMA_RECUPERACAO_MS, segundos * 1_000);
    const data = new Date(valor).getTime();
    if (Number.isNaN(data)) return ESPERA_PADRAO_RECUPERACAO_MS;
    return Math.min(ESPERA_MAXIMA_RECUPERACAO_MS, Math.max(0, data - Date.now()));
  }

  private async aguardarRecuperacaoUpload(tempoMs: number): Promise<void> {
    if (tempoMs > 0) await new Promise<void>(resolver => setTimeout(resolver, tempoMs));
  }

  private async consultarEnvioResumivel(destino: string, token: string, tamanho: number): Promise<Response> {
    return fetch(destino, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Length': '0', 'Content-Range': `bytes */${tamanho}` },
      redirect: 'error',
    });
  }

  private async localizarArquivoPorOperacao(usuarioId: string, operacaoId: string, dadosPrivados: boolean): Promise<ArquivoDrive | null> {
    const consulta = `trashed = false and appProperties has { key='lawdoOperacaoId' and value='${escaparConsultaDrive(operacaoId)}' }`;
    const arquivos = dadosPrivados
      ? await this.listarDadosApp(usuarioId, consulta, 'id,name,mimeType,size,modifiedTime,version,appProperties,parents')
      : await this.listar(usuarioId, consulta, 'id,name,mimeType,size,modifiedTime,version,appProperties,parents');
    if (arquivos.length > 1) throw new ErroGoogleDrive('enviar_pacote', 'Foram encontrados envios duplicados para a mesma operação. A substituição foi interrompida.', 'operacao_upload_duplicada');
    return arquivos[0] ?? null;
  }

  private async enviarArquivo(usuarioId: string, caminho: string, metadados: Record<string, unknown>): Promise<ArquivoDrive> {
    const { size } = await (await import('node:fs/promises')).stat(caminho);
    const propriedades = metadados.appProperties && typeof metadados.appProperties === 'object' && !Array.isArray(metadados.appProperties)
      ? metadados.appProperties as Record<string, unknown> : {};
    const operacaoId = randomUUID();
    const metadadosComOperacao = { ...metadados, appProperties: { ...propriedades, lawdoOperacaoId: operacaoId } };
    const dadosPrivados = Array.isArray(metadados.parents) && metadados.parents.includes('appDataFolder');
    let recuperacoes = 0;

    for (let sessao = 0; sessao <= TENTATIVAS_RECUPERACAO_UPLOAD; sessao += 1) {
      const destino = await this.iniciarEnvioResumivel(usuarioId, size, metadadosComOperacao);
      let proximoByte = 0;
      let reiniciarSessao = false;

      while (proximoByte < size) {
        const fim = Math.min(proximoByte + TAMANHO_BLOCO_UPLOAD, size) - 1;
        const token = await this.tokenValido(usuarioId);
        let resposta: Response | undefined;
        try {
          const fluxo = Readable.toWeb(createReadStream(caminho, { start: proximoByte, end: fim }));
          resposta = await fetch(destino, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'Content-Length': String(fim - proximoByte + 1), 'Content-Range': `bytes ${proximoByte}-${fim}/${size}` },
            body: fluxo as unknown as BodyInit,
            duplex: 'half',
            redirect: 'error',
          } as RequestInit & { duplex: 'half' });
        } catch {
          // A consulta de status abaixo determina se o Drive recebeu parte do bloco.
        }

        if (resposta?.ok) return this.lerArquivoEnviado(resposta);
        if (resposta?.status === 308) {
          proximoByte = this.proximoByteRecebido(resposta, size);
          continue;
        }
        if (resposta?.status === 404) {
          const existente = await this.localizarArquivoPorOperacao(usuarioId, operacaoId, dadosPrivados);
          if (existente) return existente;
          reiniciarSessao = true;
          break;
        }
        if (resposta && resposta.status !== 429 && resposta.status < 500) {
          throw new ErroGoogleDrive('enviar_pacote', 'O Google Drive recusou o envio do pacote.', `http_${resposta.status}`);
        }
        if (recuperacoes >= TENTATIVAS_RECUPERACAO_UPLOAD) {
          throw new ErroGoogleDrive('enviar_pacote', 'A conexão foi interrompida durante o envio ao Google Drive. Tente novamente.', resposta ? `http_${resposta.status}` : 'rede_indisponivel');
        }
        recuperacoes += 1;
        await this.aguardarRecuperacaoUpload(this.esperaRecuperacaoUpload(resposta));

        let estado: Response | undefined;
        try { estado = await this.consultarEnvioResumivel(destino, token, size); }
        catch {
          if (recuperacoes >= TENTATIVAS_RECUPERACAO_UPLOAD) throw new ErroGoogleDrive('enviar_pacote', 'Não foi possível confirmar o progresso do envio ao Google Drive.', 'rede_indisponivel');
          continue;
        }
        if (estado.ok) return this.lerArquivoEnviado(estado);
        if (estado.status === 308) {
          proximoByte = this.proximoByteRecebido(estado, size);
          continue;
        }
        if (estado.status === 404) {
          const existente = await this.localizarArquivoPorOperacao(usuarioId, operacaoId, dadosPrivados);
          if (existente) return existente;
          reiniciarSessao = true;
          break;
        }
        if (estado.status !== 429 && estado.status < 500) throw new ErroGoogleDrive('enviar_pacote', 'O Google Drive recusou a confirmação do envio.', `http_${estado.status}`);
        if (recuperacoes >= TENTATIVAS_RECUPERACAO_UPLOAD) {
          throw new ErroGoogleDrive('enviar_pacote', 'Não foi possível confirmar o progresso do envio ao Google Drive.', `http_${estado.status}`);
        }
        recuperacoes += 1;
        await this.aguardarRecuperacaoUpload(this.esperaRecuperacaoUpload(estado));
      }

      if (reiniciarSessao) {
        if (recuperacoes >= TENTATIVAS_RECUPERACAO_UPLOAD) throw new ErroGoogleDrive('enviar_pacote', 'A sessão de envio expirou. Tente novamente.', 'sessao_upload_expirada');
        recuperacoes += 1;
        continue;
      }
    }
    throw new ErroGoogleDrive('enviar_pacote', 'Não foi possível concluir o envio ao Google Drive.', 'tentativas_upload_esgotadas');
  }

  private async enviarControlePrivado(usuarioId: string, raizId: string, controle: ControleGoogleDrive): Promise<void> {
    const diretorio = await mkdtemp(path.join(app.getPath('userData'), 'google-drive-controle-'));
    const arquivo = path.join(diretorio, 'chave-recuperacao.json');
    try {
      await (await import('node:fs/promises')).writeFile(arquivo, JSON.stringify(controle), { mode: 0o600 });
      await this.enviarArquivo(usuarioId, arquivo, { name: 'chave-recuperacao-v1', parents: ['appDataFolder'], mimeType: 'application/json', appProperties: { lawdoControlePrivado: '1', lawdoRaizId: raizId } });
    } finally { await rm(diretorio, { recursive: true, force: true }).catch(() => undefined); }
  }

  private async lerControle(usuarioId: string, controleId: string): Promise<Buffer> {
    const diretorio = await mkdtemp(path.join(app.getPath('userData'), 'google-drive-controle-'));
    try {
      const arquivo = path.join(diretorio, 'controle.json');
      await this.baixarArquivo(usuarioId, controleId, arquivo);
      const bruto: unknown = JSON.parse(await readFile(arquivo, 'utf8'));
      if (!bruto || typeof bruto !== 'object' || (bruto as Record<string, unknown>).formato !== 1 || typeof (bruto as Record<string, unknown>).chave !== 'string') throw new Error('Arquivo de controle inválido.');
      const chave = Buffer.from((bruto as Record<string, string>).chave, 'base64');
      if (chave.length !== 32) throw new Error('Chave de cifragem inválida.');
      return chave;
    } catch (erro) {
      throw new ErroGoogleDrive('verificar_pacote', 'A chave de recuperação dos backups não está disponível.', erro instanceof Error ? 'chave_indisponivel' : 'chave_invalida');
    } finally { await rm(diretorio, { recursive: true, force: true }).catch(() => undefined); }
  }

  private async controlesLegados(usuarioId: string, raizId: string): Promise<ArquivoDrive[]> {
    return this.listar(usuarioId, `'${escaparConsultaDrive(raizId)}' in parents and trashed = false and appProperties has { key='lawdoControle' and value='1' }`, 'id,name,appProperties');
  }

  private async controlesPrivados(usuarioId: string, raizId: string): Promise<ArquivoDrive[]> {
    return this.listarDadosApp(usuarioId, `trashed = false and appProperties has { key='lawdoControlePrivado' and value='1' } and appProperties has { key='lawdoRaizId' and value='${escaparConsultaDrive(raizId)}' }`, 'id,name,appProperties');
  }

  private async enviarParaLixeira(usuarioId: string, arquivoId: string): Promise<boolean> {
    const resposta = await this.requisitar(usuarioId, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(arquivoId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
    });
    return resposta.ok || resposta.status === 404;
  }

  private async validarBackupComChave(usuarioId: string, backupId: string, chave: Buffer): Promise<void> {
    const diretorio = await mkdtemp(path.join(app.getPath('userData'), 'google-drive-validacao-chave-'));
    try {
      const cifrado = path.join(diretorio, 'backup.lawdo');
      const pacote = path.join(diretorio, 'backup.bkp');
      await this.baixarArquivo(usuarioId, backupId, cifrado);
      await decifrarPacoteGoogleDrive(cifrado, pacote, chave);
      await lerBkpLaudo(pacote, path.join(diretorio, 'conteudo'));
    } catch (erro) {
      throw new ErroGoogleDrive('migrar_chave', 'A chave privada não conseguiu validar um backup existente. O arquivo de controle legado foi preservado.', erro instanceof Error ? 'validacao_falhou' : 'erro_desconhecido');
    } finally { await rm(diretorio, { recursive: true, force: true }).catch(() => undefined); }
  }

  private async migrarControleLegado(usuarioId: string, raizId: string): Promise<void> {
    await this.verificarAcessoDadosApp(usuarioId);
    const [legados, privados] = await Promise.all([this.controlesLegados(usuarioId, raizId), this.controlesPrivados(usuarioId, raizId)]);
    if (legados.length > 1 || privados.length > 1) throw new ErroGoogleDrive('migrar_chave', 'Foram encontrados arquivos de controle duplicados. A integração foi pausada para proteção dos backups.', 'controles_duplicados');
    if (!legados.length) return;

    const chaveLegada = await this.lerControle(usuarioId, legados[0].id);
    let chavePrivada = chaveLegada;
    if (privados.length) {
      chavePrivada = await this.lerControle(usuarioId, privados[0].id);
      if (!chavePrivada.equals(chaveLegada)) throw new ErroGoogleDrive('migrar_chave', 'As chaves privada e legada são diferentes. A integração foi pausada e o arquivo legado foi preservado.', 'chaves_divergentes');
    } else {
      await this.enviarControlePrivado(usuarioId, raizId, { formato: 1, chave: chaveLegada.toString('base64') });
      const criados = await this.controlesPrivados(usuarioId, raizId);
      if (criados.length !== 1) throw new ErroGoogleDrive('migrar_chave', 'Não foi possível confirmar a chave privada no Google Drive.', 'chave_privada_indisponivel');
      chavePrivada = await this.lerControle(usuarioId, criados[0].id);
      if (!chavePrivada.equals(chaveLegada)) throw new ErroGoogleDrive('migrar_chave', 'A chave privada não corresponde à chave dos backups existentes.', 'chaves_divergentes');
    }

    const backup = (await this.listarDescendentes(usuarioId, raizId)).find(item => item.appProperties?.lawdoBackup === '1' && item.appProperties?.lawdoRaizId === raizId);
    if (backup) await this.validarBackupComChave(usuarioId, backup.id, chavePrivada);
    await this.enviarParaLixeira(usuarioId, legados[0].id);
  }

  private async obterChavePacote(usuarioId: string, raizId: string): Promise<Buffer> {
    await this.verificarAcessoDadosApp(usuarioId);
    await this.migrarControleLegado(usuarioId, raizId);
    const controles = await this.controlesPrivados(usuarioId, raizId);
    if (controles.length > 1) throw new ErroGoogleDrive('verificar_pacote', 'Foram encontrados arquivos privados de controle duplicados. A integração foi pausada para proteção dos backups.', 'controles_duplicados');
    if (controles.length === 1) return this.lerControle(usuarioId, controles[0].id);
    const backups = (await this.listarDescendentes(usuarioId, raizId)).filter(item => item.appProperties?.lawdoBackup === '1');
    if (backups.length) throw new ErroGoogleDrive('verificar_pacote', 'Há cópias no Google Drive, mas a chave privada de recuperação não foi encontrada. Novos envios foram suspensos.', 'chave_ausente');
    const chave = criarChavePacoteGoogleDrive();
    await this.enviarControlePrivado(usuarioId, raizId, { formato: 1, chave: chave.toString('base64') });
    return chave;
  }

  async obterRaiz(usuarioId: string, sinal?: AbortSignal): Promise<string> {
    const filtro = "trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='lawdoRaiz' and value='1' }";
    const encontrados = await this.listar(usuarioId, filtro, 'id,name,parents,appProperties', sinal);
    if (encontrados.length > 1) throw new ErroGoogleDrive('localizar_raiz_drive', 'Foram encontradas raízes laWdo duplicadas. A integração foi pausada para proteção dos backups.', 'raizes_duplicadas');
    if (encontrados.length === 1) {
      const raiz = encontrados[0];
      const naRaiz = await this.listar(usuarioId, `'root' in parents and ${filtro}`, 'id,name', sinal);
      if (raiz.name !== 'laWdo' || !naRaiz.some(item => item.id === raiz.id)) throw new ErroGoogleDrive('localizar_raiz_drive', 'A pasta laWdo foi movida ou alterada. Restaure-a para Meu Drive antes de continuar.', 'raiz_movida');
      return raiz.id;
    }
    const homonimas = await this.listar(usuarioId, `'root' in parents and trashed = false and mimeType = '${MIME_PASTA}' and name = 'laWdo'`, 'id,name,appProperties', sinal);
    if (homonimas.length) throw new ErroGoogleDrive('localizar_raiz_drive', 'Já existe uma pasta laWdo em Meu Drive que não pertence a esta integração. Ela foi preservada; renomeie-a ou solicite suporte antes de conectar.', 'conflito_raiz_homonima');
    const resposta = await this.requisitar(usuarioId, 'https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'laWdo', mimeType: MIME_PASTA, parents: ['root'], appProperties: { lawdoRaiz: '1' } }), signal: sinal });
    const criada: unknown = await resposta.json();
    if (!resposta.ok || !criada || typeof criada !== 'object' || typeof (criada as Record<string, unknown>).id !== 'string') throw new ErroGoogleDrive('criar_raiz_drive', 'Não foi possível criar a pasta laWdo no Meu Drive.', `http_${resposta.status}`);
    return String((criada as Record<string, unknown>).id);
  }

  async estadoRapido(usuarioId: string): Promise<EstadoGoogleDrive> {
    const automatico = (await configuracaoService.obter(chave('automatico', usuarioId))) === 'true';
    const fila = await this.obterFila(usuarioId);
    const pendencias = fila.length;
    const falhaFila = fila.find(item => item.ultimoErro)?.ultimoErro;
    const filaAguardaCorrecao = fila.some(item => item.estado === 'aguardando_correcao');
    const filaAguardaEspaco = fila.some(item => item.motivoEspera === 'cota');
    const base = { conectado: false, envioAutomatico: automatico, pendencias, caminho: 'Meu Drive/laWdo', falhaFila, filaAguardaCorrecao, filaAguardaEspaco };
    if (!safeStorageService.isSecurelyAvailable()) return { ...base, protecaoChave: 'indisponivel', aviso: 'A proteção local de credenciais não está disponível neste dispositivo. A conexão com o Google Drive foi bloqueada.' };
    if (!await obterSegredoClienteGoogleDrive()) {
      return { ...base, protecaoChave: 'indisponivel', aviso: 'A integração Google Drive precisa ser configurada pelo responsável.' };
    }
    const tokens = await this.obterTokens(usuarioId);
    if (!tokens) return base;
    if (!temEscopoDadosApp(tokens)) {
      return { conectado: false, envioAutomatico: automatico, pendencias, caminho: 'Meu Drive/laWdo', falhaFila, filaAguardaCorrecao, filaAguardaEspaco, protecaoChave: 'reconexao_necessaria', aviso: 'Reconecte a conta institucional para proteger a chave de recuperação na área privada do Google Drive.' };
    }
    const email = await configuracaoService.obter(chave('email', usuarioId));
    return { conectado: Boolean(email), email: email ?? undefined, caminho: 'Meu Drive/laWdo', envioAutomatico: automatico, pendencias, falhaFila, filaAguardaCorrecao, filaAguardaEspaco };
  }

  async estado(usuarioId: string): Promise<EstadoGoogleDrive> {
    const rapido = await this.estadoRapido(usuarioId);
    if (!rapido.conectado || rapido.protecaoChave === 'reconexao_necessaria') return rapido;
    const { envioAutomatico: automatico, pendencias, falhaFila, filaAguardaCorrecao, filaAguardaEspaco } = rapido;
    try {
      const raizId = await this.obterRaiz(usuarioId);
      await this.verificarAcessoDadosApp(usuarioId);
      const email = await configuracaoService.obter(chave('email', usuarioId));
      const resposta = await this.requisitar(usuarioId, 'https://www.googleapis.com/drive/v3/about?fields=storageQuota');
      const dados: unknown = await resposta.json(); const quota = dados && typeof dados === 'object' ? (dados as { storageQuota?: Record<string, unknown> }).storageQuota : undefined;
      const [privados, legados, backups] = await Promise.all([
        this.controlesPrivados(usuarioId, raizId),
        this.controlesLegados(usuarioId, raizId),
        this.listarDescendentes(usuarioId, raizId),
      ]);
      if (privados.length > 1 || legados.length > 1) throw new ErroGoogleDrive('verificar_pacote', 'Foram encontrados arquivos de controle duplicados. A integração foi pausada para proteção dos backups.', 'controles_duplicados');
      if (privados.length) {
        const chavePrivada = await this.lerControle(usuarioId, privados[0].id);
        if (legados.length) {
          const chaveLegada = await this.lerControle(usuarioId, legados[0].id);
          if (!chavePrivada.equals(chaveLegada)) throw new ErroGoogleDrive('migrar_chave', 'As chaves privada e legada são diferentes. A integração foi pausada e o arquivo legado foi preservado.', 'chaves_divergentes');
        }
      }
      const possuiBackups = backups.some(item => item.appProperties?.lawdoBackup === '1' && item.appProperties?.lawdoRaizId === raizId);
      const ultimoEnvioEm = await configuracaoService.obter(chave('ultimo_envio', usuarioId));
      const backupsBytes = backups.filter(item => item.appProperties?.lawdoBackup === '1' && item.appProperties?.lawdoRaizId === raizId).reduce((total, item) => total + Number(item.size ?? 0), 0);
      const base = { conectado: true, email: email ?? undefined, caminho: 'Meu Drive/laWdo', envioAutomatico: automatico, pendencias, falhaFila, filaAguardaCorrecao, filaAguardaEspaco, ultimoEnvioEm: ultimoEnvioEm ?? undefined, usoBytes: Number(quota?.usage ?? 0), limiteBytes: quota?.limit ? Number(quota.limit) : undefined, backupsBytes, limiteBackupsBytes: LIMITE_BACKUPS_BYTES, backupsDisponiveisBytes: Math.max(0, LIMITE_BACKUPS_BYTES - backupsBytes), percentualBackups: Math.min(100, backupsBytes / LIMITE_BACKUPS_BYTES * 100) };
      if (legados.length) return { ...base, protecaoChave: 'migracao_pendente', aviso: 'A migração da chave foi concluída, mas a limpeza do arquivo controle.lawdo legado será retomada automaticamente.' };
      if (!privados.length && possuiBackups) return { ...base, protecaoChave: 'indisponivel', aviso: 'Há backups no Drive, mas a chave privada de recuperação não está disponível. Envio, verificação e restauração foram suspensos.' };
      return { ...base, protecaoChave: privados.length ? 'protegida' : 'aguardando_primeiro_envio' };
    } catch (erro) { return { conectado: false, envioAutomatico: automatico, pendencias, caminho: 'Meu Drive/laWdo', falhaFila, filaAguardaCorrecao, filaAguardaEspaco, aviso: erro instanceof Error ? erro.message : 'Erro ao consultar o Drive.' }; }
  }

  async abrirPasta(usuarioId: string): Promise<void> {
    const estado = await this.estadoRapido(usuarioId);
    if (!estado.conectado) throw new ErroGoogleDrive('localizar_raiz_drive', 'Conecte uma conta institucional antes de abrir a pasta do laWdo.', 'conta_nao_conectada');
    const raizId = await this.obterRaiz(usuarioId);
    try {
      await shell.openExternal(`https://drive.google.com/drive/u/0/folders/${encodeURIComponent(raizId)}`);
    } catch {
      throw new ErroGoogleDrive('localizar_raiz_drive', 'Não foi possível abrir a pasta do laWdo no navegador.', 'abrir_navegador');
    }
  }

  async resumo(usuarioId: string, forcarAtualizacao = false): Promise<ResumoGoogleDrive> {
    const rapido = await this.estadoRapido(usuarioId);
    if (!rapido.conectado || !rapido.email) return { estado: rapido, copias: [], origem: 'cache' };
    const cache = await this.obterCacheResumo(usuarioId);
    const cacheValido = cache?.email === rapido.email && Date.now() - new Date(cache.atualizadoEm).getTime() < DURACAO_CACHE_RESUMO_MS;
    if (cache && cacheValido && !forcarAtualizacao) {
      return {
        estado: { ...cache.estado, ...rapido },
        copias: cache.copias,
        atualizadoEm: cache.atualizadoEm,
        origem: 'cache',
      };
    }
    const [estado, copias] = await Promise.all([this.estado(usuarioId), this.listarCopias(usuarioId).catch(() => null)]);
    if (estado.conectado && copias) {
      await this.salvarCacheResumo(usuarioId, rapido.email, estado, copias);
      return { estado, copias, atualizadoEm: new Date().toISOString(), origem: 'drive' };
    }
    if (cache?.email === rapido.email) {
      return {
        estado: { ...cache.estado, ...rapido, aviso: estado.aviso ?? 'Não foi possível atualizar as cópias no Google Drive. Exibindo a última lista disponível.' },
        copias: cache.copias,
        atualizadoEm: cache.atualizadoEm,
        origem: 'cache',
        desatualizado: true,
      };
    }
    return { estado, copias: [], origem: 'drive' };
  }

  async resumoCache(usuarioId: string): Promise<ResumoGoogleDrive | null> {
    const rapido = await this.estadoRapido(usuarioId);
    if (!rapido.conectado || !rapido.email) return null;
    const cache = await this.obterCacheResumo(usuarioId);
    if (!cache || cache.email !== rapido.email) return null;
    return {
      estado: { ...cache.estado, ...rapido },
      copias: cache.copias,
      atualizadoEm: cache.atualizadoEm,
      origem: 'cache',
      desatualizado: Date.now() - new Date(cache.atualizadoEm).getTime() >= DURACAO_CACHE_RESUMO_MS,
    };
  }

  async definirEnvioAutomatico(usuarioId: string, ativo: boolean) {
    if (ativo) {
      const estado = await this.estadoRapido(usuarioId);
      if (!estado.conectado || !estado.email) throw new ErroGoogleDrive('enviar_pacote', 'Conecte uma conta institucional antes de habilitar o envio automático.', 'conta_nao_conectada');
    }
    await configuracaoService.salvar(chave('automatico', usuarioId), String(ativo), 'texto', 'Envio automático ao Google Drive');
    if (ativo) void this.processarFila(usuarioId);
    return this.estadoRapido(usuarioId);
  }

  async enfileirarConclusao(usuarioId: string, laudoId: string): Promise<void> {
    if ((await configuracaoService.obter(chave('automatico', usuarioId))) !== 'true') return;
    const contaGoogle = await configuracaoService.obter(chave('email', usuarioId));
    if (!contaGoogle) return;
    const fila = await this.obterFila(usuarioId);
    const indice = fila.findIndex(item => item.laudoId === laudoId && item.contaGoogle === contaGoogle);
    const novoItem: ItemFilaGoogleDrive = { laudoId, contaGoogle, enfileiradoEm: new Date().toISOString(), tentativas: 0, estado: 'pendente' };
    if (indice >= 0) fila[indice] = novoItem;
    else fila.push(novoItem);
    await this.salvarFila(usuarioId, fila);
    void this.processarFila(usuarioId);
  }

  async retomarFila(usuarioId: string): Promise<void> {
    void this.processarFila(usuarioId);
  }

  private async processarFila(usuarioId: string): Promise<void> {
    if (this.processamentosFila.has(usuarioId)) return this.processamentosFila.get(usuarioId)!;
    const processamento = (async () => {
      const fila = await this.obterFila(usuarioId);
      if (!fila.length) return;
      const contaGoogle = await configuracaoService.obter(chave('email', usuarioId));
      if (!contaGoogle) return;
      let houveFalha = false;
      const restante: ItemFilaGoogleDrive[] = [];
      for (const item of fila) {
        if (item.contaGoogle !== contaGoogle) {
          restante.push(item);
          continue;
        }
        if (item.estado === 'aguardando_correcao' && item.motivoEspera !== 'cota' && item.versaoValidacao === VERSAO_VALIDACAO_FILA) {
          restante.push(item);
          continue;
        }
        try {
          await this.enviarLaudo(usuarioId, item.laudoId, false, true);
        } catch (erro) {
          const detalhe = erro instanceof Error ? erro.message : 'erro_inesperado';
          const erroDrive = erro instanceof ErroGoogleDrive ? erro : undefined;
          if (erroDrive?.codigo === 'laudo_nao_concluido' || erroDrive?.codigo === 'laudo_invalido') {
            log.info('Item removido da fila do Google Drive porque o laudo não está mais elegível.', { laudoId: item.laudoId, codigo: erroDrive.codigo });
            continue;
          }
          const requerCorrecao = erroDrive?.codigo === 'conteudo_imagem_externa';
          const requerEspaco = erroDrive?.codigo === 'cota_backups_excedida' || erroDrive?.codigo === 'cota_conta_excedida';
          houveFalha ||= !requerCorrecao && !requerEspaco;
          log.warn('Falha no envio automático do backup Google Drive.', {
            laudoId: item.laudoId,
            tentativa: item.tentativas + 1,
            etapa: erroDrive?.etapa ?? 'desconhecida',
            codigo: erroDrive?.codigo ?? 'erro_inesperado',
            detalhe,
          });
          this.registradorDiagnostico?.({
            evento: 'envio_automatico_falhou',
            etapa: erroDrive?.etapa ?? 'desconhecida',
            codigo: erroDrive?.codigo ?? 'erro_inesperado',
            tentativa: item.tentativas + 1,
          });
          restante.push({
            ...item,
            tentativas: item.tentativas + 1,
            ultimoErro: erro instanceof Error ? erro.message : 'Não foi possível enviar a cópia automaticamente.',
            estado: requerCorrecao || requerEspaco ? 'aguardando_correcao' : 'pendente',
            versaoValidacao: requerCorrecao ? VERSAO_VALIDACAO_FILA : undefined,
            motivoEspera: requerCorrecao ? 'conteudo' : requerEspaco ? 'cota' : undefined,
          });
        }
      }
      await this.salvarFila(usuarioId, restante);
      if (houveFalha) this.agendarProcessamentoFila(usuarioId);
    })().catch(erro => {
      log.warn('Não foi possível processar a fila de backups Google Drive.', { erro: erro instanceof Error ? erro.message : 'erro_inesperado' });
      const erroDrive = erro instanceof ErroGoogleDrive ? erro : undefined;
      this.registradorDiagnostico?.({
        evento: 'envio_automatico_falhou',
        etapa: erroDrive?.etapa ?? 'desconhecida',
        codigo: erroDrive?.codigo ?? 'erro_inesperado',
        tentativa: 0,
      });
      this.agendarProcessamentoFila(usuarioId);
    }).finally(() => {
      this.processamentosFila.delete(usuarioId);
    });
    this.processamentosFila.set(usuarioId, processamento);
    return processamento;
  }

  async listarLaudosConcluidos(usuarioId: string): Promise<LaudoElegivelGoogleDrive[]> {
    return executeQuery<{ id: string; numero: string; data_conclusao: string }>(
      "SELECT l.id, r.numero, l.data_conclusao FROM laudos l JOIN reps r ON r.id = l.rep_id WHERE l.perito_id = ? AND l.status IN ('Concluído', 'Entregue') AND l.data_conclusao IS NOT NULL ORDER BY l.data_conclusao DESC",
      [usuarioId],
    ).then(laudos => laudos.map(laudo => ({ id: laudo.id, numeroRep: laudo.numero, concluidoEm: laudo.data_conclusao })));
  }

  async listarCopias(usuarioId: string, sinal?: AbortSignal): Promise<CopiaGoogleDrive[]> {
    const raiz = await this.obterRaiz(usuarioId, sinal);
    const arquivos = await this.listarDescendentes(usuarioId, raiz, sinal);
    const verificacoes = await this.obterVerificacoes(usuarioId);
    return arquivos.filter(item => item.appProperties?.lawdoBackup === '1' && item.appProperties?.lawdoRaizId === raiz).map(item => {
      const revisao = item.appProperties?.lawdoHash ?? item.version ?? '';
      return { id: item.id, laudoId: item.appProperties?.lawdoLaudoId ?? '', numeroRep: item.appProperties?.lawdoNumeroRep ?? '', nome: item.name, tamanho: Number(item.size ?? 0), modificadaEm: item.modifiedTime ?? '', revisao, verificadaEm: verificacoes[revisao] };
    });
  }

  async enviarLaudo(usuarioId: string, laudoId: string, confirmarSubstituicao: boolean, automatico = false): Promise<CopiaGoogleDrive> {
    const [laudo] = await executeQuery<{ id: string; status: string; data_conclusao: string | null; updated_at: string | null; versao: number; numero: string }>(
      'SELECT l.id, l.status, l.data_conclusao, l.updated_at, l.versao, r.numero FROM laudos l JOIN reps r ON r.id = l.rep_id WHERE l.id = ?', [laudoId],
    );
    if (!laudo || !/^[\w-]+$/.test(laudoId)) throw new ErroGoogleDrive('criar_pacote', 'Laudo inválido para envio.', 'laudo_invalido');
    const envioManualEmAndamento = !automatico && laudo.status === 'Em andamento';
    if (!envioManualEmAndamento && !['Concluído', 'Entregue'].includes(laudo.status)) throw new ErroGoogleDrive('criar_pacote', 'Somente laudos concluídos, entregues ou em andamento podem ser enviados ao Google Drive.', 'laudo_nao_elegivel');
    const dataReferencia = laudo.data_conclusao ?? laudo.updated_at;
    if (!dataReferencia) throw new ErroGoogleDrive('criar_pacote', 'O laudo não possui uma data válida para organizar a cópia no Google Drive.', 'data_referencia_ausente');
    const conclusao = new Date(dataReferencia);
    if (Number.isNaN(conclusao.getTime())) throw new ErroGoogleDrive('criar_pacote', 'A data de referência do laudo é inválida.', 'data_referencia_invalida');
    const raizId = await this.obterRaiz(usuarioId);
    const copiasAtuais = await this.listarCopiasDoLaudo(usuarioId, raizId, laudo.id);
    const revisoes = await this.obterRevisoes(usuarioId);
    const revisaoConhecida = revisoes[laudo.id];
    const revisaoRemotaConhecida = Boolean(revisaoConhecida) && copiasAtuais.every(copia => copia.revisao === revisaoConhecida);
    if (automatico && copiasAtuais.length && !revisaoRemotaConhecida) {
      throw new ErroGoogleDrive('enviar_pacote', 'A cópia remota foi alterada por outra instalação. Faça um envio manual para decidir a substituição.', 'divergencia_remota');
    }
    if (!automatico && copiasAtuais.length && !confirmarSubstituicao) throw new ErroGoogleDrive('enviar_pacote', 'Já existe uma cópia vigente deste laudo. Confirme a substituição para continuar.', 'substituicao_nao_confirmada');
    const temporario = await mkdtemp(path.join(app.getPath('userData'), 'google-drive-laudo-'));
    let etapa: 'criar_pacote' | 'enviar_pacote' = 'criar_pacote';
    try {
      const pacote = path.join(temporario, 'backup.bkp');
      const cifrado = path.join(temporario, 'backup.lawdo');
      await exportarBkpLaudo(laudo.id, pacote, { incluirApresentacao: true });
      const hash = await hashArquivo(pacote);
      const existenteIgual = copiasAtuais.find(copia => copia.revisao === hash);
      if (existenteIgual) {
        await this.registrarRevisao(usuarioId, laudo.id, existenteIgual.revisao);
        await this.invalidarCacheResumo(usuarioId);
        return existenteIgual;
      }
      etapa = 'enviar_pacote';
      const chavePacote = await this.obterChavePacote(usuarioId, raizId);
      await cifrarPacoteGoogleDrive(pacote, cifrado, chavePacote);
      await this.conferirCotaAntesDoEnvio(usuarioId, raizId, (await stat(cifrado)).size);
      const ano = String(conclusao.getUTCFullYear());
      const mes = String(conclusao.getUTCMonth() + 1).padStart(2, '0');
      const { numeroFormatado } = obterIdentificacaoBkpLaudo(laudo.numero);
      const nomeArquivoDrive = `${numeroFormatado}.laWdo`;
      const pastaAno = await this.criarPasta(usuarioId, ano, raizId, raizId);
      const pastaMes = await this.criarPasta(usuarioId, mes, pastaAno, raizId);
      const pastaLaudo = await this.criarPasta(usuarioId, nomePastaLaudo(numeroFormatado), pastaMes, raizId);
      const enviada = await this.enviarArquivo(usuarioId, cifrado, {
        name: nomeArquivoDrive, parents: [pastaLaudo], mimeType: 'application/octet-stream',
        appProperties: { lawdoBackup: '1', lawdoRaizId: raizId, lawdoLaudoId: laudo.id, lawdoNumeroRep: laudo.numero, lawdoHash: hash, lawdoVersao: String(laudo.versao) },
      });
      const validacao = path.join(temporario, 'validacao.lawdo');
      const conteudo = path.join(temporario, 'conteudo');
      await this.baixarArquivo(usuarioId, enviada.id, validacao);
      await decifrarPacoteGoogleDrive(validacao, path.join(temporario, 'validacao.bkp'), chavePacote);
      await lerBkpLaudo(path.join(temporario, 'validacao.bkp'), conteudo);
      const copiasAntesDaSubstituicao = await this.listarCopiasDoLaudo(usuarioId, raizId, laudo.id);
      const anterioresAtuais = copiasAntesDaSubstituicao.filter(copia => copia.id !== enviada.id);
      const mesmasCopias = anterioresAtuais.length === copiasAtuais.length
        && anterioresAtuais.every(copia => copiasAtuais.some(anterior => anterior.id === copia.id && anterior.versaoDrive === copia.versaoDrive));
      if (!mesmasCopias) {
        throw new ErroGoogleDrive('enviar_pacote', 'Uma cópia remota foi alterada durante o envio. A cópia anterior foi preservada.', 'divergencia_remota');
      }
      for (const copia of copiasAtuais) {
        const resposta = await this.requisitar(usuarioId, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(copia.id)}`, { method: 'DELETE' });
        if (!resposta.ok && resposta.status !== 404) throw new ErroGoogleDrive('enviar_pacote', 'A nova cópia foi validada, mas não foi possível remover a cópia anterior.', `http_${resposta.status}`);
      }
      const copia = { id: enviada.id, laudoId: laudo.id, numeroRep: laudo.numero, nome: nomeArquivoDrive, tamanho: Number(enviada.size ?? 0), modificadaEm: enviada.modifiedTime ?? new Date().toISOString(), revisao: hash };
      await this.registrarRevisao(usuarioId, laudo.id, hash);
      await configuracaoService.salvar(chave('ultimo_envio', usuarioId), new Date().toISOString(), 'texto', 'Último envio ao Google Drive');
      await this.invalidarCacheResumo(usuarioId);
      return copia;
    } catch (erro) {
      if (erro instanceof ErroGoogleDrive) throw erro;
      const detalhe = erro instanceof Error ? erro.message : 'erro_inesperado';
      if (etapa === 'criar_pacote' && /imagem externa não permitida no BKP/i.test(detalhe)) {
        throw new ErroGoogleDrive('criar_pacote', 'Uma pendência possui uma imagem externa e não pode ser copiada com segurança. Reabra o laudo, substitua a imagem por uma figura anexada e conclua novamente.', 'conteudo_imagem_externa');
      }
      log.warn('Falha não classificada ao enviar backup Google Drive.', {
        laudoId,
        automatico,
        etapa,
        detalhe,
      });
      const mensagem = etapa === 'criar_pacote'
        ? 'Não foi possível preparar o backup local. Verifique a integridade do laudo e das figuras utilizadas.'
        : 'Não foi possível concluir o envio do backup ao Google Drive.';
      throw new ErroGoogleDrive(etapa, mensagem, 'falha_nao_classificada');
    } finally { await rm(temporario, { recursive: true, force: true }).catch(() => undefined); }
  }

  async verificar(usuarioId: string, copiaId: string, sinal?: AbortSignal, aoProgresso?: (recebidos: number, total?: number) => void): Promise<{ previa: import('../../shared/types/laudo-bkp.types.js').PreviaBkpLaudo }> {
    const temporario = await mkdtemp(path.join(app.getPath('userData'), 'google-drive-verificacao-'));
    try {
      const { pacote, revisao } = await this.lerPacoteCopia(usuarioId, copiaId, temporario, sinal, aoProgresso);
      await this.registrarVerificacaoConcluida(usuarioId, revisao);
      return { previa: { numeroRep: pacote.rep.numero, tipoExame: `${pacote.tipoExame.codigo} — ${pacote.tipoExame.nome}`, status: pacote.laudo.status, figuras: pacote.imagens.length, substituiRep: false, substituiLaudo: false } };
    } finally { await rm(temporario, { recursive: true, force: true }).catch(() => undefined); }
  }

  async conferirCopiaAtual(usuarioId: string, copiaId: string, revisaoEsperada: string): Promise<CopiaGoogleDrive> {
    const copia = (await this.listarCopias(usuarioId)).find(item => item.id === copiaId);
    if (!copia) throw new ErroGoogleDrive('verificar_pacote', 'A cópia não pertence mais à pasta do laWdo.', 'copia_fora_da_raiz');
    if (copia.revisao !== revisaoEsperada) throw new ErroGoogleDrive('verificar_pacote', 'A cópia foi alterada desde a última consulta. Atualize a lista antes de continuar.', 'revisao_alterada');
    return copia;
  }

  async moverParaLixeira(usuarioId: string, copiaId: string, revisaoEsperada: string): Promise<void> {
    await this.conferirCopiaAtual(usuarioId, copiaId, revisaoEsperada);
    const pastaRep = await this.obterPastaExclusivaDaCopia(usuarioId, copiaId);
    const resposta = await this.requisitar(usuarioId, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(pastaRep.id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
    });
    if (!resposta.ok) throw new ErroGoogleDrive('enviar_pacote', 'Não foi possível enviar a pasta da cópia para a Lixeira do Google Drive.', `http_${resposta.status}`);
    await this.invalidarCacheResumo(usuarioId);
  }

  async lerPacoteCopia(usuarioId: string, copiaId: string, diretorio: string, sinal?: AbortSignal, aoProgresso?: (recebidos: number, total?: number) => void): Promise<{ pacote: PacoteLaudo; hashCifrado: string; revisao: string }> {
    if (!/^[\w-]+$/.test(copiaId)) throw new ErroGoogleDrive('verificar_pacote', 'Cópia inválida.', 'copia_invalida');
    const copia = (await this.listarCopias(usuarioId, sinal)).find(item => item.id === copiaId);
    if (!copia) throw new ErroGoogleDrive('verificar_pacote', 'A cópia não pertence à pasta do laWdo.', 'copia_fora_da_raiz');
    const raizId = await this.obterRaiz(usuarioId, sinal);
    const chave = await this.obterChavePacote(usuarioId, raizId);
    const cifrado = path.join(diretorio, 'backup.lawdo');
    const arquivo = path.join(diretorio, 'backup.bkp');
    await this.baixarArquivo(usuarioId, copia.id, cifrado, sinal, aoProgresso);
    const hashCifrado = await hashArquivo(cifrado);
    await decifrarPacoteGoogleDrive(cifrado, arquivo, chave);
    const pacote = await lerBkpLaudo(arquivo, path.join(diretorio, 'conteudo'));
    return { pacote, hashCifrado, revisao: copia.revisao };
  }
}

export const googleDriveService = new GoogleDriveService();
