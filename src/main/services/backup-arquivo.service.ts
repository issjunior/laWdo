import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
const ASSINATURA = Buffer.from('LAWDO-BKP-1\n', 'ascii');
const TAMANHO_SAL = 16;
const TAMANHO_IV = 12;
const TAMANHO_TAG = 16;
const TAMANHO_CABECALHO = ASSINATURA.length + TAMANHO_SAL + TAMANHO_IV;
const LIMITE_ARQUIVO = 20 * 1024 * 1024 * 1024;
const LIMITE_ENTRADAS = 100_000;

export type TipoBackup = 'completo' | 'configuracao';

export interface EntradaBackup {
  nome: string;
  caminho?: string;
  conteudo?: Buffer;
}

export interface ManifestoBackup {
  formato: 1;
  tipo: TipoBackup;
  criadoEm: string;
  versaoAplicativo: string;
  versaoSchema: number;
  arquivos: Array<{ nome: string; tamanho: number; sha256: string }>;
}

function nomeSeguro(nome: string): boolean {
  const segmentos = nome.split('/');
  return nome.length > 0 && nome.length < 500 && !/[\\:]/.test(nome)
    && ![...nome].some(caractere => caractere.charCodeAt(0) < 32)
    && segmentos.every(segmento => segmento !== '' && segmento !== '.' && segmento !== '..');
}

async function chave(senha: string, sal: Buffer): Promise<Buffer> {
  if (senha.length < 12) throw new Error('A senha do backup deve ter ao menos 12 caracteres.');
  return await new Promise<Buffer>((resolve, reject) => {
    scrypt(senha, sal, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (erro, derivada) => {
      if (erro) reject(erro);
      else resolve(derivada);
    });
  });
}

async function hashArquivo(caminho: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const parte of createReadStream(caminho)) hash.update(parte as Buffer);
  return hash.digest('hex');
}

async function* serializarEntradas(entradas: EntradaBackup[], manifesto: ManifestoBackup): AsyncGenerator<Buffer> {
  const itens: EntradaBackup[] = [{ nome: 'manifesto.json', conteudo: Buffer.from(JSON.stringify(manifesto), 'utf8') }, ...entradas];
  for (const entrada of itens) {
    const tamanho = entrada.conteudo?.length ?? (await stat(entrada.caminho as string)).size;
    const metadados = Buffer.from(JSON.stringify({ nome: entrada.nome, tamanho }), 'utf8');
    const prefixo = Buffer.alloc(4);
    prefixo.writeUInt32BE(metadados.length);
    yield prefixo;
    yield metadados;
    if (entrada.conteudo) yield entrada.conteudo;
    else {
      const hash = createHash('sha256');
      let total = 0;
      for await (const parte of createReadStream(entrada.caminho as string)) {
        const bytes = parte as Buffer;
        total += bytes.length;
        hash.update(bytes);
        yield bytes;
      }
      const esperado = manifesto.arquivos.find(item => item.nome === entrada.nome);
      if (!esperado || total !== esperado.tamanho || hash.digest('hex') !== esperado.sha256) {
        throw new Error(`Arquivo alterado durante a criação do backup: ${entrada.nome}.`);
      }
    }
  }
  yield Buffer.alloc(4);
}

