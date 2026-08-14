import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

interface SourceMapV3 {
  version: number;
  sourceRoot?: string;
  sources: string[];
  mappings: string;
}

export interface LocalizacaoOriginalDiagnostico {
  disponivel: boolean;
  arquivo?: string;
  linha?: number;
  coluna?: number;
  motivo?: 'MAPA_AUSENTE' | 'MAPEAMENTO_AUSENTE' | 'ORIGEM_FORA_DO_BUILD' | 'MAPA_INVALIDO';
}

const base64Vlq = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodificarVlq(segmento: string): number[] | null {
  const valores: number[] = [];
  let valor = 0;
  let deslocamento = 0;
  for (const caractere of segmento) {
    const digito = base64Vlq.indexOf(caractere);
    if (digito < 0) return null;
    valor += (digito & 31) << deslocamento;
    if (digito & 32) { deslocamento += 5; continue; }
    valores.push((valor & 1) === 1 ? -(valor >> 1) : valor >> 1);
    valor = 0;
    deslocamento = 0;
  }
  return deslocamento === 0 ? valores : null;
}

function resolverCaminhoGerado(sourceId: string): string | null {
  try { return sourceId.startsWith('file:') ? fileURLToPath(sourceId) : sourceId; } catch { return null; }
}

export class DiagnosticoSourceMapService {
  constructor(private readonly diretorioBuild: string) {}

  async resolver(sourceId: string | null, linha: number | null, coluna: number | null): Promise<LocalizacaoOriginalDiagnostico> {
    if (!sourceId || linha === null || coluna === null) return { disponivel: false, motivo: 'MAPA_AUSENTE' };
    const arquivoGerado = resolverCaminhoGerado(sourceId);
    if (!arquivoGerado || !path.resolve(arquivoGerado).startsWith(`${path.resolve(this.diretorioBuild)}${path.sep}`)) return { disponivel: false, motivo: 'ORIGEM_FORA_DO_BUILD' };
    let mapa: SourceMapV3;
    try {
      mapa = JSON.parse(await readFile(`${arquivoGerado}.map`, 'utf8')) as SourceMapV3;
      if (mapa.version !== 3 || !Array.isArray(mapa.sources) || typeof mapa.mappings !== 'string') return { disponivel: false, motivo: 'MAPA_INVALIDO' };
    } catch { return { disponivel: false, motivo: 'MAPA_AUSENTE' }; }
    const mapeamento = this.encontrarMapeamento(mapa, linha - 1, coluna - 1);
    if (!mapeamento) return { disponivel: false, motivo: 'MAPEAMENTO_AUSENTE' };
    const origem = mapa.sources[mapeamento.indiceOrigem];
    if (!origem) return { disponivel: false, motivo: 'MAPEAMENTO_AUSENTE' };
    return { disponivel: true, arquivo: path.normalize(path.resolve(path.dirname(arquivoGerado), mapa.sourceRoot ?? '', origem)), linha: mapeamento.linha + 1, coluna: mapeamento.coluna + 1 };
  }

  private encontrarMapeamento(mapa: SourceMapV3, linhaAlvo: number, colunaAlvo: number): { indiceOrigem: number; linha: number; coluna: number } | null {
    const linhas = mapa.mappings.split(';');
    let indiceOrigem = 0;
    let linhaOrigem = 0;
    let colunaOrigem = 0;
    for (let linhaGerada = 0; linhaGerada <= linhaAlvo; linhaGerada += 1) {
      let colunaGerada = 0;
      let melhor: { indiceOrigem: number; linha: number; coluna: number } | null = null;
      for (const segmento of (linhas[linhaGerada] ?? '').split(',').filter(Boolean)) {
        const valores = decodificarVlq(segmento);
        if (!valores || valores.length < 4) continue;
        colunaGerada += valores[0]!;
        indiceOrigem += valores[1]!;
        linhaOrigem += valores[2]!;
        colunaOrigem += valores[3]!;
        if (linhaGerada === linhaAlvo && colunaGerada <= colunaAlvo) melhor = { indiceOrigem, linha: linhaOrigem, coluna: colunaOrigem };
      }
      if (linhaGerada === linhaAlvo) return melhor;
    }
    return null;
  }
}
