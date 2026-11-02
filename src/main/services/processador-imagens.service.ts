import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { app, nativeImage, utilityProcess } from 'electron';
import { CacheImagens } from './imagens/cache.js';
import { FilaImagens } from './imagens/fila.js';
import { lerBitmapBmp } from './imagens/bmp.js';
import { resultadoImagemValido, transformacaoImagemValida, type ImagemTransformada, type TransformacaoImagem } from './imagens/contratos.js';

const contexto = new AsyncLocalStorage<{ identificador: string; geracao: number }>();
let auxiliar: Electron.UtilityProcess | undefined;
let sequencia = 0;
let geracaoAuxiliar = 0;
let aguardando: { id: number; resolver: (valor: ImagemTransformada) => void; rejeitar: (erro: Error) => void } | undefined;
const cache = new CacheImagens(path.join(app.getPath('userData'), 'cache-imagens-v1'));
const geracoes = new Map<string, number>();

function interromper(): void {
  geracaoAuxiliar += 1;
  const processo = auxiliar;
  auxiliar = undefined;
  const atual = aguardando;
  aguardando = undefined;
  atual?.rejeitar(new Error('O processador de imagens foi interrompido. Tente novamente.'));
  processo?.kill();
}

function transformarBmp(entrada: TransformacaoImagem): ImagemTransformada {
  const original = Buffer.from(entrada.bytes);
  const bmp = lerBitmapBmp(original);
  const imagem = nativeImage.createFromBitmap(bmp.bitmap, { width: bmp.width, height: bmp.height });
  if (imagem.isEmpty()) throw new Error('Figura BMP inválida.');
  const { width, height } = imagem.getSize();
  if (!width || !height || width * height > 100_000_000) throw new Error('Dimensões da figura inválidas.');
  const escala = Math.min(1, entrada.largura ? entrada.largura / width : 1, entrada.maiorLado ? entrada.maiorLado / Math.max(width, height) : 1);
  if (entrada.preservarSeCouber && escala === 1) return { bytes: entrada.bytes, mimeType: entrada.mimeOriginal };
  const ajustada = escala < 1 ? imagem.resize({ width: Math.max(1, Math.round(width * escala)), height: Math.max(1, Math.round(height * escala)), quality: 'best' }) : imagem;
  const bytes = entrada.formato === 'png' ? ajustada.toPNG() : ajustada.toJPEG(entrada.qualidade);
  if (!bytes.length) throw new Error('Não foi possível preparar a figura BMP.');
  return entrada.conservarSeMaior && bytes.length >= entrada.bytes.byteLength
    ? { bytes: entrada.bytes, mimeType: entrada.mimeOriginal } : { bytes, mimeType: entrada.formato === 'png' ? 'image/png' : 'image/jpeg' };
}

async function executar(entrada: TransformacaoImagem): Promise<ImagemTransformada> {
  if (entrada.mimeOriginal === 'image/bmp') return transformarBmp(entrada);
  const geracao = geracaoAuxiliar;
  await app.whenReady();
  if (geracao !== geracaoAuxiliar) throw new Error('Processamento de imagem cancelado.');
  if (!auxiliar) {
    const processo = utilityProcess.fork(path.join(path.dirname(fileURLToPath(import.meta.url)), 'imagens', 'auxiliar.js'), [], {
      serviceName: 'Processador de imagens laWdo', stdio: 'pipe', execArgv: [],
    });
    auxiliar = processo;
    processo.on('message', (mensagem: unknown) => {
      if (auxiliar !== processo || !aguardando) return;
      const atual = aguardando;
      aguardando = undefined;
      if (mensagem && typeof mensagem === 'object' && 'id' in mensagem && mensagem.id === atual.id) {
        if ('resultado' in mensagem && resultadoImagemValido(mensagem.resultado)) { atual.resolver(mensagem.resultado); return; }
        if ('erro' in mensagem && typeof mensagem.erro === 'string') { atual.rejeitar(new Error(mensagem.erro)); return; }
      }
      atual.rejeitar(new Error('Resposta inválida do processador de imagens.'));
      interromper();
    });
    processo.once('exit', () => { if (auxiliar === processo) interromper(); });
    // Drenar os pipes evita bloquear o auxiliar por saída diagnóstica acumulada.
    processo.stdout?.on('data', () => undefined);
    processo.stderr?.on('data', () => undefined);
  }
  const processo = auxiliar;
  return new Promise((resolver, rejeitar) => {
    const id = ++sequencia;
    aguardando = { id, resolver, rejeitar };
    try { processo.postMessage({ id, entrada }); }
    catch (erro) { interromper(); rejeitar(erro instanceof Error ? erro : new Error('Falha ao enviar imagem.')); }
  });
}

const fila = new FilaImagens(executar, interromper);

export function comContextoImagens<T>(identificador: string, operacao: () => T): T {
  return contexto.run({ identificador, geracao: geracoes.get(identificador) ?? 0 }, operacao);
}

export function cancelarProcessamentoImagens(identificador: string): void {
  geracoes.set(identificador, (geracoes.get(identificador) ?? 0) + 1);
  fila.cancelar(identificador);
}

export function encerrarProcessadorImagens(): void { fila.encerrar(); }

export async function processarImagem(entrada: TransformacaoImagem): Promise<ImagemTransformada> {
  if (!transformacaoImagemValida(entrada)) throw new Error('Transformação de imagem inválida.');
  const atual = contexto.getStore();
  const identificador = atual?.identificador ?? 'interno';
  const geracao = atual?.geracao ?? (geracoes.get(identificador) ?? 0);
  const { bytes, ...opcoes } = entrada;
  const chave = createHash('sha256').update(JSON.stringify(['sharp-v1', createHash('sha256').update(bytes).digest('hex'), opcoes])).digest('hex');
  const validarContexto = () => {
    if ((geracoes.get(identificador) ?? 0) !== geracao) throw new Error('Processamento de imagem cancelado.');
  };
  validarContexto();
  const lembrada = await cache.obter(chave);
  validarContexto();
  if (lembrada) return lembrada;
  const resultado = await fila.solicitar(chave, entrada, identificador, entrada.finalidade === 'miniatura' ? 1 : 0);
  validarContexto();
  await cache.salvar(chave, resultado);
  validarContexto();
  return { ...resultado, bytes: Buffer.from(resultado.bytes) };
}
