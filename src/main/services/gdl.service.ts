import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { createHash } from 'crypto';
import { Buffer } from 'node:buffer';
import { inflateRawSync } from 'node:zlib';
import { app, nativeImage } from 'electron';
import { getLogger } from '../utils/logger.js';
import { configuracaoService } from './configuracao.service.js';
import { interpretarGdlListaRepsInvestigacaoJson, interpretarGdlRepJson } from './gdl.schema.js';
import type { GdlRepValidada } from './gdl.schema.js';
import type {
  ArquivoRepGdl,
  ImagemRepGdlCapturada,
  ResultadoCapturaImagensRepGdl,
} from '../../shared/types/gdl-arquivos.types.js';

const log = getLogger('gdl');

interface GdlCredenciais {
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

interface GdlTesteEtapa {
  sucesso: boolean;
  latencia: number;
  statusCode: number;
  endpointTestado: string;
  erro?: string;
}

interface FiltroConsultaInvestigacao {
  numeroCaso?: number;
  numeroOrigem: string;
  anoOrigem?: number;
}

export interface GdlConsultaResultado {
  sucesso: boolean;
  dados: GdlRepValidada | null;
  ambiente?: AmbienteGdl;
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
const TIMEOUT_DOWNLOAD_GDL_MS = 30000;
const EXTENSOES_IMAGEM_GDL = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp']);

interface ArquivoRepInterno extends ArquivoRepGdl {
  indiceEntradaZip: number
}

interface EntradaZipFoto {
  nome: string
  tamanho: number
  tamanhoCompactado: number
  metodoCompactacao: number
  deslocamentoCabecalhoLocal: number
  criptografada: boolean
}

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

function extrairExtensao(nomeArquivo: string): string {
  const partes = nomeArquivo.toLowerCase().split('.');
  return partes.length > 1 ? partes.at(-1) || '' : '';
}

function lerInteiroZip64(bytes: Buffer, cursor: number): number {
  if (cursor + 8 > bytes.length) throw new Error('Metadados ZIP64 incompletos na Lista de Fotos.');
  const valor = bytes.readBigUInt64LE(cursor);
  if (valor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('A Lista de Fotos excede a capacidade de processamento do aplicativo.');
  return Number(valor);
}

function resolverValoresZip64(
  extra: Buffer,
  tamanhoOriginal: number,
  tamanhoCompactadoOriginal: number,
  deslocamentoOriginal: number,
): { tamanho: number; tamanhoCompactado: number; deslocamentoCabecalhoLocal: number } {
  let tamanho = tamanhoOriginal;
  let tamanhoCompactado = tamanhoCompactadoOriginal;
  let deslocamentoCabecalhoLocal = deslocamentoOriginal;
  let cursor = 0;
  while (cursor + 4 <= extra.length) {
    const identificador = extra.readUInt16LE(cursor);
    const comprimento = extra.readUInt16LE(cursor + 2);
    const inicioDados = cursor + 4;
    const fimDados = inicioDados + comprimento;
    if (fimDados > extra.length) break;
    if (identificador === 0x0001) {
      let posicao = inicioDados;
      if (tamanho === 0xffffffff) { tamanho = lerInteiroZip64(extra, posicao); posicao += 8; }
      if (tamanhoCompactado === 0xffffffff) { tamanhoCompactado = lerInteiroZip64(extra, posicao); posicao += 8; }
      if (deslocamentoCabecalhoLocal === 0xffffffff) deslocamentoCabecalhoLocal = lerInteiroZip64(extra, posicao);
      break;
    }
    cursor = fimDados;
  }
  if (tamanho === 0xffffffff || tamanhoCompactado === 0xffffffff || deslocamentoCabecalhoLocal === 0xffffffff) {
    throw new Error('Metadados ZIP64 ausentes na Lista de Fotos.');
  }
  return { tamanho, tamanhoCompactado, deslocamentoCabecalhoLocal };
}

function paraArquivoPublico(arquivo: ArquivoRepInterno): ArquivoRepGdl {
  return {
    idSelecao: arquivo.idSelecao,
    origem: arquivo.origem,
    nomeArquivo: arquivo.nomeArquivo,
    tamanho: arquivo.tamanho,
    dataUpload: arquivo.dataUpload,
    provavelImagem: arquivo.provavelImagem,
    status: arquivo.status,
  };
}

function gerarThumbnailImagem(bytes: Buffer): string | undefined {
  const imagem = nativeImage.createFromBuffer(bytes);
  if (imagem.isEmpty()) return undefined;

  const tamanho = imagem.getSize();
  if (!tamanho.width || !tamanho.height) return undefined;
  const escala = Math.min(1, 320 / Math.max(tamanho.width, tamanho.height));
  const redimensionada = escala === 1
    ? imagem
    : imagem.resize({
      width: Math.max(1, Math.round(tamanho.width * escala)),
      height: Math.max(1, Math.round(tamanho.height * escala)),
      quality: 'best',
    });
  return `data:image/jpeg;base64,${redimensionada.toJPEG(72).toString('base64')}`;
}

export function listarFotosDoArquivoZip(bytesZip: Buffer, codRep: number): ArquivoRepInterno[] {
  if (bytesZip.length < 4 || bytesZip[0] !== 0x50 || bytesZip[1] !== 0x4b) {
    throw new Error('O GDL não retornou um arquivo ZIP válido para a Lista de Fotos.');
  }
  const entradas = lerEntradasZip(bytesZip);
  return entradas.map((entrada, indice) => {
    const nomeArquivo = path.basename(entrada.nome.replace(/\\/g, '/')) || `Foto ${indice + 1}`;
    const tamanho = entrada.tamanho;
    const provavelImagem = EXTENSOES_IMAGEM_GDL.has(extrairExtensao(nomeArquivo));
    const status = entrada.criptografada || ![0, 8].includes(entrada.metodoCompactacao)
      ? 'Compactação não compatível para captura'
      : !provavelImagem ? 'Formato não compatível para captura' : null;
    return {
      idSelecao: createHash('sha256').update(`${codRep}:${indice}:${entrada.nome}:${tamanho}`).digest('hex'),
      origem: 'lista_fotos',
      nomeArquivo,
      tamanho,
      dataUpload: null,
      provavelImagem,
      status,
      indiceEntradaZip: indice,
    };
  });
}

function lerEntradasZip(bytesZip: Buffer): EntradaZipFoto[] {
  let deslocamentoEocd = -1;
  for (let indice = bytesZip.length - 22; indice >= Math.max(0, bytesZip.length - 65557); indice -= 1) {
    if (bytesZip.readUInt32LE(indice) === 0x06054b50) {
      deslocamentoEocd = indice;
      break;
    }
  }
  if (deslocamentoEocd < 0 || deslocamentoEocd + 22 > bytesZip.length) {
    throw new Error('Não foi possível abrir o arquivo da Lista de Fotos retornado pelo GDL.');
  }
  const quantidade = bytesZip.readUInt16LE(deslocamentoEocd + 10);
  let cursor = bytesZip.readUInt32LE(deslocamentoEocd + 16);
  const entradas: EntradaZipFoto[] = [];
  for (let indice = 0; indice < quantidade; indice += 1) {
    if (cursor + 46 > bytesZip.length || bytesZip.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('O índice do arquivo da Lista de Fotos está corrompido.');
    }
    const flags = bytesZip.readUInt16LE(cursor + 8);
    const metodoCompactacao = bytesZip.readUInt16LE(cursor + 10);
    const tamanhoCompactadoOriginal = bytesZip.readUInt32LE(cursor + 20);
    const tamanhoOriginal = bytesZip.readUInt32LE(cursor + 24);
    const tamanhoNome = bytesZip.readUInt16LE(cursor + 28);
    const tamanhoExtra = bytesZip.readUInt16LE(cursor + 30);
    const tamanhoComentario = bytesZip.readUInt16LE(cursor + 32);
    const deslocamentoOriginal = bytesZip.readUInt32LE(cursor + 42);
    const fimNome = cursor + 46 + tamanhoNome;
    const fimExtra = fimNome + tamanhoExtra;
    const proximo = fimNome + tamanhoExtra + tamanhoComentario;
    if (proximo > bytesZip.length) throw new Error('O índice do arquivo da Lista de Fotos está incompleto.');
    const nome = bytesZip.subarray(cursor + 46, fimNome).toString('utf8');
    const { tamanho, tamanhoCompactado, deslocamentoCabecalhoLocal } = resolverValoresZip64(
      bytesZip.subarray(fimNome, fimExtra),
      tamanhoOriginal,
      tamanhoCompactadoOriginal,
      deslocamentoOriginal,
    );
    if (!nome.endsWith('/') && !nome.endsWith('\\')) {
      entradas.push({ nome, tamanho, tamanhoCompactado, metodoCompactacao, deslocamentoCabecalhoLocal, criptografada: (flags & 1) !== 0 });
    }
    cursor = proximo;
  }
  return entradas;
}

function extrairEntradaZip(bytesZip: Buffer, entrada: EntradaZipFoto): Buffer {
  const inicio = entrada.deslocamentoCabecalhoLocal;
  if (inicio + 30 > bytesZip.length || bytesZip.readUInt32LE(inicio) !== 0x04034b50) {
    throw new Error('O conteúdo da foto está corrompido no arquivo retornado pelo GDL.');
  }
  const tamanhoNome = bytesZip.readUInt16LE(inicio + 26);
  const tamanhoExtra = bytesZip.readUInt16LE(inicio + 28);
  const inicioDados = inicio + 30 + tamanhoNome + tamanhoExtra;
  const fimDados = inicioDados + entrada.tamanhoCompactado;
  if (fimDados > bytesZip.length) throw new Error('O conteúdo da foto está incompleto no arquivo retornado pelo GDL.');
  const compactado = bytesZip.subarray(inicioDados, fimDados);
  const dados = entrada.metodoCompactacao === 0 ? Buffer.from(compactado) : inflateRawSync(compactado);
  if (dados.length !== entrada.tamanho) throw new Error('O tamanho da foto diverge do índice retornado pelo GDL.');
  return dados;
}

function detectarMimeImagem(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 6 && (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a')) return 'image/gif';
  if (bytes.length >= 2 && bytes.subarray(0, 2).toString('ascii') === 'BM') return 'image/bmp';
  return null;
}

function baixarArquivoGdl(url: string, headers: Record<string, string>): Promise<{ statusCode: number; contentType: string; bytes: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
      timeout: TIMEOUT_DOWNLOAD_GDL_MS,
      rejectUnauthorized: false,
    }, res => {
      const partes: Buffer[] = [];
      res.on('data', (chunk: Buffer) => {
        partes.push(chunk);
      });
      res.on('end', () => resolve({
        statusCode: res.statusCode || 0,
        contentType: typeof res.headers['content-type'] === 'string' ? res.headers['content-type'] : '',
        bytes: Buffer.concat(partes),
      }));
    });
    req.on('timeout', () => req.destroy(new Error('Timeout ao baixar arquivo do GDL.')));
    req.on('error', reject);
    req.end();
  });
}

