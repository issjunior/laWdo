export const SELETOR_BLOCO_PROTEGIDO = '.cond-bloco[data-cond-bloco], [data-placeholder-preview-tabela="true"], [data-placeholder-tabela-personalizada="true"], [data-b601-grupo]';

export function permiteEdicaoCampo(campo: Element, somenteLeitura: boolean, pontual = false): boolean {
  if (somenteLeitura || campo.closest('th, [data-placeholder-celula-fixa="true"], [data-mce-bogus="all"], [data-placeholder-tabela-personalizada-id][data-placeholder]')) return false;
  const bloco = campo.closest(SELETOR_BLOCO_PROTEGIDO);
  const protegido = campo.closest('[data-placeholder-preview="true"]') !== null;
  const preenchimento = campo.matches('[data-reservado="true"], [data-placeholder-personalizado-html], [data-placeholder-personalizado-livre="true"]');
  if (pontual || preenchimento) return true;
  if (!bloco) return !protegido;
  for (let atual: Element | null = bloco; atual; atual = atual.parentElement?.closest(SELETOR_BLOCO_PROTEGIDO) ?? null) {
    if (!atual.classList.contains('conteudo-laudo-editando')) return false;
  }
  return true;
}
