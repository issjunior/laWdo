import sharp from 'sharp';
import { transformacaoImagemValida, type ImagemTransformada, type TransformacaoImagem } from './contratos.js';

sharp.concurrency(1);
sharp.cache({ memory: 32, files: 0, items: 20 });

export async function transformarImagem(entrada: TransformacaoImagem): Promise<ImagemTransformada> {
  if (!transformacaoImagemValida(entrada)) throw new Error('Transformação de imagem inválida.');
  const original = Buffer.from(entrada.bytes);
  const imagem = sharp(original, { limitInputPixels: 100_000_000, animated: false, failOn: 'warning' }).autoOrient();
  const metadados = await imagem.metadata();
  if (!metadados.width || !metadados.height) throw new Error('Dimensões da figura inválidas.');
  const orientacaoTrocaEixos = (metadados.orientation ?? 1) >= 5;
  const largura = orientacaoTrocaEixos ? metadados.height : metadados.width;
  const altura = orientacaoTrocaEixos ? metadados.width : metadados.height;
  const escala = Math.min(1, entrada.largura ? entrada.largura / largura : 1,
    entrada.maiorLado ? entrada.maiorLado / Math.max(largura, altura) : 1);
  if (entrada.preservarSeCouber && escala === 1) return { bytes: original, mimeType: entrada.mimeOriginal };
  imagem.resize({ width: Math.max(1, Math.round(largura * escala)), height: Math.max(1, Math.round(altura * escala)),
    fit: 'fill', withoutEnlargement: true });
  const transparente = entrada.formato === 'automatico' && metadados.hasAlpha && !(await imagem.clone().stats()).isOpaque;
  const png = entrada.formato === 'png' || transparente;
  const bytes = await (png ? imagem.png() : imagem.flatten({ background: '#ffffff' }).jpeg({ quality: entrada.qualidade })).toBuffer();
  if (entrada.conservarSeMaior && bytes.length >= original.length) return { bytes: original, mimeType: entrada.mimeOriginal };
  return { bytes, mimeType: png ? 'image/png' : 'image/jpeg' };
}
