import type { FragmentoIa } from './types/ia.types.js';

export const LIMITE_CARACTERES_LOTE_IA = 48_000;

export interface LoteExecucaoIa {
  indice: number;
  fragmentos: FragmentoIa[];
  caracteresEstimados: number;
}

export interface PlanoExecucaoIa {
  lotes: LoteExecucaoIa[];
  totalLotes: number;
  chamadasBase: number;
  limiteMaximoChamadas: number;
}

function estimarCaracteresFragmento(fragmento: FragmentoIa): number {
  return fragmento.id.length + fragmento.texto.length + 32;
}

function dividirTextoEmPartes(texto: string, limite: number): string[] {
  if (texto.length <= limite) return [texto];
  const partes: string[] = [];
  let restante = texto;
  while (restante.length > limite) {
    const janela = restante.slice(0, limite + 1);
    const ponto = Math.max(
      janela.lastIndexOf('. '),
      janela.lastIndexOf('; '),
      janela.lastIndexOf(': '),
      janela.lastIndexOf(', '),
      janela.lastIndexOf(' '),
    );
    const corte = ponto > Math.floor(limite * 0.5) ? ponto + 1 : limite;
    partes.push(restante.slice(0, corte));
    restante = restante.slice(corte);
  }
  if (restante) partes.push(restante);
  return partes;
}

export function fragmentarParaOrcamentoIa(
  fragmentos: FragmentoIa[],
  limiteCaracteres: number,
): FragmentoIa[] {
  const limiteTexto = Math.max(1, limiteCaracteres - 160);
  return fragmentos.flatMap(fragmento => {
    const partes = dividirTextoEmPartes(fragmento.texto, limiteTexto);
    if (partes.length === 1) return [fragmento];
    return partes.map((texto, indice) => ({
      id: `${fragmento.id}::parte:${indice + 1}/${partes.length}`,
      texto,
    }));
  });
}

export function recomporFragmentosPlanejadosIa(
  fragmentosOriginais: FragmentoIa[],
  fragmentosProcessados: FragmentoIa[],
): FragmentoIa[] | null {
  const porId = new Map(fragmentosProcessados.map(fragmento => [fragmento.id, fragmento.texto]));
  const resposta: FragmentoIa[] = [];
  for (const original of fragmentosOriginais) {
    const prefixo = `${original.id}::parte:`;
    const partes = [...porId.entries()]
      .filter(([id]) => id.startsWith(prefixo))
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }));
    if (partes.length > 0) {
      resposta.push({ id: original.id, texto: partes.map(([, texto]) => texto).join('') });
      continue;
    }
    const texto = porId.get(original.id);
    if (texto === undefined) return null;
    resposta.push({ id: original.id, texto });
  }
  return resposta;
}

export function planejarExecucaoIa(
  fragmentos: FragmentoIa[],
  limiteCaracteres = LIMITE_CARACTERES_LOTE_IA,
): PlanoExecucaoIa {
  if (!Number.isFinite(limiteCaracteres) || limiteCaracteres <= 0 || fragmentos.length === 0) {
    throw new Error('ENTRADA_INVALIDA');
  }

  const fragmentosPlanejados = limiteCaracteres >= 512
    ? fragmentarParaOrcamentoIa(fragmentos, limiteCaracteres)
    : fragmentos;
  const lotes: LoteExecucaoIa[] = [];
  let fragmentosAtuais: FragmentoIa[] = [];
  let caracteresAtuais = 0;

  const concluirLote = () => {
    if (!fragmentosAtuais.length) return;
    lotes.push({
      indice: lotes.length + 1,
      fragmentos: fragmentosAtuais,
      caracteresEstimados: caracteresAtuais,
    });
    fragmentosAtuais = [];
    caracteresAtuais = 0;
  };

  for (const fragmento of fragmentosPlanejados) {
    const caracteres = estimarCaracteresFragmento(fragmento);
    if (caracteres > limiteCaracteres) throw new Error('LIMITE_EXCEDIDO');
    if (fragmentosAtuais.length && caracteresAtuais + caracteres > limiteCaracteres) concluirLote();
    fragmentosAtuais.push(fragmento);
    caracteresAtuais += caracteres;
  }
  concluirLote();

  return {
    lotes,
    totalLotes: lotes.length,
    chamadasBase: lotes.length,
    limiteMaximoChamadas: lotes.length * 8,
  };
}