export function extrairFiltrosParaConsultaInvestigacao(rep: GdlRepValidada): FiltroConsultaInvestigacao[] {
  const origens = rep.origens.flatMap(origem => {
    const numeroOriginal = origem.numero.trim();
    const anoSeparado = origem.ano.trim() ? Number(origem.ano) : Number.NaN;
    const origemComAno = numeroOriginal.match(/^(.*)\/(\d{4})$/);
    const numeroOrigem = (origemComAno?.[1] || numeroOriginal).trim();
    const anoOrigem = Number.isInteger(anoSeparado)
      ? anoSeparado
      : Number(origemComAno?.[2]);

    if (numeroOrigem && Number.isInteger(anoOrigem)) {
      return [{ numeroOrigem, anoOrigem }];
    }
    return [];
  });

  const origensUnicas = origens.filter((origem, indice) => (
    origens.findIndex(outra => (
      outra.numeroOrigem === origem.numeroOrigem && outra.anoOrigem === origem.anoOrigem
    )) === indice
  ));
  if (origensUnicas.length > 0) return origensUnicas;

  const numeroCasoBruto = rep.numeroCaso;
  const numeroCaso = typeof numeroCasoBruto === 'number'
    ? numeroCasoBruto
    : typeof numeroCasoBruto === 'string' ? Number(numeroCasoBruto) : Number.NaN;
  return Number.isInteger(numeroCaso) && numeroCaso > 0
    ? [{ numeroCaso, numeroOrigem: '' }]
    : [];
}

