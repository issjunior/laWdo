import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor as TinyMceEditorInstance } from 'tinymce';
import {
  agendarVisualizacaoPlaceholders,
  aplicarVisualizacaoPlaceholder,
  aplicarVisualizacaoPlaceholders,
} from '../../renderer/lib/apresentacao-placeholders';

function criarEditor(body: HTMLBodyElement, pronto = true): TinyMceEditorInstance {
  return {
    initialized: pronto,
    destroyed: false,
    removed: false,
    getBody: () => body,
    undoManager: {
      ignore: (callback: () => void) => callback(),
    },
  } as unknown as TinyMceEditorInstance;
}

function criarOpcoes() {
  return {
    modo: 'dados' as const,
    valores: {
      tabela: {
        valor: '<table><tbody><tr><td>Valor</td></tr></tbody></table>',
        preenchido: true,
        formato: 'html' as const,
      },
    },
    placeholdersPersonalizados: [],
    descreverPendente: (chave: string) => `Campo pendente: ${chave}`,
  };
}

describe('apresentacao-placeholders', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('aplica o preview HTML de forma idempotente e sem criar entrada de undo', () => {
    const body = document.createElement('body');
    body.innerHTML = '<p><span data-placeholder="{{tabela}}">{{tabela}}</span></p>';
    document.body.append(body);
    const editor = criarEditor(body);
    const opcoes = criarOpcoes();

    expect(aplicarVisualizacaoPlaceholders(editor, opcoes)).toMatchObject({ estado: 'aplicado', processados: 1 });
    expect(aplicarVisualizacaoPlaceholders(editor, opcoes)).toMatchObject({ estado: 'aplicado', processados: 1 });
    expect(body.querySelectorAll('[data-placeholder-preview="true"]')).toHaveLength(1);
    expect(body.querySelector<HTMLElement>('[data-placeholder]')?.style.display).toBe('none');
  });

  it('preserva somente o placeholder que falhar e continua os demais', () => {
    const body = document.createElement('body');
    body.innerHTML = [
      '<p><span data-placeholder="{{com_erro}}">{{com_erro}}</span></p>',
      '<p><span data-placeholder="{{tabela}}">{{tabela}}</span></p>',
    ].join('');
    document.body.append(body);
    const editor = criarEditor(body);
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const opcoes = {
      ...criarOpcoes(),
      descreverPendente: (chave: string) => {
        if (chave === 'com_erro') throw new Error('Descrição inválida');
        return `Campo pendente: ${chave}`;
      },
    };

    const resultado = aplicarVisualizacaoPlaceholders(editor, opcoes);

    expect(resultado).toMatchObject({ estado: 'falhou', processados: 1, falhas: 1 });
    expect(body.querySelector<HTMLElement>('[data-placeholder="{{com_erro}}"]')?.textContent).toBe('{{com_erro}}');
    expect(body.querySelectorAll('[data-placeholder-preview="true"]')).toHaveLength(1);
    expect(aviso).toHaveBeenCalledOnce();
  });

  it('adia a aplicação até que o editor esteja pronto', () => {
    const body = document.createElement('body');
    document.body.append(body);

    expect(aplicarVisualizacaoPlaceholders(criarEditor(body, false), criarOpcoes()))
      .toMatchObject({ estado: 'adiado', processados: 0, falhas: 0 });
  });

  it('coalesce chamadas rápidas e aplica somente o estado mais recente', async () => {
    vi.useFakeTimers();
    const body = document.createElement('body');
    body.innerHTML = '<p><span data-placeholder="{{campo}}">{{campo}}</span></p>';
    document.body.append(body);
    const editor = criarEditor(body);
    const primeira = {
      ...criarOpcoes(),
      valores: { campo: { valor: 'Primeiro', preenchido: true, formato: 'texto' as const } },
    };
    const ultima = {
      ...criarOpcoes(),
      valores: { campo: { valor: 'Último', preenchido: true, formato: 'texto' as const } },
    };

    agendarVisualizacaoPlaceholders(editor, primeira);
    agendarVisualizacaoPlaceholders(editor, ultima);
    await vi.runAllTimersAsync();

    expect(body.querySelector('[data-placeholder]')?.textContent).toBe('Último');
  });

  it('atualiza somente a âncora afetada e preserva a prévia não relacionada', () => {
    const body = document.createElement('body');
    body.innerHTML = [
      '<p><span data-placeholder="{{tabela}}">{{tabela}}</span></p>',
      '<p><span data-placeholder="{{tabela}}">{{tabela}}</span></p>',
    ].join('');
    document.body.append(body);
    const editor = criarEditor(body);
    const opcoes = criarOpcoes();
    aplicarVisualizacaoPlaceholders(editor, opcoes);
    const previaPreservada = body.querySelector<HTMLElement>('[data-placeholder-preview="true"]');
    const ancoraAfetada = body.querySelectorAll<HTMLElement>('[data-placeholder]')[1];

    const resultado = aplicarVisualizacaoPlaceholder(editor, ancoraAfetada, opcoes);

    expect(resultado).toMatchObject({ estado: 'aplicado', processados: 1, previasCriadas: 1, previasRemovidas: 1 });
    expect(body.querySelector('[data-placeholder-preview="true"]')).toBe(previaPreservada);
    expect(body.querySelectorAll('[data-placeholder-preview="true"]')).toHaveLength(2);
  });

  it.each([6, 80])('conta corretamente a tabela com %i linhas sem truncar a prévia', quantidade => {
    const linhas = Array.from({ length: quantidade }, (_, indice) => `<tr><td>Item ${indice + 1}</td><td>${indice + 1}</td></tr>`).join('');
    const body = document.createElement('body');
    body.innerHTML = '<p><span data-placeholder="{{tabela}}">{{tabela}}</span></p>';
    document.body.append(body);
    const editor = criarEditor(body);
    const opcoes = {
      ...criarOpcoes(),
      valores: {
        tabela: {
          valor: `<table><thead><tr><th>Material</th><th>Quantidade</th></tr></thead><tbody>${linhas}</tbody></table>`,
          preenchido: true,
          formato: 'html' as const,
        },
      },
    };
    const ancora = body.querySelector<HTMLElement>('[data-placeholder]');

    const resultado = aplicarVisualizacaoPlaceholder(editor, ancora!, opcoes);

    expect(resultado).toMatchObject({ processados: 1, tabelas: 1, linhas: quantidade + 1, celulas: (quantidade + 1) * 2 });
    const celulas = body.querySelectorAll('[data-placeholder-preview="true"] tbody td');
    expect(celulas).toHaveLength(quantidade * 2);
    expect(celulas[0]).toHaveTextContent('Item 1');
    expect(celulas[celulas.length - 2]).toHaveTextContent(`Item ${quantidade}`);
  });
});
