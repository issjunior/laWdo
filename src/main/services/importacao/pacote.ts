import AdmZip from 'adm-zip';
import { inflateRawSync } from 'zlib';
import { Parser, parseDocument, DomUtils } from 'htmlparser2';
import { validarArvore, type ElementoDocumento } from './estrutura.js';

interface EntradaZip {
  entryName: string;
  header: { size: number; compressedSize: number; flags: number; method: number; crc: number };
  getCompressedData: () => Buffer;
}
const objeto = (valor: unknown): valor is Record<string, unknown> => valor !== null && typeof valor === 'object';
const entradaValida = (valor: unknown): valor is EntradaZip => objeto(valor) && typeof valor.entryName === 'string'
  && typeof valor.getCompressedData === 'function' && objeto(valor.header)
  && ['size', 'compressedSize', 'flags', 'method', 'crc'].every(campo => Number.isSafeInteger(valor.header && objeto(valor.header) ? valor.header[campo] : undefined));

export function abrirPacoteDocumento(dados: Buffer): Map<string, EntradaZip> {
  if (dados.readUInt32LE(0) !== 0x04034b50) throw new Error('Documento não é um pacote ZIP válido ou está protegido');
  const pacote = new AdmZip(dados);
  const entradas: unknown[] = pacote.getEntries();
  if (entradas.length > 2000) throw new Error('Documento contém mais de 2000 entradas');
  const resultado = new Map<string, EntradaZip>();
  let tamanho = 0;
  for (const entrada of entradas) {
    if (!entradaValida(entrada)) throw new Error('Estrutura ZIP inválida');
    const nome = entrada.entryName;
    if (nome.startsWith('/') || nome.includes('\\') || nome.includes('\0') || nome.split('/').includes('..') || /^[a-z]:/i.test(nome) || resultado.has(nome)) throw new Error('Caminho inválido ou duplicado no documento');
    if ((entrada.header.flags & 1) !== 0) throw new Error('Documento criptografado. Forneça uma cópia desprotegida.');
    tamanho += entrada.header.size;
    if (entrada.header.size < 0 || entrada.header.size > 32 * 1024 * 1024 || tamanho > 80 * 1024 * 1024) throw new Error('Documento excede o limite descompactado (32 MB por entrada, 80 MB no total)');
    resultado.set(nome, entrada);
  }
  return resultado;
}

export function lerEntrada(pacote: Map<string, EntradaZip>, nome: string, obrigatoria = true): string {
  const entrada = pacote.get(nome);
  if (!entrada) {
    if (obrigatoria) throw new Error(`Documento inválido: ${nome} ausente`);
    return '';
  }
  if (entrada.header.size > 12 * 1024 * 1024) throw new Error('XML do documento excede o limite de 12 MB');
  const comprimido = entrada.getCompressedData();
  const dados = entrada.header.method === 0 ? comprimido : entrada.header.method === 8
    ? inflateRawSync(comprimido, { maxOutputLength: 12 * 1024 * 1024 }) : null;
  if (!dados || dados.length !== entrada.header.size || dados.length > 12 * 1024 * 1024) throw new Error('Conteúdo ZIP inválido');
  let crc = 0xffffffff;
  for (const byte of dados) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  if (((crc ^ 0xffffffff) >>> 0) !== (entrada.header.crc >>> 0)) throw new Error('Documento corrompido: CRC inválido');
  return dados.toString('utf8');
}

export function lerXmlSeguro(xml: string): ReturnType<typeof parseDocument> {
  if (/<!\s*(DOCTYPE|ENTITY)/i.test(xml) || /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/i.test(xml)) throw new Error('XML com DTD ou entidades não permitidas');
  let profundidade = 0;
  let quantidade = 0;
  let raizes = 0;
  const abertos: string[] = [];
  const parser: Parser = new Parser({
    onopentag: nome => {
      if (profundidade === 0) raizes++;
      if (++profundidade > 80 || ++quantidade > 100_000) throw new Error('XML excede o limite de complexidade');
      abertos.push(nome);
    },
    onclosetag: (nome, implicito) => {
      if ((implicito && !/\/\s*>$/.test(xml.slice(parser.startIndex, parser.endIndex + 1))) || abertos.pop() !== nome) throw new Error('XML malformado: fechamento de elemento inválido');
      profundidade--;
    },
    ontext: valor => { if (profundidade === 0 && valor.trim()) throw new Error('XML malformado: texto fora da raiz'); },
  }, { xmlMode: true });
  parser.end(xml);
  if (raizes !== 1 || profundidade !== 0) throw new Error('XML malformado: raiz inválida');
  const documento = parseDocument(xml, { xmlMode: true, decodeEntities: true });
  validarArvore(documento.children);
  return documento;
}

function namespace(elemento: ElementoDocumento, prefixo: string): string {
  let no: ElementoDocumento | null = elemento;
  while (no) {
    const valor = no.attribs[prefixo ? `xmlns:${prefixo}` : 'xmlns'];
    if (valor !== undefined) return valor;
    no = no.parent && DomUtils.isTag(no.parent) ? no.parent : null;
  }
  return '';
}

export function nomeXml(elemento: ElementoDocumento): string {
  const partes = elemento.name.split(':');
  return `${namespace(elemento, partes.length > 1 ? partes[0] : '')}|${partes.at(-1)}`;
}

export function atributoXml(elemento: ElementoDocumento, uri: string, nome: string): string {
  for (const [chave, valor] of Object.entries(elemento.attribs)) {
    const partes = chave.split(':');
    if (partes.length === 2 && partes[1] === nome && namespace(elemento, partes[0]) === uri) return valor;
  }
  return '';
}