async function consultarEnvolvidosEmHomologacao(
  baseUrl: string,
  credenciais: GdlCredenciais,
  rep: GdlRepValidada,
): Promise<unknown[]> {
  const cpfUsuario = credenciais.cpfUsuario?.replace(/\D/g, '') || '';
  if (!/^\d{11}$/.test(cpfUsuario)) {
    log.warn('Consulta de envolvidos ignorada: CPF do usuário ausente ou inválido', { codRep: rep.codRep });
    return [];
  }

  const filtros = extrairFiltrosParaConsultaInvestigacao(rep);
  if (filtros.length === 0) {
    log.debug('Consulta de envolvidos ignorada: REP sem origem consultável', { codRep: rep.codRep });
    return [];
  }

  const headers: Record<string, string> = {
    'Authorization': buildAuthHeader(credenciais.login, credenciais.senha),
    'Content-Type': 'application/json',
  };
  headers.cpfUsuario = cpfUsuario;

  const url = `${baseUrl}/repsInvestigacaoPolicial/listarReps`;
  const envolvidos: unknown[] = [];

  for (const filtro of filtros) {
    const corpo = JSON.stringify({
      ...(filtro.numeroCaso ? { numeroCaso: filtro.numeroCaso } : {
        numeroOrigem: filtro.numeroOrigem,
        anoOrigem: filtro.anoOrigem,
      }),
      numPagina: 1,
      tamPagina: 10,
    });
    try {
      const { statusCode, data } = await httpsRequest(url, 'POST', headers, corpo, 15000);

      if (statusCode !== 200) {
        log.warn('Consulta auxiliar de envolvidos no GDL não retornou sucesso', {
          codRep: rep.codRep,
          statusCode,
        });
        continue;
      }

      const resposta = interpretarGdlListaRepsInvestigacaoJson(data);
      envolvidos.push(...resposta.dadosREPs.flatMap(item => item.envolvidos === undefined ? [] : [item.envolvidos]));
    } catch (erro) {
      log.warn('Falha na consulta auxiliar de envolvidos no GDL', {
        codRep: rep.codRep,
        erro: erro instanceof Error ? erro.message : 'Erro inesperado',
      });
    }
  }

  return envolvidos;
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
      const parsed = interpretarGdlRepJson(data);
      const envolvidos = ambiente === 'homologacao'
        ? await consultarEnvolvidosEmHomologacao(creds.baseUrl, creds, parsed)
        : [];
      const dadosComEnvolvidos = envolvidos.length > 0
        ? { ...parsed, envolvidos: [...parsed.envolvidos, ...envolvidos] }
        : parsed;
      registrarValidacaoSessao(ambiente, numero, ano);
      log.debug('REP consultada no GDL com sucesso', {
        numero,
        ano,
        codRep: dadosComEnvolvidos.codRep,
        envolvidosEncontrados: envolvidos.length,
      });
      return { sucesso: true, dados: dadosComEnvolvidos, ambiente };
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

async function consultarIdentificacaoDaRep(numero: string, ano: string): Promise<{ rep: GdlRepValidada; credenciais: GdlCredenciais }> {
  const ambiente = normalizarAmbiente(await configuracaoService.obter('gdl_ambiente') || 'homologacao');
  const credenciais = await carregarCredenciais(ambiente);
  if (!credenciais.login || !credenciais.senha) {
    throw new Error('Credenciais do GDL não configuradas.');
  }

  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(credenciais.login, credenciais.senha),
    'Content-Type': 'application/json',
  };
  if (credenciais.cpfUsuario) headers.cpfUsuario = credenciais.cpfUsuario.replace(/\D/g, '');

  const url = `${credenciais.baseUrl}/rep/obter?numero=${encodeURIComponent(numero)}&ano=${encodeURIComponent(ano)}`;
  const resposta = await httpsRequest(url, 'GET', headers, undefined, 15000);
  if (resposta.statusCode === 404) throw new Error(`REP ${numero}/${ano} não encontrada no GDL.`);
  if (resposta.statusCode === 401 || resposta.statusCode === 403) throw new Error('Autenticação rejeitada pelo GDL. Verifique login e senha.');
  if (resposta.statusCode !== 200) throw new Error(`Erro do servidor GDL (HTTP ${resposta.statusCode}).`);
  return { rep: interpretarGdlRepJson(resposta.data), credenciais };
}

