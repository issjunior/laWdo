import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from 'tinymce';
import type { SugestoesCorretor } from '@shared/types/corretor.types';
import { notificarEstadoCorretor, obterContextoCorrecao, registrarCorretorEditor } from '@/lib/corretor-editor';

const limpezas: Array<() => void> = [];
const apiOriginal = window.ipcAPI;

async function preparar(html = '<p>O projétiu foi examinado.</p>', responder = true, edicaoDireta = false) {
  document.body.innerHTML = html;
  if (edicaoDireta) document.body.setAttribute('data-laudo-edicao-direta', 'true');
  const texto = document.querySelector('p, td, th, span')!.firstChild!;
  let selecao: Range;
  const encerrar = vi.fn();
  const encaminharMenu = vi.fn();
  let receberSugestoes: (dados: SugestoesCorretor) => void = () => undefined;
  Object.defineProperty(window, 'ipcAPI', { value: { corretor: {
    obter: async () => ({ success: true, data: { ativo: true, disponivel: true, palavras: [] } }),
    onSugestoes: (callback: (dados: SugestoesCorretor) => void) => {
      receberSugestoes = callback;
      return () => undefined;
    },
  } } });
  Object.defineProperty(document, 'caretRangeFromPoint', { configurable: true, value: () => {
    const cursor = document.createRange();
    cursor.setStart(texto, Math.min(4, texto.textContent!.length));
    return cursor;
  } });
  const editor = {
    id: 'corretor-teste', getDoc: () => document, getBody: () => document.body,
    mode: { isReadOnly: vi.fn(() => false) },
    selection: { setRng: (intervalo: Range) => { selecao = intervalo; } },
    dom: { encode: (valor: string) => valor },
    undoManager: { transact: vi.fn((acao: () => void) => acao()) },
    insertContent: vi.fn((valor: string) => { selecao.deleteContents(); selecao.insertNode(document.createTextNode(valor)); }),
    nodeChanged: vi.fn(), dispatch: vi.fn(), focus: vi.fn(),
    on: (_nome: string, callback: () => void) => { encerrar.mockImplementation(callback); },
  } as unknown as Editor;
  registrarCorretorEditor(editor, encaminharMenu);
  limpezas.push(encerrar);
  await Promise.resolve();
  const clicar = () => {
    texto.parentElement!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    if (responder) receberSugestoes({ palavra: 'projétiu', sugestoes: ['projétil'] });
  };
  clicar();
  return { editor, texto, clicar, encaminharMenu, receberSugestoes, encerrar };
}

afterEach(() => {
  limpezas.splice(0).forEach(limpar => limpar());
  Object.defineProperty(window, 'ipcAPI', { value: apiOriginal });
  Reflect.deleteProperty(document, 'caretRangeFromPoint');
  document.body.innerHTML = '';
  document.body.removeAttribute('data-laudo-edicao-direta');
});

