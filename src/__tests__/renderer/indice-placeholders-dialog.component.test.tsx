import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IndicePlaceholdersDialog } from '@/components/laudo/IndicePlaceholdersDialog';

describe('IndicePlaceholdersDialog', () => {
  const itens = [
    {
      chave: 'perito_nome',
      campoFormulario: 'Nome do perito',
      valor: 'Izaias Santos de Souza Júnior',
      preenchido: true,
    },
    {
      chave: 'itens',
      campoFormulario: 'Itens examinados',
      valor: '',
      preenchido: true,
      tabela: {
        linhas: [
          [{ valor: 'Linha 1', alinhamento: 'left' as const }],
          [{ valor: 'Linha 2', alinhamento: 'left' as const }],
          [{ valor: 'Linha 3', alinhamento: 'left' as const }],
          [{ valor: 'Linha 4', alinhamento: 'left' as const }],
          [{ valor: 'Linha 5', alinhamento: 'left' as const }],
        ],
      },
    },
  ];

  it('filtra os placeholders e amplia a tabela com seu conteúdo completo', () => {
    render(<IndicePlaceholdersDialog open onOpenChange={vi.fn()} itens={itens} />);

    expect(screen.getByRole('heading', { name: 'Índice de placeholders' })).toBeInTheDocument();
    expect(screen.getByText('{{perito_nome}}')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por campo, placeholder ou valor...'), {
      target: { value: 'itens examinados' },
    });

    expect(screen.queryByText('{{perito_nome}}')).not.toBeInTheDocument();
    expect(screen.getByText('{{itens}}')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir tabela em tamanho ampliado' }));

    expect(screen.getByText('Linha 5')).toBeInTheDocument();
  });

  it('mostra o estado vazio quando a busca não encontra nenhum placeholder', () => {
    render(<IndicePlaceholdersDialog open onOpenChange={vi.fn()} itens={itens} />);

    fireEvent.change(screen.getByPlaceholderText('Buscar por campo, placeholder ou valor...'), {
      target: { value: 'sem resultado' },
    });

    expect(screen.getByText('Nenhum placeholder encontrado.')).toBeInTheDocument();
  });
});
