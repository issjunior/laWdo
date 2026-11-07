import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeletorTabelaLaudo } from '@/components/editor/SeletorTabelaLaudo';
import type { SessaoSeletorTabela } from '@/lib/seletores-tabela-laudo';

function criarSessao(aceitaTextoLivre = true): SessaoSeletorTabela {
  return {
    id: 'seletor-aderencias', valor: 'Caliça', textoApresentado: 'Caliça', rotulo: 'Aderências de PQ01',
    aceitaTextoLivre, digitar: vi.fn(), opcoes: [{ valor: 'Caliça', texto: 'Caliça', desabilitada: false }],
    escolher: vi.fn(), fechar: vi.fn(), concluirFechamento: vi.fn(),
  };
}

describe('combobox externo das tabelas do laudo', () => {
  it.each([
    { letra: 'a', esperado: 'Ausente' },
    { letra: 'p', esperado: 'Prejudicado' },
  ])('encaminha Ctrl+Shift+$letra ao preenchimento rápido', ({ letra, esperado }) => {
    const sessao = criarSessao();
    render(<SeletorTabelaLaudo sessao={sessao} />);
    const entrada = screen.getByRole('combobox', { name: 'Aderências de PQ01' });

    expect(fireEvent.keyDown(entrada, { key: letra, ctrlKey: true, shiftKey: true })).toBe(false);
    expect(sessao.escolher).toHaveBeenCalledOnce();
    expect(sessao.escolher).toHaveBeenCalledWith(esperado);
  });

  it('preserva o atalho em seletor que não aceita texto livre', () => {
    const sessao = criarSessao(false);
    render(<SeletorTabelaLaudo sessao={sessao} />);
    const entrada = screen.getByRole('combobox', { name: 'Aderências de PQ01' });

    expect(fireEvent.keyDown(entrada, { key: 'a', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(sessao.escolher).not.toHaveBeenCalled();
  });
});
