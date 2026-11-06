import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PlaceholderContextMenu } from '@/components/editor/PlaceholderContextMenu';
import * as corretor from '@/lib/corretor-editor';
import * as preenchimento from '@/lib/menu-preenchimento-b601';
import { MenuCorretorEditor } from '@/components/editor/MenuCorretorEditor';

const apiOriginal = window.ipcAPI;

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'ipcAPI', { value: apiOriginal });
});

describe('menu exclusivo do corretor', () => {
  it.each([{ sugestoes: ['projétil'] }, { sugestoes: [] }])('mostra apenas opções ortográficas com sugestões $sugestoes', async ({ sugestoes }) => {
    vi.spyOn(corretor, 'obterContextoCorrecao').mockReturnValue({ palavra: 'projétiu', sugestoes, aplicar: vi.fn(), restaurarFoco: vi.fn() });
    vi.spyOn(preenchimento, 'obterContextoPreenchimentoB601').mockReturnValue({ quantidade: 1, disponivel: true, aplicar: vi.fn(), restaurarFoco: vi.fn() });
    render(<PlaceholderContextMenu editorId="laudo" categorias={[]} placeholders={[]} onInsertPlaceholder={vi.fn()}>
      <div>Texto do laudo</div>
    </PlaceholderContextMenu>);
    fireEvent.contextMenu(screen.getByText('Texto do laudo'));
    expect(await screen.findByText('Ortografia: projétiu')).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Adicionar ao dicionário' })).toBeVisible();
    expect(screen.queryByText('Inserir Placeholder')).not.toBeInTheDocument();
    expect(screen.queryByText('Preencher célula')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Prejudicado|REP\/Laudo/ })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: sugestoes.length ? 'projétil' : 'Sem sugestões' })).toBeVisible();
  });

  it('não abre um menu de placeholders no modal para texto sem erro reconhecido', () => {
    vi.spyOn(corretor, 'obterContextoCorrecao').mockReturnValue(null);
    render(<MenuCorretorEditor editorId="campo"><div>Texto do campo</div></MenuCorretorEditor>);
    fireEvent.contextMenu(screen.getByText('Texto do campo'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByText('Inserir Placeholder')).not.toBeInTheDocument();
  });

  it('compartilha sugestões com o modal e aplica a palavra escolhida', async () => {
    const aplicar = vi.fn(() => true);
    vi.spyOn(corretor, 'obterContextoCorrecao').mockReturnValue({ palavra: 'projétiu', sugestoes: ['projétil'], aplicar, restaurarFoco: vi.fn() });
    render(<MenuCorretorEditor editorId="campo"><div>Texto do campo</div></MenuCorretorEditor>);
    fireEvent.contextMenu(screen.getByText('Texto do campo'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'projétil' }));
    expect(aplicar).toHaveBeenCalledWith('projétil');
    expect(screen.queryByText('Inserir Placeholder')).not.toBeInTheDocument();
  });

  it('desabilita as opções abertas no modal quando a preferência muda', async () => {
    const aplicar = vi.fn();
    vi.spyOn(corretor, 'obterContextoCorrecao').mockReturnValue({ palavra: 'projétiu', sugestoes: ['projétil'], aplicar, restaurarFoco: vi.fn() });
    render(<MenuCorretorEditor editorId="campo"><div>Texto do campo</div></MenuCorretorEditor>);
    fireEvent.contextMenu(screen.getByText('Texto do campo'));
    const sugestao = await screen.findByRole('menuitem', { name: 'projétil' });
    act(() => corretor.notificarEstadoCorretor({ ativo: false, disponivel: true, palavras: [] }));
    expect(sugestao).toHaveAttribute('data-disabled');
    expect(screen.getByRole('menuitem', { name: 'Adicionar ao dicionário' })).toHaveAttribute('data-disabled');
    expect(screen.getByRole('alert')).toHaveTextContent('As opções do corretor mudaram');
    fireEvent.click(sugestao);
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('adiciona a palavra pelo mesmo dicionário e notifica os editores', async () => {
    const adicionar = vi.fn().mockResolvedValue({ success: true, data: { ativo: true, disponivel: true, palavras: ['projétiu'] } });
    Object.defineProperty(window, 'ipcAPI', { value: { corretor: { adicionar } } });
    const notificar = vi.spyOn(corretor, 'notificarEstadoCorretor');
    vi.spyOn(corretor, 'obterContextoCorrecao').mockReturnValue({ palavra: 'projétiu', sugestoes: [], aplicar: vi.fn(), restaurarFoco: vi.fn() });
    render(<MenuCorretorEditor editorId="campo"><div>Texto do campo</div></MenuCorretorEditor>);
    fireEvent.contextMenu(screen.getByText('Texto do campo'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Adicionar ao dicionário' }));
    expect(adicionar).toHaveBeenCalledWith('projétiu');
    await vi.waitFor(() => expect(notificar).toHaveBeenCalledWith({ ativo: true, disponivel: true, palavras: ['projétiu'] }));
  });

  it('mantém o menu aberto e informa a falha quando o texto ficou desatualizado', async () => {
    const obter = vi.spyOn(corretor, 'obterContextoCorrecao').mockReturnValue({ palavra: 'projétiu', sugestoes: ['projétil'], aplicar: vi.fn(() => false), restaurarFoco: vi.fn() });
    render(<MenuCorretorEditor editorId="campo"><div>Texto do campo</div></MenuCorretorEditor>);
    fireEvent.contextMenu(screen.getByText('Texto do campo'));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'projétil' }));
    expect(screen.getByRole('alert')).toHaveTextContent('O texto mudou ou está protegido');
    obter.mockReturnValue({ palavra: 'projétiu', sugestoes: ['projétil'], aplicar: vi.fn(() => true), restaurarFoco: vi.fn() });
    fireEvent.contextMenu(screen.getByText('Texto do campo'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
