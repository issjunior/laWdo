import { nativeImage } from 'electron';
import type { TransformacaoImagem } from '../../main/services/imagens/contratos';

// Adaptador dos doubles de imagem já usados pelas integrações de persistência.
export async function processarImagem(entrada: TransformacaoImagem) {
  const original = Buffer.from(entrada.bytes);
  const imagem = nativeImage.createFromBuffer(original);
  if (imagem.isEmpty()) throw new Error('Figura inválida para compactação.');
  const { width, height } = imagem.getSize();
  if (!width || !height) throw new Error('Dimensões da figura inválidas.');
  const escala = Math.min(1, entrada.largura ? entrada.largura / width : 1, entrada.maiorLado ? entrada.maiorLado / Math.max(width, height) : 1);
  if (entrada.preservarSeCouber && escala === 1) return { bytes: original, mimeType: entrada.mimeOriginal };
  const ajustada = escala < 1 ? imagem.resize({ width: Math.max(1, Math.round(width * escala)), height: Math.max(1, Math.round(height * escala)), quality: 'best' }) : imagem;
  let png = entrada.formato === 'png';
  if (entrada.formato === 'automatico' && !['image/jpeg', 'image/bmp'].includes(entrada.mimeOriginal)) {
    const bitmap = ajustada.toBitmap();
    for (let indice = 3; indice < bitmap.length; indice += 4) if (bitmap[indice] < 255) png = true;
  }
  const bytes = png ? ajustada.toPNG() : ajustada.toJPEG(entrada.qualidade);
  if (!bytes.length) throw new Error('Não foi possível compactar a figura.');
  return entrada.conservarSeMaior && bytes.length >= original.length ? { bytes: original, mimeType: entrada.mimeOriginal }
    : { bytes, mimeType: png ? 'image/png' : 'image/jpeg' };
}

export function comContextoImagens<T>(_contexto: string, acao: () => T): T { return acao(); }
export function cancelarProcessamentoImagens(): void {}
export function encerrarProcessadorImagens(): void {}
