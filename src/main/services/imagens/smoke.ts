import { app, BrowserWindow } from 'electron';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { processarImagem, comContextoImagens, cancelarProcessamentoImagens, encerrarProcessadorImagens } from '../processador-imagens.service.js';

sharp.concurrency(1);
sharp.cache(false);

export async function executarSmokeImagens(): Promise<void> {
  const diretorio = app.getPath('userData');
  const saida = process.env.LAWDO_SMOKE_SAIDA;
  if (!saida) throw new Error('Destino do smoke de imagens ausente.');
  await app.whenReady();
  let janela: BrowserWindow | undefined;
  let codigoSaida = 0;
  let etapa = 'gerar massa';
  const prazo = setTimeout(() => app.exit(2), 180_000);
  try {
    const fotografias: Buffer[] = [];
    for (let indice = 0; indice < 100; indice++) fotografias.push(await sharp({ create: {
      width: 4000, height: 3000, channels: 3, background: { r: indice * 2, g: 80, b: 200 - indice },
    } }).jpeg({ quality: 90 }).toBuffer());
    const amostras: Array<{ cache: string; duracaoMs: number; rssBytes: number; processos: unknown }> = [];
    let previa: Uint8Array | undefined;
    for (let repeticao = 0; repeticao < 3; repeticao++) {
      // A versão da qualidade separa chaves frias; o segundo passe reutiliza as mesmas entradas.
      for (const estado of ['frio', 'quente']) {
        etapa = `processar ${estado} ${repeticao + 1}`;
        const inicio = performance.now();
        for (const bytes of fotografias) {
          const resultado = await processarImagem({ bytes, finalidade: 'previa', maiorLado: 640,
            qualidade: 80 + repeticao, formato: 'jpeg', mimeOriginal: 'image/jpeg' });
          previa = resultado.bytes;
        }
        amostras.push({ cache: estado, duracaoMs: performance.now() - inicio, rssBytes: process.memoryUsage().rss,
          processos: app.getAppMetrics().map(item => ({ tipo: item.type, nome: item.name, memoria: item.memory })) });
      }
    }
    const transparente = await sharp({ create: { width: 80, height: 40, channels: 4, background: { r: 200, g: 0, b: 50, alpha: 0.5 } } }).png().toBuffer();
    etapa = 'validar PNG e BMP';
    const png = await processarImagem({ bytes: transparente, finalidade: 'previa', maiorLado: 40, qualidade: 80, formato: 'png', mimeOriginal: 'image/png' });
    if ((await sharp(png.bytes).stats()).isOpaque) throw new Error('A transparência não foi preservada.');
    // BMP mínimo de 2x2 pixels, sem dependência de um codec de teste adicional.
    const bmp = Buffer.alloc(70); bmp.write('BM'); bmp.writeUInt32LE(70, 2); bmp.writeUInt32LE(54, 10);
    bmp.writeUInt32LE(40, 14); bmp.writeInt32LE(2, 18); bmp.writeInt32LE(2, 22); bmp.writeUInt16LE(1, 26); bmp.writeUInt16LE(24, 28);
    await processarImagem({ bytes: bmp, finalidade: 'miniatura', maiorLado: 40, qualidade: 75, formato: 'jpeg', mimeOriginal: 'image/bmp' });
    const pendente = comContextoImagens('smoke-cancelar', () => processarImagem({ bytes: fotografias[0], finalidade: 'figura', maiorLado: 3000, qualidade: 99, formato: 'jpeg', mimeOriginal: 'image/jpeg' }));
    etapa = 'validar cancelamento';
    cancelarProcessamentoImagens('smoke-cancelar');
    await pendente.then(() => { throw new Error('Cancelamento não foi observado.'); }, () => undefined);
    await processarImagem({ bytes: fotografias[0], finalidade: 'figura', maiorLado: 3000, qualidade: 98, formato: 'jpeg', mimeOriginal: 'image/jpeg' });
    const auxiliar = app.getAppMetrics().find(item => item.name === 'Processador de imagens laWdo');
    etapa = 'validar encerramento e recuperação';
    if (!auxiliar) throw new Error('O auxiliar não apareceu nas métricas do Electron.');
    const encerrou = new Promise<void>(resolve => app.once('child-process-gone', () => resolve()));
    process.kill(auxiliar.pid);
    await encerrou;
    await processarImagem({ bytes: fotografias[0], finalidade: 'previa', maiorLado: 639, qualidade: 79, formato: 'jpeg', mimeOriginal: 'image/jpeg' });
    await mkdir(path.dirname(saida), { recursive: true });
    etapa = 'conferência visual';
    const html = path.join(diretorio, 'conferencia.html');
    await writeFile(html, `<html><body style="font-family:Arial;padding:32px"><h1>Conferência de imagens</h1><p>JPEG 12 MP → prévia de 640 px</p><img src="data:image/jpeg;base64,${Buffer.from(previa ?? []).toString('base64')}"><p>PNG com transparência</p><div style="background:#ccc"><img src="data:image/png;base64,${Buffer.from(png.bytes).toString('base64')}"></div></body></html>`);
    janela = new BrowserWindow({ show: false, width: 900, height: 900, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    await janela.loadFile(html);
    await writeFile(path.join(path.dirname(saida), 'conferencia.png'), (await janela.webContents.capturePage()).toPNG());
    await writeFile(path.join(path.dirname(saida), 'conferencia.pdf'), await janela.webContents.printToPDF({ printBackground: true }));
    await writeFile(saida, JSON.stringify({ sucesso: true, protocolo: 'processador-isolado-100-jpeg-12mp-v1',
      limitacao: 'Mede o processador; não substitui captura ponta a ponta de edição, GDL ou exportação de laudo.', amostras }, null, 2));
  } catch (erro) {
    await writeFile(saida, JSON.stringify({ sucesso: false, etapa, erro: erro instanceof Error ? erro.message : String(erro) }));
    codigoSaida = 1;
  } finally {
    janela?.destroy(); encerrarProcessadorImagens(); clearTimeout(prazo);
    await rm(path.join(diretorio, 'conferencia.html'), { force: true });
    app.exit(codigoSaida);
  }
}
