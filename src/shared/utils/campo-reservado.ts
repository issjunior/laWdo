export function criarHtmlCampoReservado(aviso: string, chaveRep?: string): string {
  const escapar = (texto: string) => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const descricao = escapar(aviso)
  const campoRep = chaveRep ? ` data-campo-rep-pendente="${escapar(chaveRep)}"` : ''
  return `<span class="campo-reservado" data-reservado="true"${campoRep} data-aviso-reservado="${descricao}" data-tooltip-xxx="true" data-origem-xxx="${chaveRep ? 'rep' : 'template'}" title="${descricao}" aria-label="${descricao}">XXX</span>`
}
