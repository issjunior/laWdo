const SELETOR_CAMPO_RESERVADO = '.campo-reservado[data-reservado="true"]';

export function encontrarCampoReservado(alvo: EventTarget | null): HTMLElement | null {
  if (alvo === null || typeof alvo !== 'object' || !('closest' in alvo)) return null;
  const closest = (alvo as { closest?: unknown }).closest;
  if (typeof closest !== 'function') return null;

  const campo = closest.call(alvo, SELETOR_CAMPO_RESERVADO) as HTMLElement | null;
  return campo?.textContent?.trim().toUpperCase() === 'XXX' ? campo : null;
}

export function preencherCampoReservado(campo: HTMLElement, valor: string): boolean {
  const valorNormalizado = valor.trim();
  if (!valorNormalizado) return false;

  campo.textContent = valorNormalizado;
  campo.classList.remove('campo-reservado', 'placeholder-tag');
  [
    'contenteditable',
    'data-placeholder',
    'data-placeholder-apresentacao',
    'data-placeholder-preview-id',
    'data-reservado',
    'data-tooltip-xxx',
    'data-origem-xxx',
    'title',
    'aria-label',
  ].forEach(atributo => campo.removeAttribute(atributo));
  campo.style.removeProperty('display');
  return true;
}
