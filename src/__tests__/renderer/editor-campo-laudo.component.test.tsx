import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorCampoLaudo } from '../../renderer/components/laudo/EditorCampoLaudo';
import { ESTILO_TIPOGRAFIA_EDITOR_LAUDO } from '@/lib/tipografia-editor-laudo';
import type { Editor as InstanciaEditor, RawEditorOptions } from 'tinymce';
import * as corretor from '@/lib/corretor-editor';

const estado = vi.hoisted(() => ({ configuracao: {} as RawEditorOptions }));

vi.mock('@tinymce/tinymce-react', () => ({
  Editor: ({ id, initialValue, onEditorChange, init }: { id: string; initialValue: string; onEditorChange: (html: string) => void; init: RawEditorOptions }) => {
    estado.configuracao = init;
    return <textarea id={id} aria-label="Editor do campo" data-valor-inicial={initialValue} defaultValue={initialValue} onChange={evento => onEditorChange(evento.target.value)} />;
  },
}));

afterEach(() => vi.restoreAllMocks());

describe('editor de texto personalizado do laudo', () => {
  it('oferece os recuos do editor principal e só altera a prévia antes da confirmação', () => {
    const origem = document.createElement('p');
    origem.style.textIndent = '28.35pt';
    origem.innerHTML = '<span>Texto do campo</span>';
    document.body.append(origem);
    try {
      const aoRecuar = vi.fn();
      render(<EditorCampoLaudo valor="Texto do campo" elementoOrigem={origem.firstElementChild as HTMLElement} onChange={vi.fn()} onRecuoChange={aoRecuar} />);
      expect(estado.configuracao.toolbar).toContain('recuoprimeiralinha');
      expect(estado.configuracao.ui_mode).toBe('split');
      expect(estado.configuracao.content_style).toContain(`text-indent: ${getComputedStyle(origem).textIndent};`);
      const menus: Array<{ fetch: (callback: (itens: Array<{ text: string; onAction: () => void }>) => void) => void }> = [];
      const registrar = vi.fn((_nome: string, menu: typeof menus[number]) => { menus.push(menu); });
      const corpo = document.createElement('div');
      const definirEstilo = vi.fn();
      const editor = { on: vi.fn(), ui: { registry: { addMenuButton: registrar } }, getBody: () => corpo, dom: { setStyle: definirEstilo } } as unknown as InstanciaEditor;
      estado.configuracao.setup?.(editor);
      menus[0].fetch(itens => {
        expect(itens.map(item => item.text)).toEqual(['1,25 cm', '1 cm', '1,5 cm', 'Sem recuo']);
        itens[0].onAction();
        expect(definirEstilo).toHaveBeenLastCalledWith(corpo, 'text-indent', '35.43pt');
        expect(aoRecuar).toHaveBeenLastCalledWith('35.43pt');
        itens[3].onAction();
        expect(definirEstilo).toHaveBeenLastCalledWith(corpo, 'text-indent', '0pt');
        expect(aoRecuar).toHaveBeenLastCalledWith('0pt');
      });
      expect(origem.style.textIndent).toBe('28.35pt');
    } finally { origem.remove(); }
  });

  it('usa a mesma tipografia padrão do editor principal e uma área de escrita maior', () => {
    render(<EditorCampoLaudo valor="Texto" onChange={vi.fn()} />);
    expect(estado.configuracao.content_style).toContain(ESTILO_TIPOGRAFIA_EDITOR_LAUDO);
    expect(estado.configuracao.height).toBe(320);
  });

  it('habilita o corretor nativo e registra a integração somente ao inicializar o editor', () => {
    const registrar = vi.spyOn(corretor, 'registrarCorretorEditor').mockImplementation(() => undefined);
    const alterar = vi.fn();
    render(<EditorCampoLaudo valor="O projétiu." onChange={alterar} />);
    expect(estado.configuracao.browser_spellcheck).toBe(true);
    expect(estado.configuracao.contextmenu).toBe(false);
    const aoInicializar = vi.fn();
    const recipiente = screen.getByRole('textbox').parentElement!;
    const editor = {
      on: (_evento: string, callback: () => void) => aoInicializar.mockImplementation(callback),
      ui: { registry: { addMenuButton: vi.fn() } },
      getContainer: () => recipiente,
      iframeElement: { getBoundingClientRect: () => ({ left: 120, top: 80 }) },
    } as unknown as InstanciaEditor;
    estado.configuracao.setup?.(editor);
    expect(registrar).not.toHaveBeenCalled();
    aoInicializar();
    expect(registrar).toHaveBeenCalledWith(editor, expect.any(Function));
    const encaminhar = registrar.mock.calls[0][1]!;
    const receber = vi.fn();
    recipiente.addEventListener('contextmenu', receber);
    encaminhar(new MouseEvent('contextmenu', { clientX: 20, clientY: 30 }));
    expect(receber).toHaveBeenCalledWith(expect.objectContaining({ clientX: 140, clientY: 110 }));
    expect(alterar).not.toHaveBeenCalled();
  });

  it('reproduz a fonte, o tamanho e a entrelinha efetivos do campo selecionado', () => {
    const origem = document.createElement('span');
    origem.style.fontFamily = 'Times New Roman';
    origem.style.fontSize = '18px';
    origem.style.lineHeight = '27px';
    document.body.append(origem);
    try {
      const { rerender } = render(<EditorCampoLaudo valor="Texto" elementoOrigem={origem} onChange={vi.fn()} />);
      expect(estado.configuracao.content_style).toMatch(/font-family: "?Times New Roman"?;/);
      expect(estado.configuracao.content_style).toContain('font-size: 18px;');
      expect(estado.configuracao.content_style).toContain('line-height: 27px;');
      origem.style.fontSize = '20px';
      rerender(<EditorCampoLaudo valor="Texto editado" elementoOrigem={origem} onChange={vi.fn()} />);
      expect(estado.configuracao.content_style).toContain('font-size: 18px;');
    } finally { origem.remove(); }
  });

  it('mantém o valor inicial fixo durante a digitação e usa novo valor ao reabrir', () => {
    const alterar = vi.fn();
    const { rerender, unmount } = render(<EditorCampoLaudo valor="Texto inicial" onChange={alterar} />);
    const editor = screen.getByRole('textbox', { name: 'Editor do campo' });
    const identificadorInicial = editor.id;

    fireEvent.change(editor, { target: { value: 'Texto <strong>alterado</strong>' } });
    expect(alterar).toHaveBeenCalledWith('Texto <strong>alterado</strong>');

    rerender(<EditorCampoLaudo valor="Texto <strong>alterado</strong>" onChange={alterar} />);
    expect(editor.getAttribute('data-valor-inicial')).toBe('Texto inicial');
    expect(editor.id).toBe(identificadorInicial);

    unmount();
    render(<EditorCampoLaudo valor="Outro campo" onChange={alterar} />);
    expect(screen.getByRole('textbox', { name: 'Editor do campo' }).getAttribute('data-valor-inicial')).toBe('Outro campo');
    expect(screen.getByRole('textbox').id).not.toBe(identificadorInicial);
  });
});
