import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportarBkpLaudo } from '@/components/laudo/ImportarBkpLaudo';

const analisarBkp = vi.fn();
const importarBkp = vi.fn();
const cancelarBkp = vi.fn(async () => ({ success: true }));
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(window.ipcAPI, { laudo: {
    selecionarBkp: vi.fn(async () => ({ success: true, data: { selecaoId: 'selecao', nomeArquivo: 'teste.bkp' } })),
    analisarBkp, importarBkp, cancelarBkp,
  } });
  analisarBkp.mockResolvedValue({ success: true, data: { operacaoId: 'operacao', previa: {
    numeroRep: '1/2026', tipoExame: 'B-601', status: 'Entregue', figuras: 2, substituiRep: true, substituiLaudo: true,
  } } });
});

describe('importação de BKP na página de laudos', () => {
  it('exige confirmação explícita antes de substituir o caso e recarrega a lista após sucesso', async () => {
    importarBkp.mockResolvedValue({ success: true, data: { laudoId: 'novo' } });
    const aoImportar = vi.fn(async () => undefined);
    render(<ImportarBkpLaudo onImportado={aoImportar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Importar BKP' }));
    expect(await screen.findByText('1/2026')).toBeInTheDocument();
    const confirmar = screen.getByRole('button', { name: 'Importar laudo' });
    expect(confirmar).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirmar).not.toBeDisabled();
    fireEvent.click(confirmar);
    await waitFor(() => expect(importarBkp).toHaveBeenCalledWith('operacao', true));
    await waitFor(() => expect(aoImportar).toHaveBeenCalledWith('novo'));
  });

  it('mostra o bloqueio sem oferecer uma importação possível e cancela a prévia', async () => {
    analisarBkp.mockResolvedValue({ success: true, data: { operacaoId: 'bloqueada', previa: {
      numeroRep: '1/2026', tipoExame: 'B-601', status: 'Entregue', figuras: 0, substituiRep: true, substituiLaudo: true,
      bloqueio: 'A REP possui vários laudos.',
    } } });
    render(<ImportarBkpLaudo onImportado={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Importar BKP' }));
    expect(await screen.findByText('A REP possui vários laudos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importar laudo' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(cancelarBkp).toHaveBeenCalledWith('bloqueada'));
    expect(importarBkp).not.toHaveBeenCalled();
  });

  it('mostra falhas da análise e permite selecionar outro arquivo', async () => {
    analisarBkp.mockResolvedValue({ success: false, error: 'BKP corrompido.' });
    render(<ImportarBkpLaudo onImportado={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Importar BKP' }));
    expect(await screen.findByText('BKP corrompido.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Selecionar arquivo' })).not.toBeDisabled();
    expect(importarBkp).not.toHaveBeenCalled();
  });
});
