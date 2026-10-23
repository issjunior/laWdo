export const ESTILOS_TABELAS_BALISTICA = `
  table[data-tabela-laudo="balistica"] {
    table-layout: auto; width: 100% !important; max-width: 100% !important;
    border-collapse: collapse;
  }
  table[data-tabela-laudo="balistica"] th, table[data-tabela-laudo="balistica"] td {
    padding: 4px 3px !important;
    white-space: normal !important; word-break: normal !important;
    overflow-wrap: normal !important; hyphens: none !important;
  }
  table[data-tabela-laudo="balistica"] th *, table[data-tabela-laudo="balistica"] td * {
    white-space: normal !important; word-break: normal !important;
    overflow-wrap: normal !important; hyphens: none !important;
  }
`;

export function planejarGruposColunas(minimos: readonly number[], largura: number): number[][] {
  if (!minimos.length || !Number.isFinite(largura) || largura <= 0) return [];
  if (minimos.reduce((soma, valor) => soma + valor, 0) <= largura) return [minimos.map((_, indice) => indice)];
  const grupos: number[][] = [];
  let grupo = [0];
  let ocupado = minimos[0];
  for (let indice = 1; indice < minimos.length; indice += 1) {
    if (grupo.length > 1 && ocupado + minimos[indice] > largura) {
      grupos.push(grupo);
      grupo = [0];
      ocupado = minimos[0];
    }
    grupo.push(indice);
    ocupado += minimos[indice];
  }
  if (grupo.length > 1) grupos.push(grupo);
  return grupos;
}

export function distribuirLargurasColunas(minimos: readonly number[], pesos: readonly number[], largura: number): number[] {
  const soma = minimos.reduce((total, valor) => total + valor, 0);
  const sobra = Math.max(0, largura - soma);
  const totalPesos = pesos.reduce((total, valor) => total + valor, 0) || minimos.length;
  return minimos.map((minimo, indice) => (minimo + sobra * ((pesos[indice] || 1) / totalPesos)) / Math.max(largura, soma) * 100);
}

export function pesoColunaTabela(titulo: string): number {
  if (/^(item|id|qtd|quantidade)$/i.test(titulo.trim())) return 0.3;
  return /origem|procedência|observa|descri|ofício|característica/i.test(titulo) ? 2 : 1;
}
