import { Buffer } from 'node:buffer';

export interface TransformacaoImagem {
  bytes: Uint8Array;
  finalidade: 'miniatura' | 'previa' | 'figura';
  largura?: number;
  maiorLado?: number;
  qualidade: number;
  formato: 'jpeg' | 'png' | 'automatico';
  conservarSeMaior?: boolean;
  preservarSeCouber?: boolean;
  mimeOriginal: string;
}

export interface ImagemTransformada {
  bytes: Uint8Array;
  mimeType: string;
}

export function resultadoImagemValido(valor: unknown): valor is ImagemTransformada {
  return !!valor && typeof valor === 'object' && 'bytes' in valor && (valor.bytes instanceof Uint8Array || Buffer.isBuffer(valor.bytes))
    && valor.bytes.byteLength > 0 && 'mimeType' in valor && typeof valor.mimeType === 'string'
    && /^image\/(jpeg|png|gif|bmp|webp)$/.test(valor.mimeType);
}

export function transformacaoImagemValida(valor: unknown): valor is TransformacaoImagem {
  if (!valor || typeof valor !== 'object') return false;
  const dados = valor as Partial<TransformacaoImagem>;
  return (dados.bytes instanceof Uint8Array || Buffer.isBuffer(dados.bytes)) && dados.bytes.byteLength > 0 && dados.bytes.byteLength <= 50 * 1024 * 1024
    && ['miniatura', 'previa', 'figura'].includes(dados.finalidade ?? '')
    && ['jpeg', 'png', 'automatico'].includes(dados.formato ?? '')
    && typeof dados.mimeOriginal === 'string' && /^image\/(jpeg|png|gif|bmp|webp)$/.test(dados.mimeOriginal)
    && typeof dados.qualidade === 'number' && Number.isInteger(dados.qualidade) && dados.qualidade >= 1 && dados.qualidade <= 100
    && (dados.largura === undefined || Number.isInteger(dados.largura) && dados.largura >= 1 && dados.largura <= 3000)
    && (dados.maiorLado === undefined || Number.isInteger(dados.maiorLado) && dados.maiorLado >= 1 && dados.maiorLado <= 3000)
    && (dados.conservarSeMaior === undefined || typeof dados.conservarSeMaior === 'boolean')
    && (dados.preservarSeCouber === undefined || typeof dados.preservarSeCouber === 'boolean');
}
