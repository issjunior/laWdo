import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { app } from 'electron';
import { getLogger } from '../utils/logger.js';
import { configuracaoService } from './configuracao.service.js';

const log = getLogger('gdl');

export interface GdlCredenciais {
  baseUrl: string;
  login: string;
  senha: string;
  cpfUsuario?: string;
}

export interface GdlCredenciaisEntrada {
  login: string;
  senha: string;
  cpfUsuario?: string;
}

export interface GdlTesteResultado {
  sucesso: boolean;
  latencia: number;
  statusCode: number;
  autenticado: boolean;
  ambiente: string;
  endpointTestado: string;
  erro?: string;
  rede?: GdlTesteEtapa;
}

export interface GdlTesteEtapa {
  sucesso: boolean;
  latencia: number;
  statusCode: number;
  endpointTestado: string;
  erro?: string;
}

export interface GdlOrigem {
  tipo: string;
  numero: string;
}

export interface GdlPeca {
  codPeca: number;
  tipoPeca: string;
  identificacao: string;
  quantidade: number;
  unidadeMedida: string;
  examinadoInLoco: string;
  numeroAnalises: string;
  dataEntrada: string;
  consumida: string;
}

export interface GdlAndamento {
  dataHora: string;
  nomeUsuario: string;
  descricao: string;
}

export interface GdlRepData {
  codRep: number;
  numero: number;
  ano: number;
  origens: GdlOrigem[];
  pecas: GdlPeca[];
  andamentos: GdlAndamento[];
}

export interface GdlConsultaResultado {
  sucesso: boolean;
  dados: GdlRepData | null;
  erro?: string;
}

export interface GdlValidacaoSessao {
  ambiente: string;
  validado: boolean;
  numeroRep?: string;
  anoRep?: string;
  dataHora?: string;
}

type AmbienteGdl = 'homologacao' | 'producao';

const GDL_ESTADO_DIR = path.join(app.getPath('userData'), 'gdl');
const GDL_ESTADO_FILE = path.join(GDL_ESTADO_DIR, 'validacao-sessao.json');

const validacaoSessaoGdl: Record<AmbienteGdl, GdlValidacaoSessao> = {
  homologacao: {
    ambiente: 'Homologação',
    validado: false,
  },
  producao: {
    ambiente: 'Produção',
    validado: false,
  },
};

function criarEstadoPadrao(): Record<AmbienteGdl, GdlValidacaoSessao> {
  return {
    homologacao: {
      ambiente: 'Homologação',
      validado: false,
    },
    producao: {
      ambiente: 'Produção',
      validado: false,
    },
  };
}

function persistirValidacaoSessao(): void {
  try {
    fs.mkdirSync(GDL_ESTADO_DIR, { recursive: true });
    fs.writeFileSync(GDL_ESTADO_FILE, JSON.stringify(validacaoSessaoGdl, null, 2), 'utf-8');
  } catch (error) {
    log.warn('Falha ao persistir validação de sessão GDL', { error });
  }
}

function carregarValidacaoSessaoPersistida(): void {
  try {
    if (!fs.existsSync(GDL_ESTADO_FILE)) {
      return;
    }

    const conteudo = fs.readFileSync(GDL_ESTADO_FILE, 'utf-8');
    const parsed = JSON.parse(conteudo) as Partial<Record<AmbienteGdl, GdlValidacaoSessao>>;

    validacaoSessaoGdl.homologacao = {
      ...criarEstadoPadrao().homologacao,
      ...(parsed.homologacao || {}),
      ambiente: 'Homologação',
    };
    validacaoSessaoGdl.producao = {
      ...criarEstadoPadrao().producao,
      ...(parsed.producao || {}),
      ambiente: 'Produção',
    };
  } catch (error) {
    log.warn('Falha ao carregar validação persistida de sessão GDL', { error });
  }
}

function normalizarAmbiente(ambiente?: string): AmbienteGdl {
  return ambiente === 'producao' ? 'producao' : 'homologacao';
}

function getAmbienteLabel(ambiente: AmbienteGdl): string {
  return ambiente === 'producao' ? 'Produção' : 'Homologação';
}

function limparValidacaoSessaoInterna(ambiente: AmbienteGdl): GdlValidacaoSessao {
  validacaoSessaoGdl[ambiente] = {
    ambiente: getAmbienteLabel(ambiente),
    validado: false,
  };
  persistirValidacaoSessao();
  return validacaoSessaoGdl[ambiente];
}

function registrarValidacaoSessao(ambiente: AmbienteGdl, numeroRep: string, anoRep: string): GdlValidacaoSessao {
  validacaoSessaoGdl[ambiente] = {
    ambiente: getAmbienteLabel(ambiente),
    validado: true,
    numeroRep,
    anoRep,
    dataHora: new Date().toISOString(),
  };
  persistirValidacaoSessao();
  return validacaoSessaoGdl[ambiente];
}

