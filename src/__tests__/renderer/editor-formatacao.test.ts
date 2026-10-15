import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Editor } from 'tinymce';
import { webcrypto } from 'node:crypto';
import {
  aplicarRecuoPrimeiraLinha,
  converterRecuoParaPt,
  FORMATOS_LIMPEZA_EDITOR,
  limparFormatacaoEditor,
  obterRecuoSelecionado,
  recuoCorresponde,
} from '../../renderer/components/editor/editor-formatacao';

describe('formatação do editor', () => {
  let editor: Editor;

  beforeAll(async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }));
    vi.stubGlobal('crypto', webcrypto);
    Object.defineProperty(HTMLElement.prototype, 'contentEditable', {
      configurable: true,
      get() { return this.getAttribute('contenteditable') || 'inherit'; },
      set(valor: string) { this.setAttribute('contenteditable', valor); },
    });
    Object.defineProperty(HTMLElement.prototype, 'isContentEditable', {
      configurable: true,
      get() { return this.closest('[contenteditable]')?.getAttribute('contenteditable') === 'true'; },
    });
    Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() });
    const { default: tinymce } = await import('tinymce');
    await import('tinymce/models/dom');
    await import('tinymce/icons/default');
    const campo = document.createElement('div');
    campo.id = 'editor-formatacao-teste';
    document.body.append(campo);
    [editor] = await tinymce.init({
      target: campo, inline: true, license_key: 'gpl', theme: false, model: 'dom',
      skin: false, content_css: false, promotion: false,
      formats: FORMATOS_LIMPEZA_EDITOR,
      setup: instancia => instancia.addCommand('RemoveFormat', () => limparFormatacaoEditor(instancia)),
    });
  });

  afterAll(() => {
    editor?.remove();
    document.getElementById('editor-formatacao-teste')?.remove();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLElement.prototype, 'contentEditable');
    Reflect.deleteProperty(HTMLElement.prototype, 'isContentEditable');
    Reflect.deleteProperty(Range.prototype, 'getClientRects');
    Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect');
  });

  function selecionar(seletor: string, colapsar = false) {
    const elemento = editor.getBody().querySelector(seletor);
    if (!elemento) throw new Error(`Elemento ausente: ${seletor}`);
    editor.selection.select(elemento, true);
    if (colapsar) editor.selection.collapse(true);
    return elemento as HTMLElement;
  }

  it('normaliza unidades equivalentes e indica somente um recuo', () => {
    for (const valor of ['35.43pt', '1.25cm', '12.5mm', '47.24px']) {
      expect(recuoCorresponde(converterRecuoParaPt(valor), '35.43pt')).toBe(true);
      expect(recuoCorresponde(converterRecuoParaPt(valor))).toBe(false);
    }
    expect(recuoCorresponde(0)).toBe(true);
    expect(recuoCorresponde(null)).toBe(false);
    expect(converterRecuoParaPt('2em')).toBeNull();
  });

  it('não marca seleções com recuos diferentes e zera somente a primeira linha', () => {
    editor.setContent('<p style="text-indent:35.43pt;color:red">Um</p><p>Dois</p>');
    editor.selection.select(editor.getBody(), true);
    expect(obterRecuoSelecionado(editor)).toBeNull();
    const paragrafo = selecionar('p', true);
    editor.undoManager.clear();
    editor.undoManager.add();
    aplicarRecuoPrimeiraLinha(editor);
    expect(converterRecuoParaPt(paragrafo.style.textIndent)).toBe(0);
    expect(paragrafo.style.color).toBe('red');
    editor.undoManager.undo();
    expect(converterRecuoParaPt(editor.getBody().querySelector('p')!.style.textIndent)).toBeCloseTo(35.43);
    editor.undoManager.redo();
    expect(obterRecuoSelecionado(editor)).toBe(0);
  });

  it('limpa o parágrafo do cursor e permite desfazer/refazer a operação inteira', () => {
    editor.setContent('<p style="text-indent:35.43pt;margin-left:20pt;line-height:2"><strong><em><a href="https://example.com">Texto</a></em></strong></p>');
    selecionar('a', true);
    expect(editor.selection.getSelectedBlocks().map(bloco => bloco.tagName)).toEqual(['P']);
    const anterior = editor.getContent();
    editor.undoManager.clear();
    editor.undoManager.add();
    editor.execCommand('RemoveFormat');
    const limpo = editor.getContent();
    expect(editor.getBody().querySelector('strong,em,a')).toBeNull();
    expect(new DOMParser().parseFromString(limpo, 'text/html').body.textContent).toBe('Texto');
    const paragrafo = editor.getBody().querySelector('p')!;
    expect(paragrafo.style.fontFamily).toContain('Arial');
    expect(paragrafo.style.fontSize).toBe('14px');
    expect(paragrafo.style.textAlign).toBe('justify');
    expect(paragrafo.style.marginLeft).toBe('');
    expect(paragrafo.style.lineHeight).toBe('');
    expect(editor.selection.isCollapsed()).toBe(true);
    editor.undoManager.undo();
    expect(editor.getContent()).toBe(anterior);
    editor.undoManager.redo();
    expect(editor.getContent()).toBe(limpo);
  });

  it('limpa apenas o trecho selecionado e preserva o restante', () => {
    editor.setContent('<p><strong><a href="https://example.com"><span style="color:red">Antes meio depois</span></a></strong></p>');
    const texto = editor.getBody().querySelector('span')!.firstChild!;
    const intervalo = editor.getDoc().createRange();
    intervalo.setStart(texto, 6);
    intervalo.setEnd(texto, 10);
    editor.selection.setRng(intervalo);
    limparFormatacaoEditor(editor);
    expect(editor.selection.getRng().toString()).toBe('meio');
    const links = [...editor.getBody().querySelectorAll('a')];
    expect(links.map(link => link.textContent).join('')).toBe('Antes  depois');
    expect(editor.getBody().textContent).toBe('Antes meio depois');
  });

  it('preserva figuras, tabelas, placeholders e blocos condicionais', () => {
    editor.setContent('<div class="cond-bloco" data-cond-bloco="teste" contenteditable="true"><p><b>Texto</b><span class="placeholder-tag" data-placeholder="{{campo}}" contenteditable="false">{{campo}}</span></p><table style="width:80%;border:1px solid red"><tbody><tr><td><p><i>Célula</i></p><figure class="laudo-figure" data-image-id="dummy-1" data-dummy="true"><img src="dummy.png"><figcaption><b>Figura XX</b></figcaption></figure></td></tr></tbody></table></div>');
    const figura = editor.getBody().querySelector('figure')!;
    const imagem = figura.querySelector('img');
    const antes = figura.outerHTML;
    const placeholder = editor.getBody().querySelector('[data-placeholder]')!;
    const antesPlaceholder = placeholder.outerHTML;
    editor.selection.select(editor.getBody(), true);
    limparFormatacaoEditor(editor);
    expect(figura.outerHTML).toBe(antes);
    expect(figura.querySelector('img')).toBe(imagem);
    expect(placeholder.outerHTML).toBe(antesPlaceholder);
    expect(editor.getBody().querySelector('table')!.style.width).toBe('80%');
    expect(editor.getBody().querySelector('[data-cond-bloco="teste"]')).not.toBeNull();
    expect(editor.getBody().querySelector('p b,p i')).toBeNull();
  });

  it('limpa estilos herdados do parágrafo somente no texto selecionado', () => {
    editor.setContent('<p style="font-weight:bold;color:red;text-decoration:underline;font-family:Georgia;font-size:20px">Antes meio depois</p>');
    const texto = editor.getBody().querySelector('p')!.firstChild!;
    const intervalo = editor.getDoc().createRange();
    intervalo.setStart(texto, 6);
    intervalo.setEnd(texto, 10);
    editor.selection.setRng(intervalo);
    limparFormatacaoEditor(editor);
    expect(editor.selection.getRng().toString()).toBe('meio');
    const spans = [...editor.getBody().querySelectorAll('span')];
    expect(spans.filter(span => span.style.color === 'red').map(span => span.textContent).join('')).toBe('Antes  depois');
    const selecionado = spans.find(span => span.textContent === 'meio')!;
    expect(selecionado.style.fontFamily).toContain('Arial');
    expect(selecionado.style.fontSize).toBe('14px');
    expect(selecionado.style.textDecoration).toBe('none');
    const conteudo = editor.getContent();
    editor.setContent(conteudo);
    expect(editor.getContent()).toBe(conteudo);
  });

  it('limpa parágrafos vazios e mantém a posição do cursor no texto', () => {
    editor.setContent('<p style="text-indent:35.43pt">&nbsp;</p>');
    selecionar('p', true);
    limparFormatacaoEditor(editor);
    expect(editor.getBody().querySelector('p')!.style.fontSize).toBe('14px');
    editor.setContent('<p><b>Antes meio depois</b></p>');
    const texto = editor.getBody().querySelector('strong')!.firstChild!;
    editor.selection.setCursorLocation(texto, 8);
    limparFormatacaoEditor(editor);
    const intervalo = editor.selection.getRng().cloneRange();
    intervalo.setStart(editor.getBody().querySelector('p')!, 0);
    expect(intervalo.toString().replace(/\uFEFF/g, '')).toBe('Antes me');
  });
});
