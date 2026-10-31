import { useRef, useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LaudosPage } from '@/pages/LaudosPage';
import { FerramentaProjeteis } from '@/components/projeteis/FerramentaProjeteis';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAtalhoSalvarLaudo } from '@/hooks/useAtalhoSalvarLaudo';

vi.mock('@/components/ui/sidebar', () => ({ useSidebar: () => ({ setTemporariamenteRecolhida: vi.fn() }) }));
vi.mock('@/contexts/AlteracoesPendentesContext', () => ({ useSolicitarSaida: () => vi.fn(), useRegistrarAlteracoesPendentes: vi.fn() }));
vi.mock('@/components/editor/TinyMceEditor', () => ({ TinyMceEditor: () => <div>Editor de teste</div>, criarChaveMontagemEditor: () => 'editor' }));

const listar = vi.fn();
const salvar = vi.fn();
beforeEach(() => {
  const vazio = vi.fn().mockResolvedValue({ success: true, data: [] });
  const ouvir = () => vi.fn();
  salvar.mockReset();
  Object.assign(window.ipcAPI, {
    laudo: { findAll: listar, findById: vi.fn().mockResolvedValue({ success: true, data: { id: 'laudo', conteudo: '<p>Texto original</p>' } }), update: salvar,
      verificarLibreOffice: vi.fn().mockResolvedValue({ success: true, data: false }) },
    rep: { findById: vi.fn().mockResolvedValue({ success: false }) },
    categoria: { findAll: vazio }, placeholder: { findAll: vazio },
    projetil: { listarPersonalizados: vazio },
    ia: { obterContexto: vi.fn().mockResolvedValue({ success: false }), onProgresso: ouvir, onProgressoConsulta: ouvir, onPainelPronto: ouvir, onPainelComando: ouvir,
      onPainelReencaixar: ouvir, onPainelFechado: ouvir, painelFechar: vi.fn() },
  });
});

describe('projéteis na página Laudos', () => {
  it.each(['B601', 'B-602', ' b - 999 ', 'A440', undefined])('condiciona o botão à família do código %s', async codigo => {
    listar.mockResolvedValue({ success: true, data: [{ id: 'laudo', rep_id: 'rep', rep_numero: '123/2026', tipo_exame_codigo: codigo, status: 'Em andamento', data_inicio: '2026-10-28' }] });
    render(<MemoryRouter><TooltipProvider><LaudosPage /></TooltipProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar laudo da REP 123/2026' }));
    const editor = await screen.findByText('Editor de teste');
    const botao = screen.queryByRole('button', { name: 'Identificação de projéteis' });
    if (codigo?.trim().toUpperCase().startsWith('B')) {
      expect(botao).toBeInTheDocument();
      botao?.focus();
      if (!botao) throw new Error('Botão de projéteis indisponível');
      fireEvent.click(botao);
      const dialogo = await screen.findByRole('dialog', { name: 'Identificação de projéteis' });
      fireEvent.change(within(dialogo).getByLabelText('Massa (g)'), { target: { value: '8' } });
      fireEvent.keyDown(dialogo, { key: 's', ctrlKey: true });
      expect(salvar).not.toHaveBeenCalled();
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Fechar' }));
      await waitFor(() => expect(botao).toHaveFocus());
      if (!botao) throw new Error('Botão de projéteis indisponível');
      fireEvent.click(botao);
      expect(await screen.findByLabelText('Massa (g)')).toHaveValue('8');
      expect(salvar).not.toHaveBeenCalled();
      expect(screen.getByText('Editor de teste')).toBe(editor);
    } else expect(botao).not.toBeInTheDocument();
  });

  it('preserva consulta e filtros, fecha somente o diálogo interno e limpa ao trocar de sessão', async () => {
    function Sessao({ id }: { id: string }) {
      const [aberto, setAberto] = useState(false);
      const [montado, setMontado] = useState(false);
      const botao = useRef<HTMLButtonElement>(null);
      useAtalhoSalvarLaudo({ ativo: true, bloqueado: aberto, onSalvar: salvar });
      return <><button ref={botao} onClick={() => { setMontado(true); setAberto(true); }}>Consultar</button>
        {montado && <FerramentaProjeteis key={id} dialogo={{ aberto, aoAlterarAbertura: setAberto, aoFechar: () => botao.current?.focus() }} />}</>;
    }
    const { rerender } = render(<Sessao id="um" />);
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Identificação de projéteis' }), { key: 's', ctrlKey: true });
    expect(salvar).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Priorizar altura máxima' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Houve perda de material' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver catálogo completo' }));
    const catalogo = await screen.findByRole('dialog', { name: 'Catálogo completo de projéteis' });
    fireEvent.keyDown(catalogo, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Catálogo completo de projéteis' })).not.toBeInTheDocument());
    for (const [botao, titulo] of [['Consultar fontes', 'Fontes de informação'], ['Entenda o cálculo', 'Entenda o cálculo']]) {
      fireEvent.click(screen.getByRole('button', { name: botao }));
      const interno = await screen.findByRole('dialog', { name: titulo });
      fireEvent.keyDown(interno, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog', { name: titulo })).not.toBeInTheDocument());
    }
    let dialogo = screen.getByRole('dialog', { name: 'Identificação de projéteis' });
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(salvar).toHaveBeenCalledOnce();
    salvar.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
    expect(screen.getByLabelText('Massa (g)')).toHaveValue('8');
    expect(screen.getByRole('radio', { name: 'Priorizar altura máxima' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Houve perda de material' })).toBeChecked();
    rerender(<Sessao id="dois" />);
    dialogo = await screen.findByRole('dialog', { name: 'Identificação de projéteis' });
    expect(within(dialogo).getByLabelText('Massa (g)')).toHaveValue('');
    expect(within(dialogo).getByRole('radio', { name: 'Priorizar massa' })).toBeChecked();
    expect(salvar).not.toHaveBeenCalled();
  });
});
