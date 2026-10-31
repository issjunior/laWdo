import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
const ASSINATURA = Buffer.from('LAWDO-LAUDO-1\n', 'ascii');
const LIMITE_ARQUIVO = 20 * 1024 * 1024 * 1024;
const LIMITE_ENTRADAS = 100_000;

const esquemaManifesto = z.object({
  formato: z.literal(1),
  tipo: z.literal('laudo'),
  criadoEm: z.string().datetime(),
  versaoAplicativo: z.string().min(1).max(100),
  arquivos: z.array(z.object({
    nome: z.string().refine(nomeSeguro).refine(nome => nome !== 'manifesto.json'),
    tamanho: z.number().int().min(0).max(LIMITE_ARQUIVO),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict()).max(LIMITE_ENTRADAS),
}).strict().refine(manifesto => new Set(manifesto.arquivos.map(item => item.nome)).size === manifesto.arquivos.length);

export type ManifestoArquivoLaudo = z.infer<typeof esquemaManifesto>;
export type EntradaArquivoLaudo = { nome: string } & (
  { caminho: string; conteudo?: never } | { conteudo: Buffer; caminho?: never }
);

function nomeSeguro(nome: string): boolean {
  const segmentos = nome.split('/');
  return nome.length > 0 && nome.length < 500 && !/[\\:]/.test(nome)
    && ![...nome].some(caractere => caractere.charCodeAt(0) < 32)
    && segmentos.every(segmento => segmento !== '' && !/[. ]$/.test(segmento)
      && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segmento));
}

async function hashArquivo(caminho: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const parte of createReadStream(caminho)) hash.update(parte as Buffer);
  return hash.digest('hex');
}

async function* serializarEntradas(entradas: EntradaArquivoLaudo[], manifesto: ManifestoArquivoLaudo): AsyncGenerator<Buffer> {
  const declaradas = new Map(manifesto.arquivos.map(item => [item.nome, item]));
  const itens: EntradaArquivoLaudo[] = [{ nome: 'manifesto.json', conteudo: Buffer.from(JSON.stringify(manifesto), 'utf8') }, ...entradas];
  for (const entrada of itens) {
    const tamanho = entrada.conteudo?.length ?? (await stat(entrada.caminho!)).size;
    const metadados = Buffer.from(JSON.stringify({ nome: entrada.nome, tamanho }), 'utf8');
    const prefixo = Buffer.alloc(4);
    prefixo.writeUInt32BE(metadados.length);
    yield prefixo;
    yield metadados;
    if (entrada.conteudo) yield entrada.conteudo;
    else {
      const hash = createHash('sha256');
      let total = 0;
      for await (const parte of createReadStream(entrada.caminho!)) {
        const bytes = parte as Buffer;
        total += bytes.length;
        hash.update(bytes);
        yield bytes;
      }
      const esperado = declaradas.get(entrada.nome);
      if (!esperado || total !== esperado.tamanho || hash.digest('hex') !== esperado.sha256) {
        throw new Error(`Arquivo alterado durante a criação do BKP: ${entrada.nome}.`);
      }
    }
  }
  yield Buffer.alloc(4);
}

