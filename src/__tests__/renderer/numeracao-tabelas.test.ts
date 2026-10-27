import { describe, expect, it, vi } from 'vitest';
import type { Editor as TinyMceEditorInstance } from 'tinymce';
import { excluirTabelaPlaceholder } from '@/lib/apresentacao-placeholders';
import { conferirNumeracaoTabelasEditores, renumerarTabelas, renumerarTabelasHtml } from '@/lib/numeracao-tabelas';

describe('numeração de tabelas do laudo', () => {
  it('numera captions e primeiras células em sequência sem perder a marcação do título', () => {
    const raiz = document.createElement('div');
    raiz.innerHTML = [
      '<table><caption><strong>TABELA </strong><em>08</em> – Exame</caption><tr><td>A</td></tr></table>',
      '<table><tr><th>TABELA 05 – Material</th></tr></table>',
      '<table><tr><td>Sem título</td></tr></table>',
    ].join('');

    expect(renumerarTabelas(raiz)).toEqual({ alterado: true, alteradoPersistente: true, proximoNumero: 3 });
    expect(raiz.querySelector('caption')?.innerHTML).toBe('<strong>TABELA </strong><em>1</em> – Exame');
    expect(raiz.querySelector('th')?.textContent).toBe('TABELA 2 – Material');
    expect(raiz.querySelectorAll('table')[2].textContent).toBe('Sem título');
    expect(renumerarTabelas(raiz).alterado).toBe(false);
  });

  it('corrige a prévia visual sem alterar a âncora canônica', () => {
    const raiz = document.createElement('div');
    raiz.innerHTML = '<span data-placeholder="{{tabela}}">{{tabela}}</span><div data-placeholder-preview="true"><table><tr><td>TABELA 5 – Dados</td></tr></table></div>';

    const resultado = renumerarTabelas(raiz, { incluirPrevias: true });

    expect(resultado).toEqual({ alterado: true, alteradoPersistente: false, proximoNumero: 2 });
    expect(raiz.querySelector('[data-placeholder]')?.textContent).toBe('{{tabela}}');
    expect(raiz.querySelector('td')?.textContent).toBe('TABELA 1 – Dados');
  });

  it('exclui somente a ocorrência selecionada e renumera a tabela restante', () => {
    const raiz = document.createElement('div');
    raiz.innerHTML = [
      '<p><span data-placeholder="{{tabela}}" data-placeholder-preview-id="primeira">{{tabela}}</span></p>',
      '<div data-placeholder-preview="true" data-placeholder-preview-tabela="true" data-placeholder-preview-id="primeira"><button data-acao-tabela-placeholder="excluir">×</button><table><tr><td>TABELA 1 – A</td></tr></table></div>',
      '<p><span data-placeholder="{{tabela}}" data-placeholder-preview-id="segunda">{{tabela}}</span></p>',
      '<div data-placeholder-preview="true" data-placeholder-preview-tabela="true" data-placeholder-preview-id="segunda"><table><tr><td>TABELA 2 – B</td></tr></table></div>',
    ].join('');
    const editor = {
      getBody: () => raiz,
      undoManager: { transact: (acao: () => void) => acao() },
    } as unknown as TinyMceEditorInstance;

    expect(excluirTabelaPlaceholder(editor, raiz.querySelector('[data-acao-tabela-placeholder]') as HTMLElement)).toBe(true);
    expect(raiz.querySelectorAll('[data-placeholder]')).toHaveLength(1);
    expect(raiz.querySelector('[data-placeholder]')?.getAttribute('data-placeholder-preview-id')).toBe('segunda');
    expect(renumerarTabelas(raiz, { incluirPrevias: true }).proximoNumero).toBe(2);
    expect(raiz.querySelector('td')?.textContent).toBe('TABELA 1 – B');
  });

  it('renumera o HTML final sem contar prévias transitórias', () => {
    const html = '<div data-placeholder-preview="true"><table><caption>TABELA 9 – Prévia</caption><tr><td>A</td></tr></table></div><table><caption>TABELA 5 – Real</caption><tr><td>B</td></tr></table>';
    const resultado = renumerarTabelasHtml(html);
    expect(resultado).toContain('TABELA 1 – Real');
    const documento = new DOMParser().parseFromString(resultado, 'text/html');

    expect(documento.querySelectorAll('caption')[0].textContent).toBe('TABELA 9 – Prévia');
    expect(documento.querySelectorAll('caption')[1].textContent).toBe('TABELA 1 – Real');
  });

  it('corrige prévias sem serializar editores quando o conteúdo persistível não mudou', () => {
    const raiz = document.createElement('div');
    raiz.innerHTML = '<div data-placeholder-preview="true"><table><tr><td>TABELA 9 – Prévia</td></tr></table></div>';
    const getContent = vi.fn(() => raiz.innerHTML);
    const editor = {
      getBody: () => raiz,
      getContent,
      undoManager: { ignore: (acao: () => void) => acao() },
    } as unknown as TinyMceEditorInstance;

    expect(conferirNumeracaoTabelasEditores([editor], false)).toEqual({ alteradoPersistente: false, conteudos: null });
    expect(raiz.querySelector('td')?.textContent).toBe('TABELA 1 – Prévia');
    expect(getContent).not.toHaveBeenCalled();
    expect(conferirNumeracaoTabelasEditores([editor], true).conteudos).toEqual([raiz.innerHTML]);
    expect(getContent).toHaveBeenCalledTimes(1);
  });

  it('lê os editores após correção persistente e mantém a sequência entre seções', () => {
    const raizes = [document.createElement('div'), document.createElement('div')];
    raizes[0].innerHTML = '<table><tr><td>TABELA 1 – Primeira</td></tr></table>';
    raizes[1].innerHTML = '<table><tr><td>TABELA 9 – Segunda</td></tr></table>';
    const leituras = raizes.map(raiz => vi.fn(() => raiz.innerHTML));
    const editores = raizes.map((raiz, indice) => ({
      getBody: () => raiz,
      getContent: leituras[indice],
      undoManager: { ignore: (acao: () => void) => acao() },
    } as unknown as TinyMceEditorInstance));

    const resultado = conferirNumeracaoTabelasEditores(editores, false);
    expect(resultado.alteradoPersistente).toBe(true);
    expect(resultado.conteudos?.[1]).toContain('TABELA 2 – Segunda');
    expect(leituras[0]).toHaveBeenCalledTimes(1);
    expect(leituras[1]).toHaveBeenCalledTimes(1);
  });
});
