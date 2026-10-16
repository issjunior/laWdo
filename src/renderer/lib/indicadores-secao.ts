interface SituacaoSecao {
  ocultarTitulo?: boolean;
  contarNaNumeracao?: boolean;
}

export function obterIndicadoresSecao({ ocultarTitulo, contarNaNumeracao }: SituacaoSecao) {
  if (!ocultarTitulo) return [];
  const indicadores = [{
    rotulo: 'Título oculto',
    explicacao: 'O nome, o número e a linha desta seção não aparecem na visualização nem na exportação.',
  }];
  if (contarNaNumeracao === false) indicadores.push({
    rotulo: 'Fora da numeração',
    explicacao: 'Esta seção não consome um número. A numeração continua sem contar esta seção.',
  });
  return indicadores;
}

export function criarIndicadoresSecaoHtml(situacao: SituacaoSecao): string {
  const indicadores = obterIndicadoresSecao(situacao);
  if (indicadores.length === 0) return '';
  return `<span data-indicador-titulo-oculto="true">${indicadores.map(indicador =>
    `<span class="indicador-secao" title="${indicador.explicacao}" aria-label="${indicador.rotulo}: ${indicador.explicacao}" tabindex="0">${indicador.rotulo}</span>`
  ).join('')}</span>`;
}