export async function criarArquivoBackup(
  destino: string,
  senha: string,
  tipo: TipoBackup,
  versaoAplicativo: string,
  versaoSchema: number,
  entradas: EntradaBackup[],
): Promise<ManifestoBackup> {
  if (entradas.length > LIMITE_ENTRADAS || entradas.some(entrada => !nomeSeguro(entrada.nome) || entrada.nome === 'manifesto.json')) {
    throw new Error('Entradas do backup inválidas.');
  }
  const nomes = new Set(entradas.map(entrada => entrada.nome));
  if (nomes.size !== entradas.length) throw new Error('Entradas repetidas no backup.');
  const arquivos: ManifestoBackup['arquivos'] = [];
  let total = 0;
  for (const entrada of entradas) {
    const tamanho = entrada.conteudo?.length ?? (await stat(entrada.caminho as string)).size;
    total += tamanho;
    if (tamanho > LIMITE_ARQUIVO || total > LIMITE_ARQUIVO) throw new Error('Arquivo excede o limite do backup.');
    arquivos.push({
      nome: entrada.nome,
      tamanho,
      sha256: entrada.conteudo
        ? createHash('sha256').update(entrada.conteudo).digest('hex')
        : await hashArquivo(entrada.caminho as string),
    });
  }
  const manifesto: ManifestoBackup = {
    formato: 1, tipo, criadoEm: new Date().toISOString(), versaoAplicativo, versaoSchema, arquivos,
  };
  const sal = randomBytes(TAMANHO_SAL);
  const iv = randomBytes(TAMANHO_IV);
  const segredo = await chave(senha, sal);
  const temporario = `${destino}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    await mkdir(path.dirname(destino), { recursive: true });
    const arquivo = await open(temporario, 'wx');
    await arquivo.write(Buffer.concat([ASSINATURA, sal, iv]));
    await arquivo.close();
    const cifrador = createCipheriv('aes-256-gcm', segredo, iv);
    await pipeline(Readable.from(serializarEntradas(entradas, manifesto)), cifrador, createWriteStream(temporario, { flags: 'a' }));
    const final = await open(temporario, 'a');
    await final.write(cifrador.getAuthTag());
    await final.close();
    await rename(temporario, destino);
    return manifesto;
  } catch (erro) {
    await rm(temporario, { force: true }).catch(() => undefined);
    throw erro;
  } finally {
    segredo.fill(0);
  }
}

async function lerExatamente(arquivo: Awaited<ReturnType<typeof open>>, tamanho: number, posicao: number): Promise<Buffer> {
  const buffer = Buffer.alloc(tamanho);
  let lidos = 0;
  while (lidos < tamanho) {
    const resposta = await arquivo.read(buffer, lidos, tamanho - lidos, posicao + lidos);
    if (resposta.bytesRead === 0) throw new Error('Backup truncado.');
    lidos += resposta.bytesRead;
  }
  return buffer;
}

export async function extrairArquivoBackup(origem: string, senha: string, diretorio: string): Promise<ManifestoBackup> {
  const tamanho = (await stat(origem)).size;
  if (tamanho < TAMANHO_CABECALHO + TAMANHO_TAG || tamanho > LIMITE_ARQUIVO) throw new Error('Tamanho do backup inválido.');
  const arquivoOrigem = await open(origem, 'r');
  let sal: Buffer;
  let iv: Buffer;
  let tag: Buffer;
  try {
    const cabecalho = await lerExatamente(arquivoOrigem, TAMANHO_CABECALHO, 0);
    if (!cabecalho.subarray(0, ASSINATURA.length).equals(ASSINATURA)) throw new Error('Formato do backup não reconhecido.');
    sal = cabecalho.subarray(ASSINATURA.length, ASSINATURA.length + TAMANHO_SAL);
    iv = cabecalho.subarray(ASSINATURA.length + TAMANHO_SAL);
    tag = await lerExatamente(arquivoOrigem, TAMANHO_TAG, tamanho - TAMANHO_TAG);
  } finally {
    await arquivoOrigem.close();
  }
  const segredo = await chave(senha, sal);
  const payload = path.join(diretorio, 'payload.tmp');
  try {
    await mkdir(diretorio, { recursive: true });
    const decifrador = createDecipheriv('aes-256-gcm', segredo, iv);
    decifrador.setAuthTag(tag);
    await pipeline(
      createReadStream(origem, { start: TAMANHO_CABECALHO, end: tamanho - TAMANHO_TAG - 1 }),
      decifrador,
      createWriteStream(payload, { flags: 'wx' }),
    );
    return await extrairPayload(payload, diretorio);
  } catch (erro) {
    await rm(diretorio, { recursive: true, force: true }).catch(() => undefined);
    if (erro instanceof Error && /authenticat|authenticate/i.test(erro.message)) throw new Error('Senha incorreta ou backup alterado.');
    throw erro;
  } finally {
    segredo.fill(0);
    await rm(payload, { force: true }).catch(() => undefined);
  }
}

async function extrairPayload(payload: string, diretorio: string): Promise<ManifestoBackup> {
  const arquivo = await open(payload, 'r');
  let posicao = 0;
  let manifesto: ManifestoBackup | null = null;
  const entradas = new Map<string, { tamanho: number; sha256: string }>();
  try {
    const limite = (await arquivo.stat()).size;
    while (posicao + 4 <= limite) {
      const tamanhoCabecalho = (await lerExatamente(arquivo, 4, posicao)).readUInt32BE();
      posicao += 4;
      if (tamanhoCabecalho === 0) break;
      if (tamanhoCabecalho > 2048 || entradas.size >= LIMITE_ENTRADAS + 1) throw new Error('Cabeçalho do backup inválido.');
      const raw: unknown = JSON.parse((await lerExatamente(arquivo, tamanhoCabecalho, posicao)).toString('utf8'));
      posicao += tamanhoCabecalho;
      if (!raw || typeof raw !== 'object' || !('nome' in raw) || !('tamanho' in raw)
        || typeof raw.nome !== 'string' || !nomeSeguro(raw.nome)
        || typeof raw.tamanho !== 'number' || !Number.isSafeInteger(raw.tamanho)
        || raw.tamanho < 0 || raw.tamanho > LIMITE_ARQUIVO || posicao + raw.tamanho > limite
        || entradas.has(raw.nome)) throw new Error('Entrada do backup inválida.');
      if (entradas.size === 0 && raw.nome !== 'manifesto.json') throw new Error('Manifesto ausente no início do backup.');
      if (raw.nome === 'manifesto.json' && raw.tamanho > 16 * 1024 * 1024) throw new Error('Manifesto do backup excede o limite.');
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
        const parsed: unknown = JSON.parse((await readFile(destino)).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || !('formato' in parsed) || parsed.formato !== 1
          || !('tipo' in parsed) || !['completo', 'configuracao'].includes(String(parsed.tipo))
          || !('arquivos' in parsed) || !Array.isArray(parsed.arquivos)) throw new Error('Manifesto do backup inválido.');
        manifesto = parsed as ManifestoBackup;
        if (manifesto.arquivos.length > LIMITE_ENTRADAS || !manifesto.arquivos.every(item =>
          item && typeof item.nome === 'string' && nomeSeguro(item.nome) && item.nome !== 'manifesto.json'
          && Number.isSafeInteger(item.tamanho) && item.tamanho >= 0
          && typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256))) {
          throw new Error('Manifesto do backup inválido.');
        }
      }
    }
    if (posicao !== limite || !manifesto || entradas.size !== manifesto.arquivos.length + 1) throw new Error('Backup incompleto.');
    for (const item of manifesto.arquivos) {
      const extraido = entradas.get(item.nome);
      if (!extraido || extraido.tamanho !== item.tamanho || extraido.sha256 !== item.sha256) throw new Error('Integridade do backup inválida.');
    }
    return manifesto;
  } finally {
    await arquivo.close();
  }
}