describe('corretor do editor', () => {
  it('corrige texto formatado de bloco condicional no laudo sem etapa de liberação', async () => {
    const { editor } = await preparar('<div class="cond-bloco" data-cond-bloco="teste"><p>O pro<strong>jé</strong>tiu foi examinado.</p></div>', true, true);
    expect(obterContextoCorrecao(editor.id)?.palavra).toBe('projétiu');
    expect(obterContextoCorrecao(editor.id)?.aplicar('projétil')).toBe(true);
    expect(document.querySelector('.cond-bloco')?.textContent).toBe('O projétil foi examinado.');
  });
  it('abre o menu somente após receber o resultado nativo, com as sugestões já disponíveis', async () => {
    const { editor, encaminharMenu, receberSugestoes } = await preparar(undefined, false);
    expect(encaminharMenu).not.toHaveBeenCalled();
    encaminharMenu.mockImplementation(() => expect(obterContextoCorrecao(editor.id)?.palavra).toBe('projétiu'));
    receberSugestoes({ palavra: 'projétiu', sugestoes: ['projétil'] });
    expect(encaminharMenu).toHaveBeenCalledOnce();
  });

  it('mantém o menu original quando a resposta nativa não corresponde à palavra clicada', async () => {
    const { editor, encaminharMenu, receberSugestoes } = await preparar(undefined, false);
    receberSugestoes({ palavra: '', sugestoes: [] });
    expect(obterContextoCorrecao(editor.id)).toBeNull();
    expect(encaminharMenu).toHaveBeenCalledOnce();
  });

  it('descarta sugestões atrasadas após encerrar o editor', async () => {
    const { editor, encaminharMenu, receberSugestoes, encerrar } = await preparar(undefined, false);
    encerrar();
    receberSugestoes({ palavra: 'projétiu', sugestoes: ['projétil'] });
    expect(obterContextoCorrecao(editor.id)).toBeNull();
    expect(encaminharMenu).not.toHaveBeenCalled();
  });

  it('abrir o menu não altera HTML; corrigir troca só a palavra em uma transação de desfazer', async () => {
    const { editor } = await preparar();
    expect(document.body.innerHTML).toBe('<p>O projétiu foi examinado.</p>');
    expect(editor.undoManager.transact).not.toHaveBeenCalled();
    expect(obterContextoCorrecao(editor.id)?.palavra).toBe('projétiu');
    expect(obterContextoCorrecao(editor.id)?.aplicar('projétil')).toBe(true);
    expect(document.body.textContent).toBe('O projétil foi examinado.');
    expect(editor.undoManager.transact).toHaveBeenCalledOnce();
    expect(editor.dispatch).toHaveBeenCalledWith('change');
  });

  it('reconhece a palavra inteira quando a formatação divide o texto em vários nós', async () => {
    const { editor } = await preparar('<p>O pro<strong>jé</strong>tiu foi examinado.</p>');
    expect(obterContextoCorrecao(editor.id)?.palavra).toBe('projétiu');
    expect(obterContextoCorrecao(editor.id)?.aplicar('projétil')).toBe(true);
    expect(document.body.textContent).toBe('O projétil foi examinado.');
  });

  it('não une palavras separadas por uma quebra de linha', async () => {
    const { editor } = await preparar('<p>O pro<br>jétiu foi examinado.</p>');
    expect(obterContextoCorrecao(editor.id)).toBeNull();
  });

  it.each([
    '<div class="cond-bloco" data-cond-bloco="teste"><p>O projétiu.</p></div>',
    '<table><tr><th>O projétiu.</th></tr></table>',
    '<span data-placeholder="{{teste}}">O projétiu.</span>',
    '<span data-placeholder="{{teste}}" data-placeholder-personalizado-html="local">O projétiu.</span>',
    '<span data-placeholder-personalizado-livre="true">O projétiu.</span>',
    '<span data-placeholder-personalizado-html="local">O projétiu.</span>',
    '<span data-reservado="true">O projétiu.</span>',
    '<p contenteditable="false">O projétiu.</p>',
    '<p>O pro<span contenteditable="false">jé</span>tiu.</p>',
  ])('não oferece correção em conteúdo protegido: %s', async html => {
    const { editor } = await preparar(html);
    expect(obterContextoCorrecao(editor.id)).toBeNull();
  });

  it('revalida conteúdo e somente leitura antes da substituição', async () => {
    const { editor, texto, clicar } = await preparar();
    const contexto = obterContextoCorrecao(editor.id)!;
    texto.textContent = 'O projétiu mudou.';
    expect(contexto.aplicar('projétil')).toBe(false);
    clicar();
    const novoContexto = obterContextoCorrecao(editor.id)!;
    vi.mocked(editor.mode.isReadOnly).mockReturnValue(true);
    expect(novoContexto.aplicar('projétil')).toBe(false);
    expect(editor.insertContent).not.toHaveBeenCalled();
  });

  it('desativar invalida o menu já aberto e não muda o HTML', async () => {
    const { editor, clicar } = await preparar();
    const contexto = obterContextoCorrecao(editor.id)!;
    const antes = document.body.innerHTML;
    notificarEstadoCorretor({ ativo: false, disponivel: true, palavras: [] });
    expect(contexto.aplicar('projétil')).toBe(false);
    clicar();
    expect(obterContextoCorrecao(editor.id)).toBeNull();
    expect(document.body.innerHTML).toBe(antes);
  });

  it('não recupera uma sugestão antiga ao reativar ou atualizar o dicionário', async () => {
    const { editor, clicar } = await preparar();
    const contextoAnterior = obterContextoCorrecao(editor.id)!;
    notificarEstadoCorretor({ ativo: false, disponivel: true, palavras: [] });
    notificarEstadoCorretor({ ativo: true, disponivel: true, palavras: [] });
    expect(contextoAnterior.aplicar('projétil')).toBe(false);
    clicar();
    const novoContexto = obterContextoCorrecao(editor.id)!;
    notificarEstadoCorretor({ ativo: true, disponivel: true, palavras: ['projétiu'] });
    expect(novoContexto.aplicar('projétil')).toBe(false);
    expect(editor.insertContent).not.toHaveBeenCalled();
  });

  it('não aplica uma sugestão substituída por outra consulta ou após fechar o editor', async () => {
    const { editor, clicar, encerrar } = await preparar();
    const anterior = obterContextoCorrecao(editor.id)!;
    clicar();
    expect(anterior.aplicar('projétil')).toBe(false);
    const atual = obterContextoCorrecao(editor.id)!;
    encerrar();
    expect(obterContextoCorrecao(editor.id)).toBeNull();
    expect(atual.aplicar('projétil')).toBe(false);
  });
});

