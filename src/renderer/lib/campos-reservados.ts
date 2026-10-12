const SELETOR_CAMPO_RESERVADO = 'span[data-placeholder]:not([data-placeholder-tabela-personalizada-id]), .campo-reservado[data-reservado="true"], [data-placeholder-personalizado-livre="true"]';

export function encontrarCampoReservado(alvo: EventTarget | null): HTMLElement | null {
  if (alvo === null || typeof alvo !== 'object' || !('closest' in alvo)) return null;
  const closest = (alvo as { closest?: unknown }).closest;
  if (typeof closest !== 'function') return null;

  const campo = closest.call(alvo, SELETOR_CAMPO_RESERVADO) as HTMLElement | null;
  if (campo?.closest('[data-placeholder-preview="true"], [data-placeholder-tabela-personalizada="true"]')) return null;
  return campo?.closest<HTMLElement>('span[data-placeholder]') || campo;
}

export function normalizarHtmlCampo(html: string): string {
  const documento = new DOMParser().parseFromString(html, 'text/html');
  const destino = document.createElement('div');
  const copiar = (origem: Node, pai: Node): void => {
    if (origem.nodeType === Node.TEXT_NODE) {
      pai.appendChild(document.createTextNode(origem.textContent || ''));
      return;
    }
    if (!(origem instanceof HTMLElement)) return;
    if (['SCRIPT', 'STYLE', 'IMG', 'TABLE'].includes(origem.tagName)) return;
    const tag = origem.tagName === 'B' ? 'STRONG' : origem.tagName === 'I' ? 'EM' : origem.tagName;
    if (tag === 'BR') { pai.appendChild(document.createElement('br')); return; }
    const recipiente = ['STRONG', 'EM', 'U', 'SUP', 'SUB'].includes(tag) ? document.createElement(tag.toLowerCase()) : pai;
    if (recipiente !== pai) pai.appendChild(recipiente);
    origem.childNodes.forEach(filho => copiar(filho, recipiente));
    if (recipiente === pai && ['P', 'DIV', 'LI'].includes(tag) && origem.nextElementSibling) pai.appendChild(document.createElement('br'));
  };
  documento.body.childNodes.forEach(no => copiar(no, destino));
  return destino.innerHTML.replace(/(?:<br>)+$/i, '');
}

export function obterHtmlCampo(campo: HTMLElement): string {
  const salvo = campo.getAttribute('data-placeholder-personalizado-html');
  if (salvo) {
    try { return normalizarHtmlCampo(decodeURIComponent(salvo)); } catch { return ''; }
  }
  return campo.innerHTML;
}

export function preencherCampoReservado(campo: HTMLElement, valor: string): boolean {
  const html = normalizarHtmlCampo(valor);
  const texto = new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim();
  if (!texto) return false;
  campo.setAttribute('data-placeholder-personalizado-html', encodeURIComponent(html));
  if (!campo.hasAttribute('data-placeholder')) campo.setAttribute('data-placeholder-personalizado-livre', 'true');
  campo.innerHTML = html;
  campo.classList.remove('campo-reservado');
  campo.classList.add('placeholder-personalizado');
  campo.removeAttribute('data-reservado');
  campo.removeAttribute('data-tooltip-xxx');
  campo.removeAttribute('title');
  campo.setAttribute('aria-label', 'Texto personalizado neste laudo. Clique duas vezes para editar.');
  return true;
}

export function restaurarCampoReservado(campo: HTMLElement): boolean {
  if (!campo.hasAttribute('data-placeholder')) return false;
  campo.removeAttribute('data-placeholder-personalizado-html');
  campo.classList.remove('placeholder-personalizado');
  campo.removeAttribute('aria-label');
  return true;
}
