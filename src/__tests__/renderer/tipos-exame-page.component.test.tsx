import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TiposExamePage } from '@/pages/TiposExamePage';
import type { TipoExame } from '@/lib/validators/tipo-exame.schema';

vi.mock('@/components/data-table/data-table', () => ({
  DataTable: ({ data }: { data: TipoExame[] }) => <div>{data.map(tipo => <span key={tipo.id}>{tipo.nome}</span>)}</div>,
}));

const ipcApiOriginal = window.ipcAPI;
const ativo: TipoExame = {
  id: 'ativo', codigo: 'A-001', nome: 'Exame ativo', ativo: true,
  data_criacao: new Date(), data_atualizacao: new Date(),
};
const inativo: TipoExame = {
  id: 'inativo', codigo: 'A-002', nome: 'Exame inativo', ativo: false,
  data_criacao: new Date(), data_atualizacao: new Date(),
};
const buscarAtivos = vi.fn(async () => ({ success: true, data: [ativo] }));
const buscarTodos = vi.fn(async () => ({ success: true, data: [ativo, inativo] }));

describe('TiposExamePage', () => {
  beforeEach(() => {
    buscarAtivos.mockReset();
    buscarTodos.mockReset();
    buscarAtivos.mockResolvedValue({ success: true, data: [ativo] });
    buscarTodos.mockResolvedValue({ success: true, data: [ativo, inativo] });
    Object.defineProperty(window, 'ipcAPI', {
      value: {
        ...ipcApiOriginal,
        tipoExame: {
          ...ipcApiOriginal.tipoExame,
          findAll: buscarAtivos,
          findAllSemFiltroStatus: buscarTodos,
        },
      },
      writable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'ipcAPI', { value: ipcApiOriginal, writable: true });
  });

  it('consulta uma vez a lista exibida e uma vez os totais ao abrir', async () => {
    render(<TiposExamePage />);
    await screen.findByText('Exame ativo');
    expect(screen.queryByText('Exame inativo')).not.toBeInTheDocument();
    expect(buscarAtivos).toHaveBeenCalledTimes(1);
    expect(buscarTodos).toHaveBeenCalledTimes(1);
  });

  it('ignora a lista atrasada de um filtro anterior', async () => {
    let concluirTodos: ((resultado: { success: boolean; data: TipoExame[] }) => void) | undefined;
    buscarTodos.mockResolvedValueOnce({ success: true, data: [ativo, inativo] });
    buscarTodos.mockImplementationOnce(() => new Promise(resolve => { concluirTodos = resolve; }));
    render(<TiposExamePage />);
    await screen.findByText('Exame ativo');
    await waitFor(() => expect(screen.getByRole('button', { name: /Mostrar todos/ })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: /Mostrar todos/ }));
    await waitFor(() => expect(concluirTodos).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar inativos' }));
    await waitFor(() => expect(buscarAtivos).toHaveBeenCalledTimes(2));
    concluirTodos?.({ success: true, data: [ativo, inativo] });

    await waitFor(() => expect(screen.getByText('Exame ativo')).toBeInTheDocument());
    expect(screen.queryByText('Exame inativo')).not.toBeInTheDocument();
  });

  it('mostra totais indisponíveis após falha e permite nova tentativa', async () => {
    buscarTodos.mockRejectedValueOnce(new Error('Falha dos totais'));
    render(<TiposExamePage />);

    expect(await screen.findByText('Totais indisponíveis: Falha dos totais')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
    expect(screen.queryByText('Totais indisponíveis: Falha dos totais')).not.toBeInTheDocument();
  });

  it('oferece nova tentativa quando a lista falha', async () => {
    buscarAtivos.mockRejectedValueOnce(new Error('Falha da lista'));
    render(<TiposExamePage />);

    expect(await screen.findByText('Falha da lista')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Exame ativo')).toBeInTheDocument();
  });
});
