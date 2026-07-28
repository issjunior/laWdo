import { CAMPOS_ESPECIFICOS_PLACEHOLDERS } from '@/components/rep/exam-fields/placeholders';

interface PlaceholderPersonalizado {
  chave: string;
  descricao?: string | null;
}

interface ValorResolvido {
  valor?: string;
}

function escaparRegex(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function encontrarCampoEspecifico(chave: string) {
  return CAMPOS_ESPECIFICOS_PLACEHOLDERS.find(campo => {
    if (campo.chave === chave) return true;
    if (!campo.chave.includes('_N_')) return false;
    const regex = new RegExp(`^${escaparRegex(campo.chave).replace('_N_', '_(\\d+)_')}$`);
    return regex.test(chave);
  });
}

function obterLetraArma(indice: number, valores: Record<string, ValorResolvido>): string {
  const letra = valores[`b602_arma_${indice}_letra`]?.valor?.trim();
  return letra || String.fromCharCode(65 + indice - 1);
}

export function descreverPlaceholderPendente(
  chave: string,
  placeholdersPersonalizados: PlaceholderPersonalizado[],
  valores: Record<string, ValorResolvido>,
): string {
  const campoEspecifico = encontrarCampoEspecifico(chave);
  const personalizado = placeholdersPersonalizados.find(placeholder => placeholder.chave === chave);
  const rotulo = campoEspecifico?.label || personalizado?.descricao || chave;
  const rotuloSemSufixoExame = rotulo.replace(/\s*\([A-Z]-?\d+\)$/u, '');
  const arma = chave.match(/^b602_arma_(\d+)_/);
  const contexto = arma ? ` — Arma ${obterLetraArma(Number(arma[1]), valores)}` : '';

  return `Campo pendente na REP: ${rotuloSemSufixoExame}${contexto}`;
}
