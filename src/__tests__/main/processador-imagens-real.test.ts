import sharp from 'sharp';
import { expect, it } from 'vitest';
import { transformarImagem } from '../../main/services/imagens/transformar';

it('gera prévia sem ampliar a imagem e preserva os bytes de origem', async () => {
  const bytes = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#a04020' } }).jpeg().toBuffer();
  const original = Buffer.from(bytes);
  const resultado = await transformarImagem({ bytes, finalidade: 'previa', maiorLado: 160, qualidade: 80, formato: 'jpeg', mimeOriginal: 'image/jpeg' });
  expect(await sharp(resultado.bytes).metadata()).toMatchObject({ width: 160, height: 120, format: 'jpeg' });
  expect(bytes).toEqual(original);
  const impressao = await transformarImagem({ bytes, finalidade: 'figura', largura: 3000, qualidade: 62, formato: 'jpeg',
    mimeOriginal: 'image/jpeg', preservarSeCouber: true });
  expect(impressao.bytes).toEqual(original);
  const pequena = await transformarImagem({ bytes, finalidade: 'previa', maiorLado: 960, qualidade: 80, formato: 'jpeg', mimeOriginal: 'image/jpeg' });
  expect(await sharp(pequena.bytes).metadata()).toMatchObject({ width: 640, height: 480 });
});

it('mantém transparência e aplica a orientação EXIF na prévia', async () => {
  const png = await sharp({ create: { width: 80, height: 40, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.4 } } }).png().toBuffer();
  const transparente = await transformarImagem({ bytes: png, finalidade: 'figura', maiorLado: 40, qualidade: 80, formato: 'automatico', mimeOriginal: 'image/png' });
  expect(transparente.mimeType).toBe('image/png');
  expect((await sharp(transparente.bytes).stats()).isOpaque).toBe(false);
  const jpeg = await sharp({ create: { width: 80, height: 40, channels: 3, background: '#205030' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const orientada = await transformarImagem({ bytes: jpeg, finalidade: 'previa', maiorLado: 80, qualidade: 80, formato: 'jpeg', mimeOriginal: 'image/jpeg' });
  expect(await sharp(orientada.bytes).metadata()).toMatchObject({ width: 40, height: 80 });
});

it('recusa conteúdo corrompido e conserva original quando a codificação aumenta o arquivo', async () => {
  await expect(transformarImagem({ bytes: Buffer.from('corrompida'), finalidade: 'previa', qualidade: 80, formato: 'jpeg', mimeOriginal: 'image/jpeg' })).rejects.toThrow();
  const bytes = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000000' } }).png().toBuffer();
  const resultado = await transformarImagem({ bytes, finalidade: 'figura', qualidade: 100, formato: 'jpeg', mimeOriginal: 'image/png', conservarSeMaior: true });
  expect(resultado).toEqual({ bytes, mimeType: 'image/png' });
});
