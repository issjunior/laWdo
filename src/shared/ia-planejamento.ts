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

export function planejarExecucaoIa(
  fragmentos: FragmentoIa[],
  limiteCaracteres = LIMITE_CARACTERES_LOTE_IA,
): PlanoExecucaoIa {
  if (!Number.isFinite(limiteCaracteres) || limiteCaracteres <= 0 || fragmentos.length === 0) {
    throw new Error('ENTRADA_INVALIDA');
  }

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

  for (const fragmento of fragmentos) {
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
