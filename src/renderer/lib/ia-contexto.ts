import type { MapaPlaceholdersResolvidos } from '@/lib/exportacao-placeholders'

function converterHtmlEmTexto(valor: string): string {
  const documento = new DOMParser().parseFromString(valor, 'text/html')
  return documento.body.textContent?.replace(/\s+/g, ' ').trim() || ''
}

function resolverPlaceholderTexto(texto: string, mapa: MapaPlaceholdersResolvidos): string {
  return texto.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_placeholder, chave: string) => {
    const resolvido = mapa[chave.trim()]
    return resolvido?.preenchido
      ? converterHtmlEmTexto(resolvido.valor)
      : `[dado não preenchido: ${chave.trim()}]`
  })
}

/** Resolve placeholders preservando a estrutura do HTML para consultas factuais. */
export function resolverHtmlContextoIa(html: string, mapa: MapaPlaceholdersResolvidos): string {
  const documento = new DOMParser().parseFromString(html, 'text/html')
  documento.querySelectorAll('[data-placeholder-preview="true"], script, style').forEach(elemento => elemento.remove())
  documento.querySelectorAll<HTMLElement>('[data-placeholder]').forEach(elemento => {
    const chaveBruta = elemento.getAttribute('data-placeholder') || ''
    const chave = chaveBruta.match(/^\{\{(.+)\}\}$/)?.[1]
    if (!chave) return
    const resolvido = mapa[chave]
    elemento.textContent = resolvido?.preenchido
      ? converterHtmlEmTexto(resolvido.valor)
      : `[dado não preenchido: ${chave}]`
    elemento.removeAttribute('data-placeholder')
  })
  const walker = documento.createTreeWalker(documento.body, NodeFilter.SHOW_TEXT)
  const nos: Text[] = []
  let no: Node | null
  while ((no = walker.nextNode())) nos.push(no as Text)
  nos.forEach(texto => { texto.textContent = resolverPlaceholderTexto(texto.textContent || '', mapa) })
  return documento.body.innerHTML
}

export function resolverTextoContextoIa(
  html: string,
  mapa: MapaPlaceholdersResolvidos,
): string {
  const documento = new DOMParser().parseFromString(html, 'text/html')
  documento.querySelectorAll('[data-placeholder-preview="true"], script, style').forEach(elemento => elemento.remove())
  documento.querySelectorAll<HTMLElement>('[data-placeholder]').forEach(elemento => {
    const chaveBruta = elemento.getAttribute('data-placeholder') || ''
    const chave = chaveBruta.match(/^\{\{(.+)\}\}$/)?.[1]
    if (!chave) return
    const resolvido = mapa[chave]
    elemento.textContent = resolvido?.preenchido
      ? converterHtmlEmTexto(resolvido.valor)
      : `[dado não preenchido: ${chave}]`
  })

  return resolverPlaceholderTexto(documento.body.textContent || '', mapa)
    .replace(/\s+/g, ' ')
    .trim()
}
