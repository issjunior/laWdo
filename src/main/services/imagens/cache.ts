import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImagemTransformada } from './contratos.js';

const padraoChave = /^[a-f0-9]{64}$/;

export class CacheImagens {
  private memoria = new Map<string, ImagemTransformada>();
  private bytesMemoria = 0;
  private gravacoes: Promise<unknown> = Promise.resolve();
  private acessos = new Map<string, number>();
  constructor(private diretorio: string, private limiteMemoria = 64 * 1024 * 1024, private limiteDisco = 256 * 1024 * 1024) {}

  private memorizar(chave: string, imagem: ImagemTransformada): void {
    this.bytesMemoria -= this.memoria.get(chave)?.bytes.byteLength ?? 0;
    this.memoria.delete(chave);
    if (imagem.bytes.byteLength <= this.limiteMemoria) {
      this.memoria.set(chave, imagem);
      this.bytesMemoria += imagem.bytes.byteLength;
    }
    while (this.bytesMemoria > this.limiteMemoria) {
      const primeira = this.memoria.entries().next().value;
      if (!primeira) break;
      this.memoria.delete(primeira[0]);
      this.acessos.delete(primeira[0]);
      this.bytesMemoria -= primeira[1].bytes.byteLength;
    }
  }

  async obter(chave: string): Promise<ImagemTransformada | undefined> {
    if (!padraoChave.test(chave)) throw new Error('Chave de cache inválida.');
    const lembrada = this.memoria.get(chave);
    if (lembrada) {
      this.memorizar(chave, lembrada);
      const agora = Date.now();
      if (agora - (this.acessos.get(chave) ?? 0) > 30_000) {
        this.acessos.set(chave, agora);
        void utimes(path.join(this.diretorio, `${chave}.json`), new Date(), new Date()).catch(() => undefined);
      }
      return { ...lembrada, bytes: Buffer.from(lembrada.bytes) };
    }
    const arquivo = path.join(this.diretorio, `${chave}.json`);
    try {
      if ((await stat(arquivo)).size > Math.min(this.limiteDisco, 70 * 1024 * 1024)) return undefined;
      const valor: unknown = JSON.parse(await readFile(arquivo, 'utf8'));
      if (!valor || typeof valor !== 'object' || !('bytes' in valor) || typeof valor.bytes !== 'string'
        || !('mimeType' in valor) || typeof valor.mimeType !== 'string' || !/^image\/(jpeg|png|gif|bmp|webp)$/.test(valor.mimeType)
        || !('sha256' in valor) || typeof valor.sha256 !== 'string') return undefined;
      const bytes = Buffer.from(valor.bytes, 'base64');
      if (!bytes.length || createHash('sha256').update(bytes).digest('hex') !== valor.sha256) return undefined;
      const imagem = { bytes, mimeType: valor.mimeType };
      this.memorizar(chave, imagem);
      await utimes(arquivo, new Date(), new Date()).catch(() => undefined);
      return { ...imagem, bytes: Buffer.from(bytes) };
    } catch { return undefined; }
  }

  async salvar(chave: string, imagem: ImagemTransformada): Promise<void> {
    if (!padraoChave.test(chave)) throw new Error('Chave de cache inválida.');
    this.memorizar(chave, { ...imagem, bytes: Buffer.from(imagem.bytes) });
    const salvar = async () => {
      let temporario: string | undefined;
      try {
        const conteudo = JSON.stringify({ mimeType: imagem.mimeType, bytes: Buffer.from(imagem.bytes).toString('base64'),
          sha256: createHash('sha256').update(imagem.bytes).digest('hex') });
        if (Buffer.byteLength(conteudo) > this.limiteDisco) return;
        await mkdir(this.diretorio, { recursive: true });
        const arquivo = path.join(this.diretorio, `${chave}.json`);
        temporario = `${arquivo}.${randomUUID()}.tmp`;
        await writeFile(temporario, conteudo, { flag: 'wx' });
        await rename(temporario, arquivo);
        temporario = undefined;
        const arquivos = await Promise.all((await readdir(this.diretorio)).filter(nome => /^[a-f0-9]{64}\.json$/.test(nome))
          .map(async nome => ({ caminho: path.join(this.diretorio, nome), dados: await stat(path.join(this.diretorio, nome)) })));
        arquivos.sort((a, b) => a.caminho === arquivo ? -1 : b.caminho === arquivo ? 1 : b.dados.mtimeMs - a.dados.mtimeMs);
        let total = 0;
        for (const [indice, item] of arquivos.entries()) {
          total += item.dados.size;
          if (total > this.limiteDisco || indice >= 1000) await rm(item.caminho, { force: true });
        }
      } catch { /* Cache é descartável e não impede o uso da imagem original. */ }
      finally { if (temporario) await rm(temporario, { force: true }).catch(() => undefined); }
    };
    const resultado = this.gravacoes.then(salvar);
    this.gravacoes = resultado.catch(() => undefined);
    await resultado;
  }
}
