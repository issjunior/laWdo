import { afterEach, describe, expect, it, vi } from 'vitest';
import { buscarTextoNoLaudo, rolarAteTextoLaudo } from '@/lib/busca-texto-laudo';

function criarRolagem(elemento: HTMLElement, altura: number, conteudo: number, topo = 0) {
  elemento.style.overflowY = 'auto';
  Object.defineProperties(elemento, { clientHeight: { value: altura, configurable: true }, scrollHeight: { value: conteudo, configurable: true } });
  vi.spyOn(elemento, 'getBoundingClientRect').mockImplementation(() => ({ top: topo, height: altura } as DOMRect));
  const rolar = vi.fn((opcoes?: ScrollToOptions | number, topo?: number) => {
    elemento.scrollTop = typeof opcoes === 'number' ? topo || 0 : opcoes?.top || 0;
  });
  elemento.scrollTo = rolar;
  return rolar;
}

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('rolagem até a posição exata da ocorrência', () => {
  it.each([
    '<p>laudo texto longo laudo</p>',
    '<p>laudo</p><p>laudo</p>',
    '<p><span contenteditable="false">laudo</span></p><table><tbody><tr><td>laudo</td></tr></tbody></table>',
  ])('distingue ocorrências distantes, inclusive dentro do mesmo elemento: %s', html => {
    const painel = document.createElement('div'); painel.innerHTML = html; document.body.append(painel);
    const rolar = criarRolagem(painel, 600, 10000, 100);
    const resultados = buscarTextoNoLaudo(painel, 'laudo');
    resultados.forEach(({ intervalo }, indice) => {
      intervalo.getClientRects = () => [{ top: 100 + (indice ? 4000 : 1000) - painel.scrollTop, height: 20, width: 50 }] as unknown as DOMRectList;
    });
    const anterior = painel.innerHTML;
    expect(rolarAteTextoLaudo(resultados[0].intervalo)).toBe(true);
    expect(rolar).toHaveBeenLastCalledWith({ top: 710, behavior: 'instant' });
    rolarAteTextoLaudo(resultados[1].intervalo);
    expect(rolar).toHaveBeenLastCalledWith({ top: 3710, behavior: 'instant' });
    rolarAteTextoLaudo(resultados[0].intervalo);
    expect(rolar).toHaveBeenLastCalledWith({ top: 710, behavior: 'instant' });
    expect(painel.innerHTML).toBe(anterior);
  });

  it('converte coordenadas do iframe e rola o conteúdo interno antes da página', () => {
    const painel = document.createElement('div'); document.body.append(painel);
    const rolarPagina = criarRolagem(painel, 600, 10000, 100);
    const iframe = document.createElement('iframe'); painel.append(iframe);
    const documento = iframe.contentDocument!;
    documento.body.innerHTML = '<p>Ocorrência</p>';
    const raiz = documento.documentElement;
    const rolarEditor = criarRolagem(raiz, 400, 6000);
    Object.defineProperty(documento.defaultView!, 'innerHeight', { value: 400 });
    Object.defineProperty(iframe, 'offsetHeight', { value: 400 });
    vi.spyOn(iframe, 'getBoundingClientRect').mockImplementation(() => ({ top: 1200 - painel.scrollTop, height: 400 } as DOMRect));
    const intervalo = buscarTextoNoLaudo(documento.body, 'Ocorrência')[0].intervalo;
    intervalo.getClientRects = () => [{ top: 2000 - raiz.scrollTop, height: 20, width: 100 }] as unknown as DOMRectList;
    rolarAteTextoLaudo(intervalo, iframe);
    expect(rolarEditor).toHaveBeenCalledWith({ top: 1810, behavior: 'instant' });
    expect(rolarPagina).toHaveBeenCalledWith({ top: 1000, behavior: 'instant' });
    expect(rolarEditor.mock.invocationCallOrder[0]).toBeLessThan(rolarPagina.mock.invocationCallOrder[0]);
  });

  it('reserva espaço para a barra fixa e aguarda quando a ocorrência está recolhida', () => {
    const painel = document.createElement('div');
    painel.innerHTML = '<div data-barra-busca-laudo style="position:sticky"></div><p>Texto</p>';
    document.body.append(painel);
    const rolar = criarRolagem(painel, 600, 10000, 100);
    vi.spyOn(painel.firstElementChild!, 'getBoundingClientRect').mockReturnValue({ height: 80 } as DOMRect);
    const intervalo = buscarTextoNoLaudo(painel, 'Texto')[0].intervalo;
    intervalo.getClientRects = () => [] as unknown as DOMRectList;
    expect(rolarAteTextoLaudo(intervalo)).toBe(false);
    expect(rolar).not.toHaveBeenCalled();
    intervalo.getClientRects = () => [{ top: 1100, height: 20, width: 100 }] as unknown as DOMRectList;
    expect(rolarAteTextoLaudo(intervalo)).toBe(true);
    expect(rolar).toHaveBeenCalledWith({ top: 670, behavior: 'instant' });
  });
});