function montarUrlListaFotos(baseUrlApi: string, codRep: number, numero: string, ano: string): string {
  const urlApi = new URL(baseUrlApi);
  const caminhoRaiz = urlApi.pathname.replace(/\/api\/?$/i, '').replace(/\/$/, '');
  return `${urlApi.origin}${caminhoRaiz}/Rep/Controls/PictureHandler.ashx?repId=${encodeURIComponent(String(codRep))}&repNumberYear=${encodeURIComponent(`${numero}_${ano}`)}`;
}

async function baixarListaFotosRep(numero: string, ano: string): Promise<{ arquivos: ArquivoRepInterno[]; bytesZip: Buffer }> {
  const { rep, credenciais } = await consultarIdentificacaoDaRep(numero, ano);
  const url = montarUrlListaFotos(credenciais.baseUrl, rep.codRep, numero, ano);
  const resposta = await baixarArquivoGdl(url, {
    Authorization: buildAuthHeader(credenciais.login, credenciais.senha),
    ...(credenciais.cpfUsuario ? { cpfUsuario: credenciais.cpfUsuario.replace(/\D/g, '') } : {}),
  });
  if (resposta.statusCode === 404) throw new Error(`A Lista de Fotos da REP ${numero}/${ano} não foi encontrada no GDL.`);
  if (resposta.statusCode === 401 || resposta.statusCode === 403) throw new Error('Acesso à Lista de Fotos rejeitado pelo GDL.');
  if (resposta.statusCode !== 200) throw new Error(`Erro ao obter a Lista de Fotos do GDL (HTTP ${resposta.statusCode}).`);
  return { arquivos: listarFotosDoArquivoZip(resposta.bytes, rep.codRep), bytesZip: resposta.bytes };
}

