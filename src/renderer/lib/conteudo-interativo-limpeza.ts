export function limparConteudoInterativo(raiz: ParentNode): void {
  raiz.querySelectorAll('[data-controles-conteudo]').forEach(no => no.remove());
  raiz.querySelectorAll<HTMLElement>('.conteudo-laudo, .cond-bloco[data-cond-bloco], [data-placeholder-tabela-personalizada], [data-b601-grupo]').forEach(no => {
    no.classList.remove('conteudo-laudo', 'conteudo-laudo-rep', 'conteudo-laudo-condicional', 'conteudo-laudo-editando');
    no.removeAttribute('contenteditable');
    no.querySelectorAll('[contenteditable]').forEach(filho => filho.removeAttribute('contenteditable'));
  });
}
