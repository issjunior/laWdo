import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjeteisPage } from '@/pages/ProjeteisPage';

const ipcOriginal = window.ipcAPI;

function preencherMedidas(diametro: string, altura: string, massa: string) {
  fireEvent.change(screen.getByLabelText('Calibre real médio (mm)'), { target: { value: diametro } });
  fireEvent.change(screen.getByLabelText('Altura máxima (mm)'), { target: { value: altura } });
  fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: massa } });
}

function primeiroCartao() {
  const cartao = screen.getByRole('img', { name: 'Posição 1 na ordem das referências' }).parentElement;
  if (!cartao) throw new Error('Cartão da primeira posição ausente.');
  return within(cartao);
}

describe('página de projéteis com catálogo real', () => {
  it('mostra .38 SPL SEPO com duas medidas próximas para 9 / 16,03 e massa vazia', () => {
    render(<ProjeteisPage />);
    preencherMedidas('9', '16,03', '');
    const primeiro = primeiroCartao();
    expect(primeiro.getByRole('heading', { name: '.38 SPL' })).toBeInTheDocument();
    expect(primeiro.getByRole('button', { name: /^SEPO:/ })).toBeInTheDocument();
    expect(primeiro.getByText('2 de 2 medidas próximas')).toBeInTheDocument();
  });
  beforeEach(() => {
    Object.defineProperty(window, 'ipcAPI', { value: {
      ...ipcOriginal,
      projetil: { listarPersonalizados: vi.fn().mockResolvedValue({ success: true, data: [] }) },
    }, writable: true });
  });

  afterAll(() => { Object.defineProperty(window, 'ipcAPI', { value: ipcOriginal, writable: true }); });

  it('mostra .38 Curto CHOG em primeiro usando decimais com vírgula e as três medidas', () => {
    render(<ProjeteisPage />);
    preencherMedidas('9', '17,39', '5,7');
    const primeiro = primeiroCartao();
    expect(primeiro.getByRole('heading', { name: '.38 Curto' })).toBeInTheDocument();
    expect(primeiro.getByRole('button', { name: 'CHOG: Chumbo nu ogival' })).toBeInTheDocument();
    expect(primeiro.getByText('-0,002 g (-0,04%)')).toBeInTheDocument();
    expect(primeiro.queryByText(/Comparação parcial/)).not.toBeInTheDocument();
  });

  it('mostra o balote em primeiro e permite consultar a ressalva mantendo 24,8 g', () => {
    render(<ProjeteisPage />);
    preencherMedidas('17,5', '', '24,8');
    const primeiro = primeiroCartao();
    expect(primeiro.getByRole('heading', { name: '12 (balote)' })).toBeInTheDocument();
    expect(within(primeiro.getByRole('group', { name: 'Medida: Massa' })).getByText('0 g (0,00%) · Mesmo valor')).toBeInTheDocument();
    expect(within(primeiro.getByRole('group', { name: 'Medida: Calibre real médio' })).getByText('0 mm (0,00%) · Mesmo valor')).toBeInTheDocument();
    const ressalva = primeiro.getByText(/A fonte publica 390 grains e 24,8 g/);
    expect(ressalva.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(primeiro.getByText('Detalhes da referência'));
    expect(ressalva.closest('details')).toHaveAttribute('open');
    expect(ressalva).toBeVisible();
    expect(screen.getByLabelText('Massa (g)')).toHaveValue('24,8');
  });

  it.each([
    ['.223 Rem', '5,56', '5,68', '19,65', 'altura de 5,68 mm e massa total de 19,65 g'],
    ['.44 Magnum', '11,4', '', '15,5', 'Diâmetro de 11,4 mm'],
  ])('mantém a ressalva de %s nos detalhes sem impedir a classificação', (calibre, diametro, altura, massa, trecho) => {
    render(<ProjeteisPage />);
    preencherMedidas(diametro, altura, massa);
    const primeiro = primeiroCartao();
    expect(primeiro.getByRole('heading', { name: calibre })).toBeInTheDocument();
    const ressalva = primeiro.getByText(texto => texto.includes(trecho));
    expect(ressalva.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(primeiro.getByText('Detalhes da referência'));
    expect(ressalva).toBeVisible();
  });
});
