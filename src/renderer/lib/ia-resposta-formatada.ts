export interface TabelaMarkdownIa {
  cabecalho: string[];
  linhas: string[][];
}

function escaparHtml(valor: string): string {
  return valor.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function celulas(linha: string): string[] {
  return linha.trim().replace(/^\||\|$/g, '').split('|').map(celula => celula.trim())
}

function separadorTabela(linha: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(linha)
}

export function extrairTabelaMarkdownIa(texto: string): TabelaMarkdownIa | null {
  const linhas = texto.trim().split(/\r?\n/)
  const indiceSeparador = linhas.findIndex(separadorTabela)
  if (indiceSeparador < 1 || !linhas[indiceSeparador - 1].includes('|')) return null
  const cabecalho = celulas(linhas[indiceSeparador - 1])
  const linhasTabela = linhas.slice(indiceSeparador + 1).filter(linha => linha.includes('|')).map(celulas)
  if (cabecalho.length < 2 || !linhasTabela.length || linhasTabela.some(linha => linha.length !== cabecalho.length)) return null
  return { cabecalho, linhas: linhasTabela }
}

export function tabelaMarkdownParaHtmlSeguro(texto: string): string | null {
  const tabela = extrairTabelaMarkdownIa(texto)
  if (!tabela) return null
  const cabecalho = tabela.cabecalho.map(celula => `<th>${escaparHtml(celula)}</th>`).join('')
  const linhas = tabela.linhas.map(linha => `<tr>${linha.map(celula => `<td>${escaparHtml(celula)}</td>`).join('')}</tr>`).join('')
  return `<table><thead><tr>${cabecalho}</tr></thead><tbody>${linhas}</tbody></table>`
}

export function tabelaMarkdownParaTexto(texto: string): string {
  const tabela = extrairTabelaMarkdownIa(texto)
  if (!tabela) return texto
  return [tabela.cabecalho, ...tabela.linhas].map(linha => linha.join('\t')).join('\n')
}
