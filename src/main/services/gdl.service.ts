import https from 'https';
import http from 'http';
import { getLogger } from '../utils/logger.js';
import { configuracaoService } from './configuracao.service.js';

const log = getLogger('gdl');

export interface GdlCredenciais {
  baseUrl: string;
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
  const amb = ambiente || 'homologacao';
  const ambienteLabel = amb === 'producao' ? 'Produção' : 'Homologação';
  let endpointTeste = '';
  try {
    const creds = await carregarCredenciais(amb);
    endpointTeste = `${creds.baseUrl}/unidadesMedida`;

    if (!creds.login || !creds.senha) {
      log.warn('Teste de conexão GDL: credenciais não configuradas');
      return {
        sucesso: false,
        latencia: Date.now() - inicio,
        statusCode: 0,
        autenticado: false,
        ambiente: ambienteLabel,
        endpointTestado: endpointTeste,
        erro: 'Credenciais não configuradas. Preencha login e senha.',
      };
    }

    const headers: Record<string, string> = {
      'Authorization': buildAuthHeader(creds.login, creds.senha),
      'Content-Type': 'application/json',
    };
    if (creds.cpfUsuario) {
      headers['cpfUsuario'] = creds.cpfUsuario.replace(/\D/g, '');
    }

    const timeout = 5000;
    const { statusCode } = await httpsRequest(endpointTeste, 'GET', headers, undefined, timeout);
    const latencia = Date.now() - inicio;

    const autenticado = statusCode !== 401 && statusCode !== 403;

    if (statusCode >= 200 && statusCode < 400) {
      log.debug('Teste de conexão GDL bem-sucedido', { latencia, statusCode, ambiente: ambienteLabel });
      return { sucesso: true, latencia, statusCode, autenticado, ambiente: ambienteLabel, endpointTestado: endpointTeste };
    }

    log.warn('Teste de conexão GDL: resposta inesperada', { statusCode, latencia, ambiente: ambienteLabel });
    return {
      sucesso: true,
      latencia,
      statusCode,
      autenticado,
      ambiente: ambienteLabel,
      endpointTestado: endpointTeste,
    };
  } catch (err) {
    const latencia = Date.now() - inicio;
    const mensagem = err instanceof Error ? err.message : String(err);
    log.error(`Falha no teste de conexão GDL em ambiente ${ambienteLabel}`, { erro: mensagem, latencia, endpoint: endpointTeste });
    return {
      sucesso: false,
      latencia,
      statusCode: 0,
      autenticado: false,
      ambiente: ambienteLabel,
      endpointTestado: endpointTeste,
      erro: mensagem,
    };
  }
}

export async function consultarRep(numero: string, ano: string): Promise<GdlConsultaResultado> {
  let ambiente = 'homologacao';
  try {
    ambiente = (await configuracaoService.obter('gdl_ambiente')) || 'homologacao';
    const creds = await carregarCredenciais(ambiente);
    if (!creds.login || !creds.senha) {
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
      log.error('Autenticação GDL rejeitada', { statusCode, numero, ano, ambiente });
      return { sucesso: false, dados: null, erro: 'Autenticação rejeitada pelo GDL. Verifique login e senha.' };
    }

    log.error('Erro ao consultar REP no GDL', { statusCode, numero, ano, ambiente });
    return { sucesso: false, dados: null, erro: `Erro do servidor GDL (HTTP ${statusCode}).` };
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    const ambLabel = ambiente === 'producao' ? 'Produção' : 'Homologação';
    log.error(`Falha ao consultar REP ${numero}/${ano} no GDL (${ambLabel})`, { erro: mensagem, numero, ano });
    return { sucesso: false, dados: null, erro: mensagem };
  }
}
