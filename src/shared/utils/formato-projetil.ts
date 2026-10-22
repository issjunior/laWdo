import { siglasProjeteis } from '../catalogos/siglas-projeteis.js';

export function normalizarFormatoProjetil(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ');
}

export function criarOpcoesFormatoProjetil(siglas: readonly string[], personalizados: readonly string[], valor = '') {
  const opcoesPorNome = new Map<string, { valor: string; rotulo: string; descricao: string }>();
  for (const sigla of siglas) {
    const descricao = siglasProjeteis[sigla] ?? 'Nome não documentado';
    opcoesPorNome.set(normalizarFormatoProjetil(sigla), { valor: sigla, rotulo: `${sigla} — ${descricao}`, descricao });
  }
  for (const tipo of [...personalizados, valor]) {
    const nome = tipo.trim();
    if (nome && !opcoesPorNome.has(normalizarFormatoProjetil(nome))) {
      opcoesPorNome.set(normalizarFormatoProjetil(nome), { valor: nome, rotulo: nome, descricao: nome });
    }
  }
  return [...opcoesPorNome.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
}
