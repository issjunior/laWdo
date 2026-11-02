export function lerBitmapBmp(bytes: Buffer): { bitmap: Buffer; width: number; height: number } {
  if (bytes.length < 54 || bytes.toString('ascii', 0, 2) !== 'BM' || bytes.readUInt32LE(14) < 40) throw new Error('Cabeçalho BMP inválido.');
  const width = bytes.readInt32LE(18);
  const altura = bytes.readInt32LE(22);
  const height = Math.abs(altura);
  const profundidade = bytes.readUInt16LE(28);
  const deslocamento = bytes.readUInt32LE(10);
  if (width <= 0 || !height || width * height > 100_000_000 || bytes.readUInt16LE(26) !== 1
    || ![24, 32].includes(profundidade) || bytes.readUInt32LE(30) !== 0) throw new Error('BMP incompatível. Use BMP de 24/32 bits sem compressão ou converta para PNG.');
  const passo = Math.ceil(width * profundidade / 32) * 4;
  if (deslocamento < 14 + bytes.readUInt32LE(14) || deslocamento > bytes.length - passo * height) throw new Error('BMP incompleto.');
  const bitmap = Buffer.allocUnsafe(width * height * 4);
  for (let y = 0; y < height; y++) {
    const linha = deslocamento + (altura > 0 ? height - 1 - y : y) * passo;
    for (let x = 0; x < width; x++) {
      const origem = linha + x * profundidade / 8;
      const destino = (y * width + x) * 4;
      bitmap[destino] = bytes[origem]; bitmap[destino + 1] = bytes[origem + 1];
      bitmap[destino + 2] = bytes[origem + 2]; bitmap[destino + 3] = 255;
    }
  }
  return { bitmap, width, height };
}
