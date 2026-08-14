import type { BlocoContextoIa } from '@shared/types/ia.types'

const TIPOS_BLOCO: Record<string, BlocoContextoIa['tipo']> = {
  H1: 'titulo', H2: 'titulo', H3: 'titulo', H4: 'titulo', H5: 'titulo', H6: 'titulo',
  P: 'paragrafo', LI: 'lista', TABLE: 'tabela', FIGURE: 'figura', FIGCAPTION: 'legenda',
}

function textoElemento(elemento: Element): string {
  return (elemento.textContent || '').replace(/\s+/g, ' ').trim()
}

/** Serializa o DOM preservando a origem de cada trecho para validação local de evidências. */
export function serializarBlocosContextoIa(
  html: string,
  secaoId: string,
  secaoTitulo: string,
  ordemInicial = 0,
): BlocoContextoIa[] {
  const documento = new DOMParser().parseFromString(html, 'text/html')
  documento.querySelectorAll('script, style, [data-mce-bogus]').forEach(elemento => elemento.remove())
  const seletor = 'h1,h2,h3,h4,h5,h6,p,li,table,figure,figcaption,[data-bloco-pericial]'
  const elementos = [...documento.body.querySelectorAll(seletor)]
  const blocos: BlocoContextoIa[] = []
  let tituloAtual = secaoTitulo

  elementos.forEach((elemento, indice) => {
    if (elemento.parentElement?.closest('table') && elemento.tagName !== 'TABLE') return
    const texto = textoElemento(elemento)
    if (!texto) return
    const tipo = elemento.hasAttribute('data-bloco-pericial') ? 'bloco' : (TIPOS_BLOCO[elemento.tagName] || 'paragrafo')
    if (tipo === 'titulo') tituloAtual = texto
    const ancoraLocal = elemento.getAttribute('id')
      || elemento.getAttribute('data-arma-chave')
      || elemento.getAttribute('data-arma-indice')
      || `${secaoId}-${indice + 1}`
    blocos.push({
      id: `${secaoId}:${ordemInicial + blocos.length + 1}`,
      tipo,
      ordem: ordemInicial + blocos.length,
      secaoId,
      secaoTitulo,
      titulo: tituloAtual,
      texto,
      ancora: ancoraLocal,
    })
  })
  return blocos
}

export function localizarEvidenciasConsultaIa(
  blocos: BlocoContextoIa[],
  evidencias: string[],
): BlocoContextoIa[] | null {
  const porId = new Map(blocos.map(bloco => [bloco.id, bloco]))
  const unicos = new Set(evidencias)
  if (unicos.size !== evidencias.length) return null
  const encontrados = evidencias.map(id => porId.get(id))
  return encontrados.every((bloco): bloco is BlocoContextoIa => Boolean(bloco)) ? encontrados : null
}
