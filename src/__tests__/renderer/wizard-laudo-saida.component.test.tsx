import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router';
import { AlteracoesPendentesProvider } from '@/contexts/AlteracoesPendentesContext';
import WizardLaudoPage from '@/pages/WizardLaudoPage';

describe('saída do assistente de laudo', () => {
  it('salva respostas parciais e as restaura ao reabrir', async () => {
    let respostasPersistidas = '{}';
    const salvarProgressoWizard = vi.fn(async (_id: string, respostas: Record<string, string | string[]>) => {
      respostasPersistidas = JSON.stringify(respostas);
      return { success: true };
    });
    Object.assign(window.ipcAPI, {
      protegerFechamento: vi.fn(),
      onSolicitarFechamento: vi.fn(() => () => undefined),
      confirmarFechamento: vi.fn(async () => undefined),
      cancelarFechamento: vi.fn(async () => undefined),
      laudo: {
        findById: vi.fn(async () => ({ success: true, data: {
          id: 'laudo-1', rep_id: 'rep-1', template_id: 'template-1', wizard_id: 'wizard-1',
          rep_numero: '1/2026', status: 'Em andamento', respostas_wizard: respostasPersistidas,
        } })),
        getRespostasWizard: vi.fn(async () => ({ success: true, data: {} })),
        salvarProgressoWizard,
        gerarWizard: vi.fn(),
        calcularPecasWizard: vi.fn(async () => ({ success: true, data: [] })),
        contextoWizard: vi.fn(async () => ({ success: true, data: {
          wizard: { id: 'wizard-1', nome: 'Teste' },
          etapas: [{ id: 'etapa-1', pergunta: 'Pergunta parcial', tipo_input: 'radio', nivel: 0,
            ordem: 0, obrigatorio: false, multipla_escolha: false,
            opcoes: [{ id: 'sim', label: 'Sim', valor: 'sim', ordem: 0 }],
          }],
        } })),
      },
      rep: { findById: vi.fn(async () => ({ success: true, data: { tipo_exame_id: 'tipo-1' } })) },
      regraWizard: { calcularPecas: vi.fn(async () => ({ success: true, data: [] })) },
    });

    const roteador = createMemoryRouter([
      { element: <AlteracoesPendentesProvider><Outlet /></AlteracoesPendentesProvider>, children: [
        { path: '/laudos/:laudoId/wizard', element: <WizardLaudoPage /> },
        { path: '/laudos', element: <span>Lista de laudos</span> },
      ] },
    ], { initialEntries: ['/laudos/laudo-1/wizard'] });
    render(<RouterProvider router={roteador} />);
    expect(await screen.findByText('Pergunta parcial')).toBeInTheDocument();
    fireEvent.click(await screen.findByLabelText('Sim'));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar e sair' }));
    await waitFor(() => expect(roteador.state.location.pathname).toBe('/laudos'));
    expect(salvarProgressoWizard).toHaveBeenCalledWith('laudo-1', { 'etapa-1': 'sim' });
    expect(window.ipcAPI.laudo.gerarWizard).not.toHaveBeenCalled();

    await roteador.navigate('/laudos/laudo-1/wizard');
    expect(await screen.findByLabelText('Sim')).toBeChecked();
  });
});
