import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { Buffer } from 'node:buffer';
import { inflateRawSync } from 'node:zlib';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { app, nativeImage, session } from 'electron';
import { getLogger } from '../utils/logger.js';
import { configuracaoService } from './configuracao.service.js';
import { interpretarGdlListaRepsInvestigacaoJson, interpretarGdlRepJson } from './gdl.schema.js';
import type { GdlRepValidada } from './gdl.schema.js';
import type {
  ArquivoRepGdl,
  DuplicataImagemRepGdl,
  ListaImagensRepGdl,
  ImagemRepGdlAdicionadaAoLaudo,
  ImagemRepGdlCapturada,
  ResultadoCapturaImagensLaudoGdl,
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
  naturezaExame?: string;
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
const GDL_DOWNLOADS_DIR = path.join(GDL_ESTADO_DIR, 'downloads-temporarios');
const TIMEOUT_DOWNLOAD_GDL_MS = 30000;
const LIMITE_BYTES_ZIP_GDL = 1024 * 1024 * 1024;
const LIMITE_BYTES_FOTO_GDL = 50 * 1024 * 1024;
const LIMITE_RAZAO_DESCOMPRESSAO_GDL = 100;
const LIMITE_ENTRADAS_ZIP_GDL = 1000;
const TEMPO_SESSAO_FOTOS_GDL_MS = 15 * 60 * 1000;
const EXTENSOES_IMAGEM_GDL = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp']);
const HOST_GDL_PRODUCAO_COM_CERTIFICADO_EXCEPCIONAL = 'www.gdl.sesp.parana';
let verificacaoCertificadoGdlConfigurada = false;

function obterSessaoRedeGdl() {
  const sessaoRede = session.defaultSession;
  if (verificacaoCertificadoGdlConfigurada) return sessaoRede;

  sessaoRede.setCertificateVerifyProc((requisicao, callback) => {
    const deveConfiar = requisicao.hostname === HOST_GDL_PRODUCAO_COM_CERTIFICADO_EXCEPCIONAL
      && requisicao.errorCode === -202;

    if (!deveConfiar) {
      callback(requisicao.errorCode);
      return;
    }

    log.warn('Certificado não confiável aceito exclusivamente para a API GDL de Produção.', {
      host: HOST_GDL_PRODUCAO_COM_CERTIFICADO_EXCEPCIONAL,
      erro: requisicao.verificationResult,
      emissor: requisicao.certificate.issuerName,
      impressaoDigital: requisicao.certificate.fingerprint,
    });
    callback(0);
  });
  verificacaoCertificadoGdlConfigurada = true;
  return sessaoRede;
}

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

interface SessaoFotosGdl {
  laudoId: string
  numero: string
  ano: string
  caminhoZip: string
  arquivos: ArquivoRepInterno[]
  entradasZip: EntradaZipFoto[]
  expiraEm: number
}

const sessoesFotosGdl = new Map<string, SessaoFotosGdl>()

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

async function requisitarGdl(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string,
  timeout: number = 15000,
): Promise<{ statusCode: number; data: string }> {
  const sessaoRede = obterSessaoRedeGdl();
  const controller = new AbortController();
  const temporizador = setTimeout(() => controller.abort(), timeout);
  try {
    const resposta = await sessaoRede.fetch(url, {
      method,
      headers,
      ...(body ? { body } : {}),
      signal: controller.signal,
    });
    return { statusCode: resposta.status, data: await resposta.text() };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Timeout após ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(temporizador);
  }
}

function decodificarEntidadesHtml(texto: string): string {
  return texto
    .replace(/&#(\d+);/g, (_entidade, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/&#x([0-9a-f]+);/gi, (_entidade, codigo: string) => String.fromCodePoint(Number.parseInt(codigo, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

export function extrairQuesitoAbertoDaPaginaGdl(conteudo: string): string {
  const correspondencia = conteudo.match(
    /<textarea\b[^>]*(?:id|name)=["'][^"']*txtOpenQuestion["'][^>]*>([\s\S]*?)<\/textarea>/i,
  );
  return correspondencia ? decodificarEntidadesHtml(correspondencia[1]).trim() : '';
}

async function consultarQuesitoAbertoDaPaginaGdl(
  credenciais: GdlCredenciais,
  codRep: number,
): Promise<string> {
  const baseAplicacao = credenciais.baseUrl.replace(/\/api$/i, '');
  const url = `${baseAplicacao}/REP/Default.aspx?rep_id=${encodeURIComponent(String(codRep))}`;
  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(credenciais.login, credenciais.senha),
    Accept: 'text/html',
  };
  if (credenciais.cpfUsuario) headers.cpfUsuario = credenciais.cpfUsuario.replace(/\D/g, '');

  try {
    const resposta = await requisitarGdl(url, 'GET', headers, undefined, 15000);
    if (resposta.statusCode !== 200) return '';
    return extrairQuesitoAbertoDaPaginaGdl(resposta.data);
  } catch (erro) {
    log.warn('Não foi possível complementar o Quesito Aberto pela página da REP GDL.', {
      codRep,
      erro: erro instanceof Error ? erro.message : String(erro),
    });
    return '';
  }
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
  return criarArquivosDaListaFotos(lerEntradasZip(bytesZip), codRep)
}

function criarArquivosDaListaFotos(entradas: EntradaZipFoto[], codRep: number): ArquivoRepInterno[] {
  return entradas.map((entrada, indice) => {
    const nomeArquivo = path.basename(entrada.nome.replace(/\\/g, '/')) || `Foto ${indice + 1}`;
    const tamanho = entrada.tamanho;
    const provavelImagem = EXTENSOES_IMAGEM_GDL.has(extrairExtensao(nomeArquivo));
    const status = entrada.criptografada || ![0, 8].includes(entrada.metodoCompactacao)
      ? 'Compactação não compatível para captura'
      : entrada.tamanho > LIMITE_BYTES_FOTO_GDL
        ? 'Foto acima do limite de 50 MB para captura'
        : entrada.tamanhoCompactado > 0 && entrada.tamanho / entrada.tamanhoCompactado > LIMITE_RAZAO_DESCOMPRESSAO_GDL
          ? 'Taxa de descompressão não compatível para captura'
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

function lerDoArquivo(caminho: string, posicao: number, tamanho: number): Buffer {
  const descritor = fs.openSync(caminho, 'r')
  try {
    const bytes = Buffer.allocUnsafe(tamanho)
    const lidos = fs.readSync(descritor, bytes, 0, tamanho, posicao)
    return lidos === tamanho ? bytes : bytes.subarray(0, lidos)
  } finally {
    fs.closeSync(descritor)
  }
}

function lerEntradasZipDoArquivo(caminho: string): EntradaZipFoto[] {
  const tamanhoArquivo = fs.statSync(caminho).size
  if (tamanhoArquivo < 4 || !lerDoArquivo(caminho, 0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    throw new Error('O GDL não retornou um arquivo ZIP válido para a Lista de Fotos.')
  }
  const inicioCauda = Math.max(0, tamanhoArquivo - 65557)
  const cauda = lerDoArquivo(caminho, inicioCauda, tamanhoArquivo - inicioCauda)
  let deslocamentoEocd = -1
  for (let indice = cauda.length - 22; indice >= 0; indice -= 1) {
    if (cauda.readUInt32LE(indice) === 0x06054b50) {
      deslocamentoEocd = indice
      break
    }
  }
  if (deslocamentoEocd < 0 || deslocamentoEocd + 22 > cauda.length) {
    throw new Error('Não foi possível abrir o arquivo da Lista de Fotos retornado pelo GDL.')
  }
  const quantidade = cauda.readUInt16LE(deslocamentoEocd + 10)
  if (quantidade > LIMITE_ENTRADAS_ZIP_GDL) {
    throw new Error(`A Lista de Fotos ultrapassa o limite de ${LIMITE_ENTRADAS_ZIP_GDL} entradas.`)
  }
  const tamanhoDiretorio = cauda.readUInt32LE(deslocamentoEocd + 12)
  const deslocamentoDiretorio = cauda.readUInt32LE(deslocamentoEocd + 16)
  if (tamanhoDiretorio === 0xffffffff || deslocamentoDiretorio === 0xffffffff) throw new Error('Índice ZIP64 não compatível para a Lista de Fotos.')
  const diretorio = lerDoArquivo(caminho, deslocamentoDiretorio, tamanhoDiretorio)
  if (diretorio.length !== tamanhoDiretorio) throw new Error('O índice do arquivo da Lista de Fotos está incompleto.')
  let cursor = 0
  const entradas: EntradaZipFoto[] = []
  for (let indice = 0; indice < quantidade; indice += 1) {
    if (cursor + 46 > diretorio.length || diretorio.readUInt32LE(cursor) !== 0x02014b50) throw new Error('O índice do arquivo da Lista de Fotos está corrompido.')
    const flags = diretorio.readUInt16LE(cursor + 8)
    const metodoCompactacao = diretorio.readUInt16LE(cursor + 10)
    const tamanhoCompactadoOriginal = diretorio.readUInt32LE(cursor + 20)
    const tamanhoOriginal = diretorio.readUInt32LE(cursor + 24)
    const tamanhoNome = diretorio.readUInt16LE(cursor + 28)
    const tamanhoExtra = diretorio.readUInt16LE(cursor + 30)
    const tamanhoComentario = diretorio.readUInt16LE(cursor + 32)
    const deslocamentoOriginal = diretorio.readUInt32LE(cursor + 42)
    const fimNome = cursor + 46 + tamanhoNome
    const fimExtra = fimNome + tamanhoExtra
    const proximo = fimExtra + tamanhoComentario
    if (proximo > diretorio.length) throw new Error('O índice do arquivo da Lista de Fotos está incompleto.')
    const nome = diretorio.subarray(cursor + 46, fimNome).toString('utf8')
    const valores = resolverValoresZip64(diretorio.subarray(fimNome, fimExtra), tamanhoOriginal, tamanhoCompactadoOriginal, deslocamentoOriginal)
    if (!nome.endsWith('/') && !nome.endsWith('\\')) entradas.push({ nome, ...valores, metodoCompactacao, criptografada: (flags & 1) !== 0 })
    cursor = proximo
  }
  return entradas
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
  if (quantidade > LIMITE_ENTRADAS_ZIP_GDL) {
    throw new Error(`A Lista de Fotos ultrapassa o limite de ${LIMITE_ENTRADAS_ZIP_GDL} entradas.`);
  }
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

function detectarMimeImagem(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 6 && (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a')) return 'image/gif';
  if (bytes.length >= 2 && bytes.subarray(0, 2).toString('ascii') === 'BM') return 'image/bmp';
  return null;
}

async function baixarArquivoGdl(url: string, headers: Record<string, string>): Promise<{ statusCode: number; contentType: string; caminhoTemporario?: string }> {
  const sessaoRede = obterSessaoRedeGdl();
  const controller = new AbortController();
  const temporizador = setTimeout(() => controller.abort(), TIMEOUT_DOWNLOAD_GDL_MS);
  try {
    const resposta = await sessaoRede.fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    if (!resposta.ok || !resposta.body) return { statusCode: resposta.status, contentType: resposta.headers.get('content-type') || '' };
    const contentLength = Number(resposta.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > LIMITE_BYTES_ZIP_GDL) {
      throw new Error('A Lista de Fotos ultrapassa o limite de 1 GB permitido para importação.')
    }
    fs.mkdirSync(GDL_DOWNLOADS_DIR, { recursive: true })
    const caminhoTemporario = path.join(GDL_DOWNLOADS_DIR, `lista-fotos-${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}.zip`)
    let bytesRecebidos = 0
    const limite = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytesRecebidos += chunk.length
        if (bytesRecebidos > LIMITE_BYTES_ZIP_GDL) {
          callback(new Error('A Lista de Fotos ultrapassa o limite de 1 GB permitido para importação.'))
          return
        }
        callback(null, chunk)
      },
    })
    try {
      await pipeline(
        Readable.fromWeb(resposta.body as unknown as import('node:stream/web').ReadableStream),
        limite,
        fs.createWriteStream(caminhoTemporario, { flags: 'wx' }),
      )
      return { statusCode: resposta.status, contentType: resposta.headers.get('content-type') || '', caminhoTemporario }
    } catch (error) {
      if (fs.existsSync(caminhoTemporario)) fs.unlinkSync(caminhoTemporario)
      throw error
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Timeout ao baixar arquivo do GDL.');
    }
    throw error;
  } finally {
    clearTimeout(temporizador);
  }
}

function extrairEntradaZipDoArquivo(caminho: string, entrada: EntradaZipFoto): Buffer {
  if (entrada.tamanho > LIMITE_BYTES_FOTO_GDL) throw new Error('A foto ultrapassa o limite de 50 MB para captura.')
  if (entrada.tamanhoCompactado > 0 && entrada.tamanho / entrada.tamanhoCompactado > LIMITE_RAZAO_DESCOMPRESSAO_GDL) {
    throw new Error('A taxa de descompressão da foto não é segura para captura.')
  }
  const cabecalho = lerDoArquivo(caminho, entrada.deslocamentoCabecalhoLocal, 30)
  if (cabecalho.length !== 30 || cabecalho.readUInt32LE(0) !== 0x04034b50) throw new Error('O conteúdo da foto está corrompido no arquivo retornado pelo GDL.')
  const inicioDados = entrada.deslocamentoCabecalhoLocal + 30 + cabecalho.readUInt16LE(26) + cabecalho.readUInt16LE(28)
  const compactado = lerDoArquivo(caminho, inicioDados, entrada.tamanhoCompactado)
  if (compactado.length !== entrada.tamanhoCompactado) throw new Error('O conteúdo da foto está incompleto no arquivo retornado pelo GDL.')
  const dados = entrada.metodoCompactacao === 0 ? compactado : inflateRawSync(compactado)
  if (dados.length !== entrada.tamanho) throw new Error('O tamanho da foto diverge do índice retornado pelo GDL.')
  return dados
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

interface DadosInvestigacaoComplementares {
  envolvidos: unknown[];
  naturezaExame?: string;
}

export function extrairCodigoNaturezaExame(naturezaExame: string): string | null {
  const correspondencia = naturezaExame.trim().toUpperCase().match(/^([A-Z])\s*-?\s*(\d{3})\b/);
  return correspondencia ? `${correspondencia[1]}-${correspondencia[2]}` : null;
}

async function consultarDadosNaInvestigacao(
  baseUrl: string,
  credenciais: GdlCredenciais,
  rep: GdlRepValidada,
): Promise<DadosInvestigacaoComplementares> {
  const cpfUsuario = credenciais.cpfUsuario?.replace(/\D/g, '') || '';
  if (!/^\d{11}$/.test(cpfUsuario)) {
    log.warn('Consulta de envolvidos ignorada: CPF do usuário ausente ou inválido', { codRep: rep.codRep });
    return { envolvidos: [] };
  }

  const filtros = extrairFiltrosParaConsultaInvestigacao(rep);
  if (filtros.length === 0) {
    log.debug('Consulta de envolvidos ignorada: REP sem origem consultável', { codRep: rep.codRep });
    return { envolvidos: [] };
  }

  const headers: Record<string, string> = {
    'Authorization': buildAuthHeader(credenciais.login, credenciais.senha),
    'Content-Type': 'application/json',
  };
  headers.cpfUsuario = cpfUsuario;

  const url = `${baseUrl}/repsInvestigacaoPolicial/listarReps`;
  const envolvidos: unknown[] = [];
  const naturezasExame = new Set<string>();

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
      const { statusCode, data } = await requisitarGdl(url, 'POST', headers, corpo, 15000);

      if (statusCode !== 200) {
        log.warn('Consulta auxiliar de envolvidos no GDL não retornou sucesso', {
          codRep: rep.codRep,
          statusCode,
        });
        continue;
      }

      const resposta = interpretarGdlListaRepsInvestigacaoJson(data);
      const repsCorrespondentes = resposta.dadosREPs
        .filter(item => repInvestigacaoCorresponde(item, rep));
      envolvidos.push(...repsCorrespondentes.flatMap(item => item.envolvidos === undefined ? [] : [item.envolvidos]));
      repsCorrespondentes.forEach(item => {
        if (item.naturezaExame.trim()) naturezasExame.add(item.naturezaExame.trim());
      });
    } catch (erro) {
      log.warn('Falha na consulta auxiliar de envolvidos no GDL', {
        codRep: rep.codRep,
        erro: erro instanceof Error ? erro.message : 'Erro inesperado',
      });
    }
  }

  if (naturezasExame.size > 1) {
    log.warn('A consulta auxiliar retornou mais de uma natureza de exame para a REP', {
      codRep: rep.codRep,
      quantidadeNaturezas: naturezasExame.size,
    });
  }
  return { envolvidos, naturezaExame: naturezasExame.values().next().value };
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
    const testeRede = await requisitarGdl(endpointRede, 'GET', headersRede, undefined, 5000);
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

    const { statusCode, data } = await requisitarGdl(url, 'GET', headers, undefined, 15000);

    if (statusCode === 200) {
      const parsed = interpretarGdlRepJson(data);
      const quesitoAberto = parsed.quesitoAberto
        || await consultarQuesitoAbertoDaPaginaGdl(creds, parsed.codRep);
      const repComQuesito = quesitoAberto ? { ...parsed, quesitoAberto } : parsed;
      const dadosComplementares = await consultarDadosNaInvestigacao(creds.baseUrl, creds, repComQuesito);
      const dadosComEnvolvidos = dadosComplementares.envolvidos.length > 0
        ? { ...repComQuesito, envolvidos: [...repComQuesito.envolvidos, ...dadosComplementares.envolvidos] }
        : repComQuesito;
      registrarValidacaoSessao(ambiente, numero, ano);
      log.debug('REP consultada no GDL com sucesso', {
        numero,
        ano,
        codRep: dadosComEnvolvidos.codRep,
        envolvidosEncontrados: dadosComplementares.envolvidos.length,
        naturezaExameEncontrada: Boolean(dadosComplementares.naturezaExame),
      });
      return {
        sucesso: true,
        dados: dadosComEnvolvidos,
        ambiente,
        naturezaExame: dadosComplementares.naturezaExame,
      };
    }

    if (statusCode === 404) {
      log.debug('REP não encontrada no GDL', { numero, ano });
      return { sucesso: false, dados: null, erro: `REP ${numero}/${ano} não encontrada no GDL.` };
    }

    if (statusCode === 401 || statusCode === 403) {
      const credenciaisConfirmadas = await credenciaisConfirmadasPorRepValidada(
        ambiente,
        creds,
        headers,
        numero,
        ano,
      );
      if (credenciaisConfirmadas) {
        log.debug('REP não encontrada no GDL após confirmação das credenciais', { statusCode, numero, ano, ambiente });
        return { sucesso: false, dados: null, erro: `REP ${numero}/${ano} não encontrada no GDL.` };
      }

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

async function credenciaisConfirmadasPorRepValidada(
  ambiente: AmbienteGdl,
  credenciais: GdlCredenciais,
  headers: Record<string, string>,
  numeroConsultado: string,
  anoConsultado: string,
): Promise<boolean> {
  const validacao = obterValidacaoSessao(ambiente);
  if (!validacao.validado || !validacao.numeroRep || !validacao.anoRep) return false;

  const referenciaIgualAConsulta = validacao.numeroRep.replace(/\D/g, '') === numeroConsultado.replace(/\D/g, '')
    && validacao.anoRep === anoConsultado;
  if (referenciaIgualAConsulta) return false;

  try {
    const url = `${credenciais.baseUrl}/rep/obter?numero=${encodeURIComponent(validacao.numeroRep.replace(/\D/g, ''))}&ano=${encodeURIComponent(validacao.anoRep)}`;
    const resposta = await requisitarGdl(url, 'GET', headers, undefined, 15000);
    return resposta.statusCode === 200;
  } catch (erro) {
    log.warn('Não foi possível confirmar as credenciais GDL pela REP validada', {
      ambiente,
      erro: erro instanceof Error ? erro.message : String(erro),
    });
    return false;
  }
}

async function consultarIdentificacaoDaRep(numero: string, ano: string): Promise<{
  rep: GdlRepValidada;
  credenciais: GdlCredenciais;
  ambiente: AmbienteGdl;
}> {
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
  const resposta = await requisitarGdl(url, 'GET', headers, undefined, 15000);
  if (resposta.statusCode === 404) throw new Error(`REP ${numero}/${ano} não encontrada no GDL.`);
  if (resposta.statusCode === 401 || resposta.statusCode === 403) throw new Error('Autenticação rejeitada pelo GDL. Verifique login e senha.');
  if (resposta.statusCode !== 200) throw new Error(`Erro do servidor GDL (HTTP ${resposta.statusCode}).`);
  return { rep: interpretarGdlRepJson(resposta.data), credenciais, ambiente };
}

function repInvestigacaoCorresponde(repInvestigacao: { numeroRep: string; numeroCaso: string }, rep: GdlRepValidada): boolean {
  const numeroRepEsperado = `${rep.numero}${rep.ano}`
  const numeroRepRetornado = repInvestigacao.numeroRep.replace(/\D/g, '')
  if (numeroRepRetornado === numeroRepEsperado) return true

  const numeroCasoRep = typeof rep.numeroCaso === 'number'
    ? String(rep.numeroCaso)
    : typeof rep.numeroCaso === 'string' ? rep.numeroCaso.replace(/\D/g, '') : ''
  return !!numeroCasoRep && repInvestigacao.numeroCaso.replace(/\D/g, '') === numeroCasoRep
}

function montarUrlListaFotos(baseUrlApi: string, codRep: number, numero: string, ano: string): string {
  const urlApi = new URL(baseUrlApi);
  const caminhoRaiz = urlApi.pathname.replace(/\/api\/?$/i, '').replace(/\/$/, '');
  return `${urlApi.origin}${caminhoRaiz}/Rep/Controls/PictureHandler.ashx?repId=${encodeURIComponent(String(codRep))}&repNumberYear=${encodeURIComponent(`${numero}_${ano}`)}`;
}

async function baixarListaFotosRep(numero: string, ano: string): Promise<{
  arquivos: ArquivoRepInterno[];
  caminhoZip: string;
  ambiente: AmbienteGdl;
}> {
  const { rep, credenciais, ambiente } = await consultarIdentificacaoDaRep(numero, ano);
  const url = montarUrlListaFotos(credenciais.baseUrl, rep.codRep, numero, ano);
  const resposta = await baixarArquivoGdl(url, {
    Authorization: buildAuthHeader(credenciais.login, credenciais.senha),
    ...(credenciais.cpfUsuario ? { cpfUsuario: credenciais.cpfUsuario.replace(/\D/g, '') } : {}),
  });
  if (resposta.statusCode === 404) throw new Error(`A Lista de Fotos da REP ${numero}/${ano} não foi encontrada no GDL.`);
  if (resposta.statusCode === 401 || resposta.statusCode === 403) throw new Error('Acesso à Lista de Fotos rejeitado pelo GDL.');
  if (resposta.statusCode !== 200) throw new Error(`Erro ao obter a Lista de Fotos do GDL (HTTP ${resposta.statusCode}).`);
  if (!resposta.caminhoTemporario) throw new Error('O GDL não retornou o arquivo da Lista de Fotos.')
  try {
    return {
      arquivos: criarArquivosDaListaFotos(lerEntradasZipDoArquivo(resposta.caminhoTemporario), rep.codRep),
      caminhoZip: resposta.caminhoTemporario,
      ambiente,
    }
  } catch (error) {
    fs.unlinkSync(resposta.caminhoTemporario)
    throw error
  }
}

export async function listarImagensRepGdl(numero: string, ano: string): Promise<ArquivoRepGdl[]> {
  const { arquivos, caminhoZip } = await baixarListaFotosRep(numero, ano);
  try {
    const entradasZip = lerEntradasZipDoArquivo(caminhoZip);
    return arquivos.map((arquivo, indice) => {
      const publico = paraArquivoPublico(arquivo);
      if (indice >= 30 || !arquivo.provavelImagem || arquivo.status) return publico;
      try {
        const entrada = entradasZip[arquivo.indiceEntradaZip];
        if (!entrada) return publico;
        const bytes = extrairEntradaZipDoArquivo(caminhoZip, entrada);
        if (!detectarMimeImagem(bytes)) return publico;
        return { ...publico, thumbnailDataUri: gerarThumbnailImagem(bytes) };
      } catch {
        return publico;
      }
    });
  } finally {
    if (fs.existsSync(caminhoZip)) fs.unlinkSync(caminhoZip)
  }
}

function limparSessoesFotosExpiradas(): void {
  const agora = Date.now()
  for (const [sessaoId, sessao] of sessoesFotosGdl) {
    if (sessao.expiraEm > agora) continue
    if (fs.existsSync(sessao.caminhoZip)) fs.unlinkSync(sessao.caminhoZip)
    sessoesFotosGdl.delete(sessaoId)
  }
}

function criarArquivosPublicosComMiniaturas(
  arquivos: ArquivoRepInterno[],
  entradasZip: EntradaZipFoto[],
  caminhoZip: string,
): ArquivoRepGdl[] {
  return arquivos.map((arquivo, indice) => {
    const publico = paraArquivoPublico(arquivo)
    if (indice >= 30 || !arquivo.provavelImagem || arquivo.status) return publico
    try {
      const entrada = entradasZip[arquivo.indiceEntradaZip]
      if (!entrada) return publico
      const bytes = extrairEntradaZipDoArquivo(caminhoZip, entrada)
      if (!detectarMimeImagem(bytes)) return publico
      return { ...publico, thumbnailDataUri: gerarThumbnailImagem(bytes) }
    } catch {
      return publico
    }
  })
}

export async function abrirSessaoImagensRepGdl(laudoId: string, numero: string, ano: string): Promise<ListaImagensRepGdl> {
  limparSessoesFotosExpiradas()
  const { arquivos, caminhoZip, ambiente } = await baixarListaFotosRep(numero, ano)
  try {
    const entradasZip = lerEntradasZipDoArquivo(caminhoZip)
    const sessaoId = randomUUID()
    sessoesFotosGdl.set(sessaoId, {
      laudoId,
      numero,
      ano,
      caminhoZip,
      arquivos,
      entradasZip,
      expiraEm: Date.now() + TEMPO_SESSAO_FOTOS_GDL_MS,
    })
    return {
      sessaoId,
      ambiente,
      numeroRep: numero,
      anoRep: ano,
      arquivos: criarArquivosPublicosComMiniaturas(arquivos, entradasZip, caminhoZip),
    }
  } catch (error) {
    if (fs.existsSync(caminhoZip)) fs.unlinkSync(caminhoZip)
    throw error
  }
}

export function fecharSessaoImagensRepGdl(laudoId: string, sessaoId: string): void {
  const sessao = sessoesFotosGdl.get(sessaoId)
  if (!sessao || sessao.laudoId !== laudoId) return
  if (fs.existsSync(sessao.caminhoZip)) fs.unlinkSync(sessao.caminhoZip)
  sessoesFotosGdl.delete(sessaoId)
}

function obterSessaoImagensRepGdl(laudoId: string, sessaoId: string): SessaoFotosGdl {
  limparSessoesFotosExpiradas()
  const sessao = sessoesFotosGdl.get(sessaoId)
  if (!sessao || sessao.laudoId !== laudoId) throw new Error('A sessão temporária da Lista de Fotos expirou. Consulte novamente.')
  sessao.expiraEm = Date.now() + TEMPO_SESSAO_FOTOS_GDL_MS
  return sessao
}

export async function capturarImagensRepGdl(
  numero: string,
  ano: string,
  idsSelecao: string[],
): Promise<ResultadoCapturaImagensRepGdl> {
  const idsUnicos = [...new Set(idsSelecao)];
  if (idsUnicos.length === 0) return { imagens: [], falhas: [] };

  const { arquivos, caminhoZip } = await baixarListaFotosRep(numero, ano);
  try {
    const porId = new Map(arquivos.map(arquivo => [arquivo.idSelecao, arquivo]));
    const entradasZip = lerEntradasZipDoArquivo(caminhoZip);
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
      const bytes = extrairEntradaZipDoArquivo(caminhoZip, entrada);
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
  } finally {
    if (fs.existsSync(caminhoZip)) fs.unlinkSync(caminhoZip)
  }
}

export async function capturarImagensRepGdlParaLaudo(
  numero: string,
  ano: string,
  idsSelecao: string[],
  salvarImagem: (imagem: { idSelecao: string; nomeArquivo: string; mimeType: string; bytes: Buffer; sha256: string }) => Promise<ImagemRepGdlAdicionadaAoLaudo | DuplicataImagemRepGdl>,
): Promise<ResultadoCapturaImagensLaudoGdl> {
  const idsUnicos = [...new Set(idsSelecao)]
  if (idsUnicos.length === 0) return { imagens: [], falhas: [], duplicadas: [] }

  const { arquivos, caminhoZip } = await baixarListaFotosRep(numero, ano)
  try {
    const porId = new Map(arquivos.map(arquivo => [arquivo.idSelecao, arquivo]))
    const entradasZip = lerEntradasZipDoArquivo(caminhoZip)
    const imagens: ImagemRepGdlAdicionadaAoLaudo[] = []
    const falhas: ResultadoCapturaImagensLaudoGdl['falhas'] = []
    const duplicadas: ResultadoCapturaImagensLaudoGdl['duplicadas'] = []
    const hashesCapturados = new Set<string>()

    for (const idSelecao of idsUnicos) {
    const arquivo = porId.get(idSelecao)
    if (!arquivo || !arquivo.provavelImagem || arquivo.status) {
      falhas.push({ idSelecao, erro: 'Foto indisponível para captura na Lista de Fotos.' })
      continue
    }
    try {
      const entrada = entradasZip[arquivo.indiceEntradaZip]
      if (!entrada) throw new Error('A foto não foi encontrada no arquivo retornado pelo GDL.')
      const bytes = extrairEntradaZipDoArquivo(caminhoZip, entrada)
      if (bytes.length === 0) throw new Error('O GDL retornou um arquivo vazio.')
      const mimeType = detectarMimeImagem(bytes)
      if (!mimeType) throw new Error('O conteúdo baixado não é uma imagem compatível.')
      const sha256 = createHash('sha256').update(bytes).digest('hex')
      if (hashesCapturados.has(sha256)) {
        falhas.push({ idSelecao, erro: 'Imagem duplicada nesta captura.' })
        continue
      }
      hashesCapturados.add(sha256)
      const resultado = await salvarImagem({ idSelecao, nomeArquivo: arquivo.nomeArquivo, mimeType, bytes, sha256 })
      if ('imagemExistenteId' in resultado) duplicadas.push(resultado)
      else imagens.push(resultado)
    } catch (erro) {
      falhas.push({ idSelecao, erro: erro instanceof Error ? erro.message : 'Erro inesperado ao capturar arquivo.' })
    }
    }
    return { imagens, falhas, duplicadas }
  } finally {
    if (fs.existsSync(caminhoZip)) fs.unlinkSync(caminhoZip)
  }
}

export async function capturarImagensDaSessaoGdlParaLaudo(
  laudoId: string,
  sessaoId: string,
  idsSelecao: string[],
  salvarImagem: (imagem: { idSelecao: string; nomeArquivo: string; mimeType: string; bytes: Buffer; sha256: string }) => Promise<ImagemRepGdlAdicionadaAoLaudo | DuplicataImagemRepGdl>,
): Promise<ResultadoCapturaImagensLaudoGdl> {
  const idsUnicos = [...new Set(idsSelecao)]
  if (idsUnicos.length === 0) return { imagens: [], falhas: [], duplicadas: [] }
  const sessao = obterSessaoImagensRepGdl(laudoId, sessaoId)
  const porId = new Map(sessao.arquivos.map(arquivo => [arquivo.idSelecao, arquivo]))
  const imagens: ImagemRepGdlAdicionadaAoLaudo[] = []
  const falhas: ResultadoCapturaImagensLaudoGdl['falhas'] = []
  const duplicadas: ResultadoCapturaImagensLaudoGdl['duplicadas'] = []
  const hashesCapturados = new Set<string>()

  for (const idSelecao of idsUnicos) {
    const arquivo = porId.get(idSelecao)
    if (!arquivo || !arquivo.provavelImagem || arquivo.status) {
      falhas.push({ idSelecao, erro: 'Foto indisponível para captura na Lista de Fotos.' })
      continue
    }
    try {
      const entrada = sessao.entradasZip[arquivo.indiceEntradaZip]
      if (!entrada) throw new Error('A foto não foi encontrada no arquivo retornado pelo GDL.')
      const bytes = extrairEntradaZipDoArquivo(sessao.caminhoZip, entrada)
      if (bytes.length === 0) throw new Error('O GDL retornou um arquivo vazio.')
      const mimeType = detectarMimeImagem(bytes)
      if (!mimeType) throw new Error('O conteúdo baixado não é uma imagem compatível.')
      const sha256 = createHash('sha256').update(bytes).digest('hex')
      if (hashesCapturados.has(sha256)) {
        falhas.push({ idSelecao, erro: 'Imagem duplicada nesta captura.' })
        continue
      }
      hashesCapturados.add(sha256)
      const resultado = await salvarImagem({ idSelecao, nomeArquivo: arquivo.nomeArquivo, mimeType, bytes, sha256 })
      if ('imagemExistenteId' in resultado) duplicadas.push(resultado)
      else imagens.push(resultado)
    } catch (erro) {
      falhas.push({ idSelecao, erro: erro instanceof Error ? erro.message : 'Erro inesperado ao capturar arquivo.' })
    }
  }
  return { imagens, falhas, duplicadas }
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

    const numeroNormalizado = numero.replace(/\D/g, '');
    const url = `${baseUrl}/rep/obter?numero=${encodeURIComponent(numeroNormalizado)}&ano=${encodeURIComponent(ano)}`;
    log.debug('Validando credenciais GDL por consulta real', { numero, ano, ambiente: amb });

    const { statusCode, data } = await requisitarGdl(url, 'GET', headers, undefined, 15000);

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