export function obterValidacaoSessao(ambiente?: string): GdlValidacaoSessao {
  const amb = normalizarAmbiente(ambiente);
  return { ...validacaoSessaoGdl[amb] };
}

export function limparValidacaoSessao(ambiente?: string): GdlValidacaoSessao {
  const amb = normalizarAmbiente(ambiente);
  return { ...limparValidacaoSessaoInterna(amb) };
}

carregarValidacaoSessaoPersistida();

async function carregarCredenciais(ambiente: string): Promise<GdlCredenciais> {
  const chaveUrl = ambiente === 'producao' ? 'gdl_url_producao' : 'gdl_url_homologacao';
  const urlPadraoHomologacao = 'https://iishml01.pr.gov.br/SAC/GDL_IC_NET/api';
  const urlPadraoProducao = 'https://www.gdl.sesp.parana/SAC/GDL_IC_NET/api';

  const baseUrl = (await configuracaoService.obter(chaveUrl))
    || (ambiente === 'producao' ? urlPadraoProducao : urlPadraoHomologacao);
  const login = (await configuracaoService.obter(`gdl_login_${ambiente}`)) || '';
  const senha = (await configuracaoService.obter(`gdl_senha_${ambiente}`)) || '';
  const cpfUsuario = (await configuracaoService.obter(`gdl_cpf_usuario_${ambiente}`)) || undefined;

  return { baseUrl: baseUrl.replace(/\/$/, ''), login, senha, cpfUsuario };
}

async function carregarBaseUrl(ambiente: string): Promise<string> {
  const chaveUrl = ambiente === 'producao' ? 'gdl_url_producao' : 'gdl_url_homologacao';
  const urlPadraoHomologacao = 'https://iishml01.pr.gov.br/SAC/GDL_IC_NET/api';
  const urlPadraoProducao = 'https://www.gdl.sesp.parana/SAC/GDL_IC_NET/api';

  const baseUrl = (await configuracaoService.obter(chaveUrl))
    || (ambiente === 'producao' ? urlPadraoProducao : urlPadraoHomologacao);

  return baseUrl.replace(/\/$/, '');
}

function buildAuthHeader(login: string, senha: string): string {
  const token = Buffer.from(`${login}:${senha}`).toString('base64');
  return `Basic ${token}`;
}

function httpsRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
  timeout: number = 15000,
): Promise<{ statusCode: number; data: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers,
      timeout,
      rejectUnauthorized: false,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, data }));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout após ${timeout}ms`));
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

export async function testarConexao(ambiente: string): Promise<GdlTesteResultado> {
  const inicio = Date.now();
  const amb = normalizarAmbiente(ambiente);
  const ambienteLabel = getAmbienteLabel(amb);
  let endpointRede = '';
  try {
    const creds = await carregarCredenciais(amb);
    endpointRede = `${creds.baseUrl}/unidadesMedida`;

    const headersRede: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const inicioRede = Date.now();
    const testeRede = await httpsRequest(endpointRede, 'GET', headersRede, undefined, 5000);
    const rede: GdlTesteEtapa = {
      sucesso: testeRede.statusCode >= 200 && testeRede.statusCode < 500,
      latencia: Date.now() - inicioRede,
      statusCode: testeRede.statusCode,
      endpointTestado: endpointRede,
      erro: testeRede.statusCode >= 500 ? `Servidor GDL respondeu HTTP ${testeRede.statusCode}.` : undefined,
    };

    if (!rede.sucesso) {
      log.warn('Teste de rede GDL falhou', { statusCode: rede.statusCode, latencia: rede.latencia, ambiente: ambienteLabel });
      return {
        sucesso: false,
        latencia: Date.now() - inicio,
        statusCode: rede.statusCode,
        autenticado: false,
        ambiente: ambienteLabel,
        endpointTestado: endpointRede,
        erro: rede.erro || 'Falha no teste de rede com o GDL.',
        rede,
      };
    }
    const latencia = Date.now() - inicio;
    log.debug('Teste de rede GDL bem-sucedido', {
      latencia,
      statusCode: rede.statusCode,
      ambiente: ambienteLabel,
    });
    return {
      sucesso: true,
      latencia,
      statusCode: rede.statusCode,
      autenticado: false,
      ambiente: ambienteLabel,
      endpointTestado: endpointRede,
      rede,
    };
  } catch (err) {
    const latencia = Date.now() - inicio;
    const mensagem = err instanceof Error ? err.message : String(err);
    log.error(`Falha no teste de conexão GDL em ambiente ${ambienteLabel}`, { erro: mensagem, latencia, endpoint: endpointRede });
    return {
      sucesso: false,
      latencia,
      statusCode: 0,
      autenticado: false,
      ambiente: ambienteLabel,
      endpointTestado: endpointRede,
      erro: mensagem,
      rede: {
        sucesso: false,
        latencia,
        statusCode: 0,
        endpointTestado: endpointRede,
        erro: mensagem,
      },
    };
  }
}

export async function consultarRep(numero: string, ano: string): Promise<GdlConsultaResultado> {
  let ambiente: AmbienteGdl = 'homologacao';
  try {
    ambiente = normalizarAmbiente(await configuracaoService.obter('gdl_ambiente') || 'homologacao');
    const creds = await carregarCredenciais(ambiente);
    if (!creds.login || !creds.senha) {
      limparValidacaoSessaoInterna(ambiente);
      return { sucesso: false, dados: null, erro: 'Credenciais não configuradas.' };
    }

    const headers: Record<string, string> = {
      'Authorization': buildAuthHeader(creds.login, creds.senha),
      'Content-Type': 'application/json',
    };
    if (creds.cpfUsuario) {
      headers['cpfUsuario'] = creds.cpfUsuario.replace(/\D/g, '');
    }

    const url = `${creds.baseUrl}/rep/obter?numero=${encodeURIComponent(numero)}&ano=${encodeURIComponent(ano)}`;
    log.debug('Consultando REP no GDL', { numero, ano });

    const { statusCode, data } = await httpsRequest(url, 'GET', headers, undefined, 15000);

    if (statusCode === 200) {
      const parsed = JSON.parse(data) as GdlRepData;
      registrarValidacaoSessao(ambiente, numero, ano);
      log.debug('REP consultada no GDL com sucesso', {
        numero,
        ano,
        codRep: parsed.codRep,
      });
      return { sucesso: true, dados: parsed };
    }

    if (statusCode === 404) {
      log.debug('REP não encontrada no GDL', { numero, ano });
      return { sucesso: false, dados: null, erro: `REP ${numero}/${ano} não encontrada no GDL.` };
    }

    if (statusCode === 401 || statusCode === 403) {
      limparValidacaoSessaoInterna(ambiente);
      log.error('Autenticação GDL rejeitada', { statusCode, numero, ano, ambiente });
      return { sucesso: false, dados: null, erro: 'Autenticação rejeitada pelo GDL. Verifique login e senha.' };
    }

    log.error('Erro ao consultar REP no GDL', { statusCode, numero, ano, ambiente });
    return { sucesso: false, dados: null, erro: `Erro do servidor GDL (HTTP ${statusCode}).` };
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    const ambLabel = getAmbienteLabel(ambiente);
    log.error(`Falha ao consultar REP ${numero}/${ano} no GDL (${ambLabel})`, { erro: mensagem, numero, ano });
    return { sucesso: false, dados: null, erro: mensagem };
  }
}

export async function validarCredenciais(
  ambiente: string,
  credenciais: GdlCredenciaisEntrada,
  numero: string,
  ano: string,
): Promise<GdlConsultaResultado> {
  const amb = normalizarAmbiente(ambiente);
  try {
    const baseUrl = await carregarBaseUrl(amb);
    const login = credenciais.login.trim();
    const senha = credenciais.senha.trim();
    const cpfUsuario = credenciais.cpfUsuario?.replace(/\D/g, '') || undefined;

    if (!login || !senha) {
      limparValidacaoSessaoInterna(amb);
      return { sucesso: false, dados: null, erro: 'Credenciais não configuradas.' };
    }

    const headers: Record<string, string> = {
      'Authorization': buildAuthHeader(login, senha),
      'Content-Type': 'application/json',
    };
    if (cpfUsuario) {
      headers.cpfUsuario = cpfUsuario;
    }

    const url = `${baseUrl}/rep/obter?numero=${encodeURIComponent(numero)}&ano=${encodeURIComponent(ano)}`;
    log.debug('Validando credenciais GDL por consulta real', { numero, ano, ambiente: amb });

    const { statusCode, data } = await httpsRequest(url, 'GET', headers, undefined, 15000);

    if (statusCode === 200) {
      const parsed = JSON.parse(data) as GdlRepData;
      registrarValidacaoSessao(amb, numero, ano);
      return { sucesso: true, dados: parsed };
    }

    if (statusCode === 404) {
      return { sucesso: false, dados: null, erro: `REP ${numero}/${ano} não encontrada no GDL.` };
    }

    if (statusCode === 401 || statusCode === 403) {
      limparValidacaoSessaoInterna(amb);
      return { sucesso: false, dados: null, erro: 'Autenticação rejeitada pelo GDL. Verifique login e senha.' };
    }

    return { sucesso: false, dados: null, erro: `Erro do servidor GDL (HTTP ${statusCode}).` };
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    const ambLabel = getAmbienteLabel(amb);
    log.error(`Falha ao validar credenciais GDL com REP ${numero}/${ano} (${ambLabel})`, { erro: mensagem, numero, ano });
    return { sucesso: false, dados: null, erro: mensagem };
  }
}