export async function listarImagensRepGdl(numero: string, ano: string): Promise<ArquivoRepGdl[]> {
  const { arquivos, bytesZip } = await baixarListaFotosRep(numero, ano);
  const entradasZip = lerEntradasZip(bytesZip);
  return arquivos.map(arquivo => {
    const publico = paraArquivoPublico(arquivo);
    if (!arquivo.provavelImagem || arquivo.status) return publico;
    try {
      const entrada = entradasZip[arquivo.indiceEntradaZip];
      if (!entrada) return publico;
      const bytes = extrairEntradaZip(bytesZip, entrada);
      if (!detectarMimeImagem(bytes)) return publico;
      return { ...publico, thumbnailDataUri: gerarThumbnailImagem(bytes) };
    } catch {
      return publico;
    }
  });
}

export async function capturarImagensRepGdl(
  numero: string,
  ano: string,
  idsSelecao: string[],
): Promise<ResultadoCapturaImagensRepGdl> {
  const idsUnicos = [...new Set(idsSelecao)];
  if (idsUnicos.length === 0) return { imagens: [], falhas: [] };

  const { arquivos, bytesZip } = await baixarListaFotosRep(numero, ano);
  const porId = new Map(arquivos.map(arquivo => [arquivo.idSelecao, arquivo]));
  const entradasZip = lerEntradasZip(bytesZip);
  const imagens: ImagemRepGdlCapturada[] = [];
  const falhas: ResultadoCapturaImagensRepGdl['falhas'] = [];
  const hashesCapturados = new Set<string>();

  for (const idSelecao of idsUnicos) {
    const arquivo = porId.get(idSelecao);
    if (!arquivo || !arquivo.provavelImagem || arquivo.status) {
      falhas.push({ idSelecao, erro: 'Foto indisponível para captura na Lista de Fotos.' });
      continue;
    }
    try {
      const entrada = entradasZip[arquivo.indiceEntradaZip];
      if (!entrada) throw new Error('A foto não foi encontrada no arquivo retornado pelo GDL.');
      const bytes = extrairEntradaZip(bytesZip, entrada);
      if (bytes.length === 0) throw new Error('O GDL retornou um arquivo vazio.');

      const mimeType = detectarMimeImagem(bytes);
      if (!mimeType) throw new Error('O conteúdo baixado não é uma imagem compatível.');

      const sha256 = createHash('sha256').update(bytes).digest('hex');
      if (hashesCapturados.has(sha256)) {
        falhas.push({ idSelecao, erro: 'Imagem duplicada nesta captura.' });
        continue;
      }
      hashesCapturados.add(sha256);
      imagens.push({
        idSelecao,
        nomeArquivo: arquivo.nomeArquivo,
        mimeType,
        tamanho: bytes.length,
        dataUri: `data:${mimeType};base64,${bytes.toString('base64')}`,
        sha256,
      });
    } catch (erro) {
      falhas.push({ idSelecao, erro: erro instanceof Error ? erro.message : 'Erro inesperado ao capturar arquivo.' });
    }
  }
  return { imagens, falhas };
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
      const parsed = interpretarGdlRepJson(data);
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
