import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from 'tinymce';
import { registrarEdicaoDiretaLaudo } from '@/lib/edicao-direta-laudo';
import { removerFormatacaoPlaceholders } from '@/lib/utils';

const limpezas: Array<() => void> = [];
function preparar() {
  document.body.innerHTML = '<p><span data-placeholder="{{tabela}}" data-placeholder-preview-id="p1" style="display:none">{{tabela}}</span></p><div data-placeholder-preview="true" data-placeholder-preview-tabela="true" data-placeholder-preview-id="p1"><table><tbody><tr><th>Descrição</th><td>Valor original</td></tr></tbody></table></div>';
  const eventos = new Map<string, Array<(evento?: unknown) => unknown>>();
  const disparar = (nome: string, evento?: unknown) => {
    let permitido = true;
    for (const executar of eventos.get(nome) ?? []) if (executar(evento) === false) permitido = false;
    return permitido;
  };
  const editor = {
    getDoc: () => document, getBody: () => document.body, mode: { isReadOnly: () => false },
    getContent: () => disparar('BeforeGetContent') ? document.body.innerHTML : '',
    on: (nomes: string, executar: (evento?: unknown) => void) => nomes.split(' ').forEach(nome => eventos.set(nome, [...(eventos.get(nome) ?? []), executar])),
    off: vi.fn(), dispatch: (nome: string) => disparar(nome),
    undoManager: { ignore: (executar: () => void) => executar(), transact: (executar: () => void) => executar(), add: vi.fn() },
  } as unknown as Editor;
  registrarEdicaoDiretaLaudo(editor);
  limpezas.push(() => disparar('remove'));
  const celula = document.querySelector('td')!;
  return { editor, celula, disparar, salvar: () => removerFormatacaoPlaceholders(editor.getContent()) };
}
afterEach(() => {
  limpezas.splice(0).forEach(limpar => limpar());
  document.body.innerHTML = '';
  document.body.removeAttribute('data-laudo-edicao-direta');
});

describe('personalização automática das tabelas do laudo', () => {
  it('preparação assíncrona, foco e leitura do conteúdo não personalizam a tabela', () => {
    const { editor, celula, salvar } = preparar();
    celula.textContent = 'Valor preparado';
    editor.getContent();
    editor.dispatch('LaudoPreparado');
    celula.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    expect(salvar()).not.toContain('data-placeholder-tabela-personalizada');
    expect(salvar()).toContain('{{tabela}}');
  });

  it.each(['texto', 'formatação', 'estrutura'] as const)('preserva a primeira alteração de %s ao serializar', tipo => {
    const { editor, celula, salvar } = preparar();
    editor.dispatch('LaudoPreparado');
    if (tipo === 'texto') celula.textContent = 'Texto editado';
    if (tipo === 'formatação') celula.style.fontWeight = 'bold';
    if (tipo === 'estrutura') celula.parentElement!.insertAdjacentHTML('afterend', '<tr><td>Nova linha</td></tr>');
    const html = salvar();
    expect(html).toContain('data-placeholder-tabela-personalizada="true"');
    expect(html).not.toContain('data-placeholder-preview="true"');
    expect(html).not.toContain('data-placeholder-preview-id');
    expect(html).toContain(tipo === 'texto' ? 'Texto editado' : tipo === 'formatação' ? 'font-weight: bold' : 'Nova linha');
    expect(salvar()).toBe(html);
  });

  it('entrada do usuário materializa antes de notificar o conteúdo', () => {
    const { editor, celula } = preparar();
    editor.dispatch('LaudoPreparado');
    celula.textContent = 'Digitado';
    celula.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    expect(celula.closest('[data-placeholder-tabela-personalizada="true"]')).not.toBeNull();
  });

  it('colagem e inserção na seleção não redefinem o texto editado como referência da REP', () => {
    const { editor, celula, disparar, salvar } = preparar();
    editor.dispatch('LaudoPreparado');
    celula.innerHTML = '<em>Texto colado</em>';
    disparar('SetContent', { selection: true });
    expect(salvar()).toContain('data-placeholder-tabela-personalizada="true"');
    expect(salvar()).toContain('<em>Texto colado</em>');
  });

  it('incorpora o vínculo ao nível de undo já criado pelo comando', () => {
    const { editor, celula, disparar } = preparar();
    editor.dispatch('LaudoPreparado');
    celula.innerHTML = '<strong>Valor formatado</strong>';
    const impedir = vi.fn();
    disparar('BeforeAddUndo', { preventDefault: impedir, originalEvent: undefined });
    expect(impedir).toHaveBeenCalledOnce();
    expect(editor.undoManager.add).toHaveBeenCalledOnce();
    expect(celula.closest('[data-placeholder-tabela-personalizada]')).not.toBeNull();
  });

  it('ignora apresentação transitória e descarta referências antigas ao atualizar os dados', () => {
    const { editor, celula, salvar } = preparar();
    editor.dispatch('LaudoPreparado');
    celula.setAttribute('contenteditable', 'true');
    celula.parentElement!.insertAdjacentHTML('beforeend', '<td data-mce-bogus="all">Controle</td>');
    // A preparação remove controles transitórios antes de comparar a tabela.
    celula.parentElement!.lastElementChild!.remove();
    expect(salvar()).not.toContain('data-placeholder-tabela-personalizada');
    celula.closest('[data-placeholder-preview]')!.remove();
    editor.dispatch('PlaceholdersAplicados');
    expect(salvar()).toContain('{{tabela}}');
  });

  it('excluir toda a tabela não a recria pela âncora ao reabrir', () => {
    const { editor, celula, salvar } = preparar();
    editor.dispatch('LaudoPreparado');
    celula.closest('[data-placeholder-preview]')!.remove();
    expect(salvar()).not.toContain('{{tabela}}');
  });
});