export async function criarArquivoLaudo(
  destino: string,
  versaoAplicativo: string,
  entradas: EntradaArquivoLaudo[],
): Promise<ManifestoArquivoLaudo> {
  if (entradas.length > LIMITE_ENTRADAS || entradas.some(entrada => !nomeSeguro(entrada.nome) || entrada.nome === 'manifesto.json')) {
    throw new Error('Entradas do BKP inválidas.');
  }
  const nomes = new Set(entradas.map(entrada => entrada.nome));
  if (nomes.size !== entradas.length) throw new Error('Entradas repetidas no BKP.');
  const arquivos: ManifestoArquivoLaudo['arquivos'] = [];
  let total = ASSINATURA.length + 4;
  for (const entrada of entradas) {
    const tamanho = entrada.conteudo?.length ?? (await stat(entrada.caminho!)).size;
    if (entrada.nome.endsWith('.json') && tamanho > 64 * 1024 * 1024) throw new Error('JSON excede o limite do BKP.');
    total += tamanho + Buffer.byteLength(JSON.stringify({ nome: entrada.nome, tamanho })) + 4;
    if (tamanho > LIMITE_ARQUIVO || total > LIMITE_ARQUIVO) throw new Error('Arquivo excede o limite do BKP.');
    arquivos.push({
      nome: entrada.nome,
      tamanho,
      sha256: entrada.conteudo
        ? createHash('sha256').update(entrada.conteudo).digest('hex')
        : await hashArquivo(entrada.caminho!),
    });
  }
  const manifesto = esquemaManifesto.parse({
    formato: 1, tipo: 'laudo', criadoEm: new Date().toISOString(), versaoAplicativo, arquivos,
  });
  if (Buffer.byteLength(JSON.stringify(manifesto)) > 64 * 1024 * 1024) throw new Error('Manifesto excede o limite do BKP.');
  const temporario = `${destino}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    await mkdir(path.dirname(destino), { recursive: true });
    const arquivo = await open(temporario, 'wx');
    await arquivo.write(ASSINATURA);
    await arquivo.close();
    await pipeline(Readable.from(serializarEntradas(entradas, manifesto)), createWriteStream(temporario, { flags: 'a' }));
    if ((await stat(temporario)).size > LIMITE_ARQUIVO) throw new Error('Arquivo excede o limite do BKP.');
    await rename(temporario, destino);
    return manifesto;
  } catch (erro) {
    await rm(temporario, { force: true }).catch(() => undefined);
    throw erro;
  }
}

async function lerExatamente(arquivo: Awaited<ReturnType<typeof open>>, tamanho: number, posicao: number): Promise<Buffer> {
  const buffer = Buffer.alloc(tamanho);
  let lidos = 0;
  while (lidos < tamanho) {
    const resposta = await arquivo.read(buffer, lidos, tamanho - lidos, posicao + lidos);
    if (resposta.bytesRead === 0) throw new Error('BKP truncado.');
    lidos += resposta.bytesRead;
  }
  return buffer;
}

export async function extrairArquivoLaudo(origem: string, diretorio: string): Promise<ManifestoArquivoLaudo> {
  const tamanho = (await stat(origem)).size;
  if (tamanho > LIMITE_ARQUIVO || tamanho < ASSINATURA.length + 4) throw new Error('Tamanho do BKP inválido.');
  const arquivo = await open(origem, 'r');
  try {
    if (!(await lerExatamente(arquivo, ASSINATURA.length, 0)).equals(ASSINATURA)) throw new Error('Formato de BKP não reconhecido.');
  } finally { await arquivo.close(); }
  await mkdir(diretorio, { recursive: false });
  try {
    return await extrairPayload(origem, diretorio);
  } catch (erro) {
    await rm(diretorio, { recursive: true, force: true });
    throw erro;
  }
}

async function extrairPayload(payload: string, diretorio: string): Promise<ManifestoArquivoLaudo> {
  const arquivo = await open(payload, 'r');
  let posicao = ASSINATURA.length;
  let manifesto: ManifestoArquivoLaudo | null = null;
  let terminou = false;
  const declaradas = new Map<string, ManifestoArquivoLaudo['arquivos'][number]>();
  const entradas = new Map<string, { tamanho: number; sha256: string }>();
  try {
    const limite = (await arquivo.stat()).size;
    while (posicao + 4 <= limite) {
      const tamanhoCabecalho = (await lerExatamente(arquivo, 4, posicao)).readUInt32BE();
      posicao += 4;
      if (tamanhoCabecalho === 0) { terminou = true; break; }
      if (tamanhoCabecalho > 2048 || entradas.size >= LIMITE_ENTRADAS + 1) throw new Error('Cabeçalho do BKP inválido.');
      const raw: unknown = JSON.parse((await lerExatamente(arquivo, tamanhoCabecalho, posicao)).toString('utf8'));
      posicao += tamanhoCabecalho;
      if (!raw || typeof raw !== 'object' || !('nome' in raw) || !('tamanho' in raw)
        || typeof raw.nome !== 'string' || !nomeSeguro(raw.nome)
        || typeof raw.tamanho !== 'number' || !Number.isSafeInteger(raw.tamanho)
        || raw.tamanho < 0 || raw.tamanho > LIMITE_ARQUIVO || posicao + raw.tamanho > limite
        || entradas.has(raw.nome)) throw new Error('Entrada do BKP inválida.');
      if (entradas.size === 0 && raw.nome !== 'manifesto.json') throw new Error('Manifesto ausente no início do BKP.');
      if (raw.nome.endsWith('.json') && raw.tamanho > 64 * 1024 * 1024) throw new Error('Manifesto do BKP excede o limite.');
      if (raw.nome !== 'manifesto.json') {
        const esperado = declaradas.get(raw.nome);
        if (!esperado || esperado.tamanho !== raw.tamanho) throw new Error('Entrada não declarada no manifesto.');
      }
      const destino = path.join(diretorio, raw.nome);
      await mkdir(path.dirname(destino), { recursive: true });
      const saida = await open(destino, 'wx');
      const hash = createHash('sha256');
      try {
        let restante = raw.tamanho;
        while (restante > 0) {
          const parte = await lerExatamente(arquivo, Math.min(restante, 1024 * 1024), posicao);
          await saida.write(parte);
          hash.update(parte);
          posicao += parte.length;
          restante -= parte.length;
        }
      } finally {
        await saida.close();
      }
      entradas.set(raw.nome, { tamanho: raw.tamanho, sha256: hash.digest('hex') });
      if (raw.nome === 'manifesto.json') {
        manifesto = esquemaManifesto.parse(JSON.parse((await readFile(destino)).toString('utf8')));
        for (const item of manifesto.arquivos) declaradas.set(item.nome, item);
      }
    }
    if (!terminou || posicao !== limite || !manifesto || entradas.size !== manifesto.arquivos.length + 1) throw new Error('Backup incompleto.');
    for (const item of manifesto.arquivos) {
      const extraido = entradas.get(item.nome);
      if (!extraido || extraido.tamanho !== item.tamanho || extraido.sha256 !== item.sha256) throw new Error('Integridade do BKP inválida.');
    }
    return manifesto;
  } finally {
    await arquivo.close();
  }
}
