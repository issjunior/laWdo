import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjeteisPage } from '@/pages/ProjeteisPage';
import type { ProjetilReferencia } from '@shared/types/projetil.types';

vi.mock('@shared/catalogos/projeteis.catalogo', () => ({
  catalogoProjeteis: Array.from({ length: 13 }, (_, indice) => ({
    id: `projetil-${indice + 1}`, calibre: `CAL-${String(indice + 1).padStart(2, '0')}`,
    tipo: 'Encamisado total ogival', sigla: 'ETOG', massaGramas: 8 + indice / 10,
    calibreRealMinMm: 9, calibreRealMaxMm: 9.02, alturaMinMm: indice === 12 ? null : 15.4, alturaMaxMm: indice === 12 ? null : 15.4,
    situacao: 'estimada', fonte: 'tabela.pdf', localizacao: `linha ${indice + 1}`,
  })),
}));

const ipcOriginal = window.ipcAPI;
const rolagemOriginal = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');

describe('página de projéteis', () => {
  it('seleciona um formato existente pela descrição e salva sua sigla no contrato atual', async () => {
    window.ipcAPI.projetil.salvarPersonalizado = vi.fn().mockResolvedValue({ success: true });
    render(<ProjeteisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver catálogo completo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo personalizado' }));
    const dialogo = screen.getByRole('dialog', { name: 'Novo projétil personalizado' });
    expect(within(dialogo).queryByLabelText('Tipo')).not.toBeInTheDocument();
    fireEvent.change(within(dialogo).getByLabelText('Calibre nominal'), { target: { value: '.38 Teste' } });
    fireEvent.change(within(dialogo).getByLabelText('Calibre real médio (mm)'), { target: { value: '9' } });
    fireEvent.change(within(dialogo).getByLabelText('Massa (g)'), { target: { value: '8,03' } });
    const seletor = within(dialogo).getByRole('combobox', { name: 'Formato/Constituição' });
    fireEvent.click(seletor);
    fireEvent.change(screen.getByRole('combobox', { name: 'Pesquisar ou cadastrar formato' }), { target: { value: 'encamisado total ogival' } });
    expect(screen.queryByRole('option', { name: /^Cadastrar/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'ETOG — Encamisado total ogival' }));
    await waitFor(() => expect(seletor).toHaveFocus());
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(window.ipcAPI.projetil.salvarPersonalizado).toHaveBeenCalledWith({ calibre: '.38 Teste', tipo: 'ETOG', calibreRealMm: 9, alturaMaximaMm: null, massaGramas: 8.03 }, undefined));
  });

  it('cadastra um formato novo e o oferece novamente após salvar o projétil', async () => {
    const referencia: ProjetilReferencia = { id: 'novo-formato', calibre: '.99 Teste', tipo: 'Formato artesanal', sigla: null,
      massaGramas: 8, calibreRealMinMm: 9, calibreRealMaxMm: 9, alturaMinMm: null, alturaMaxMm: null,
      situacao: 'personalizada', fonte: 'Cadastro local', localizacao: 'Neste computador' };
    window.ipcAPI.projetil.salvarPersonalizado = vi.fn().mockImplementation(async () => {
      vi.mocked(window.ipcAPI.projetil.listarPersonalizados).mockResolvedValue({ success: true, data: [referencia] });
      return { success: true, data: referencia };
    });
    render(<ProjeteisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver catálogo completo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo personalizado' }));
    let dialogo = screen.getByRole('dialog', { name: 'Novo projétil personalizado' });
    fireEvent.change(within(dialogo).getByLabelText('Calibre nominal'), { target: { value: '.99 Teste' } });
    fireEvent.change(within(dialogo).getByLabelText('Calibre real médio (mm)'), { target: { value: '9' } });
    fireEvent.change(within(dialogo).getByLabelText('Massa (g)'), { target: { value: '8' } });
    fireEvent.click(within(dialogo).getByRole('combobox', { name: 'Formato/Constituição' }));
    const busca = screen.getByRole('combobox', { name: 'Pesquisar ou cadastrar formato' });
    expect(busca).toHaveAttribute('maxlength', '120');
    expect(screen.queryByRole('option', { name: /^Cadastrar/ })).not.toBeInTheDocument();
    fireEvent.change(busca, { target: { value: ' Formato artesanal ' } });
    fireEvent.keyDown(busca, { key: 'ArrowDown' });
    fireEvent.keyDown(busca, { key: 'Enter' });
    expect(within(dialogo).getByRole('combobox', { name: 'Formato/Constituição' })).toHaveTextContent('Formato artesanal');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(window.ipcAPI.projetil.salvarPersonalizado).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'Formato artesanal' }), undefined));
    await screen.findByRole('dialog', { name: 'Catálogo completo de projéteis' });
    fireEvent.click(screen.getByRole('button', { name: 'Novo personalizado' }));
    dialogo = screen.getByRole('dialog', { name: 'Novo projétil personalizado' });
    fireEvent.click(within(dialogo).getByRole('combobox', { name: 'Formato/Constituição' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Pesquisar ou cadastrar formato' }), { target: { value: 'FORMATO ARTESANAL' } });
    expect(screen.getByRole('option', { name: 'Formato artesanal' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^Cadastrar/ })).not.toBeInTheDocument();
  });

  it('preserva o formato livre de cadastros antigos na edição e fecha só o seletor com Escape', async () => {
    vi.mocked(window.ipcAPI.projetil.listarPersonalizados).mockResolvedValue({ success: true, data: [{
      id: 'antigo', calibre: '.99 Antigo', tipo: 'Tipo livre anterior', sigla: null, massaGramas: 8,
      calibreRealMinMm: 9, calibreRealMaxMm: 9, alturaMinMm: null, alturaMaxMm: null,
      situacao: 'personalizada', fonte: 'Cadastro local', localizacao: 'Neste computador',
    }] });
    window.ipcAPI.projetil.salvarPersonalizado = vi.fn().mockResolvedValue({ success: true });
    render(<ProjeteisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver catálogo completo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Editar .99 Antigo' }));
    const dialogo = screen.getByRole('dialog', { name: 'Editar projétil personalizado' });
    const seletor = within(dialogo).getByRole('combobox', { name: 'Formato/Constituição' });
    expect(seletor).toHaveTextContent('Tipo livre anterior');
    expect(within(dialogo).getByLabelText('Calibre nominal')).toHaveValue('.99 Antigo');
    fireEvent.click(seletor);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Pesquisar ou cadastrar formato' }), { key: 'Escape' });
    await waitFor(() => expect(seletor).toHaveFocus());
    expect(dialogo).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(window.ipcAPI.projetil.salvarPersonalizado).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'Tipo livre anterior', calibre: '.99 Antigo' }), 'antigo'));
  });
  it('agrupa formato e proximidade abaixo das medidas e apresenta a ajuda renomeada', () => {
    render(<ProjeteisPage />);
    const ajustes = screen.getByRole('group', { name: 'Ajustes da comparação' });
    expect(within(ajustes).getByRole('combobox', { name: 'Formato/Constituição' })).toBeInTheDocument();
    expect(within(ajustes).getByRole('button', { name: 'Proximidade: 5,00%' })).toBeInTheDocument();
    expect(within(ajustes).getByRole('status')).toHaveTextContent('Prioridade: Massa');
    const medidas = screen.getByRole('group', { name: 'Medida prioritária para classificação' });
    expect(within(medidas).getAllByRole('textbox')).toHaveLength(3);
    expect(within(medidas).getByRole('checkbox', { name: 'Houve perda de material' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Entenda o cálculo' }));
    const ajuda = screen.getByRole('dialog', { name: 'Entenda o cálculo' });
    expect(within(ajuda).getByText('Ajuste a comparação.')).toBeInTheDocument();
    expect(within(ajuda).getByText(/clique no percentual para ajustar o limite/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Como usar e calcular' })).not.toBeInTheDocument();
  });
  it('atualiza limite, contagem e verde juntos e permite ajustar pelo teclado', () => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8,03' } });
    fireEvent.change(screen.getByLabelText('Calibre real médio (mm)'), { target: { value: '9,6' } });
    expect(screen.getAllByText('1 de 2 medidas próximas')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Proximidade: 5,00%' }));
    fireEvent.change(screen.getByLabelText('Limite de proximidade (%)'), { target: { value: '10,00' } });
    expect(screen.getByRole('button', { name: 'Proximidade: 10,00%' })).toBeInTheDocument();
    expect(screen.getAllByText('2 de 2 medidas próximas')).toHaveLength(3);
    expect(screen.getAllByRole('group', { name: 'Medida: Calibre real médio' }).every(elemento => elemento.classList.contains('bg-emerald-500/10'))).toBe(true);
    const slider = screen.getByRole('slider', { name: 'Ajustar limite de proximidade' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Proximidade: 10,01%' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Limite de proximidade (%)'), { target: { value: '0' } });
    expect(screen.getAllByText('0 de 2 medidas próximas')).toHaveLength(3);
    expect(screen.getAllByRole('group', { name: 'Medida: Massa' }).every(elemento => !elemento.classList.contains('bg-emerald-500/10'))).toBe(true);
  });

  it('mantém o último limite válido para entradas inválidas e restaura o padrão', () => {
    render(<ProjeteisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Proximidade: 5,00%' }));
    const entrada = screen.getByLabelText('Limite de proximidade (%)');
    fireEvent.change(entrada, { target: { value: '2.50' } });
    for (const texto of ['', '-1', '100,01', 'NaN', '2,555', 'abc']) {
      fireEvent.change(entrada, { target: { value: texto } });
      expect(entrada).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('O último limite válido continua aplicado');
      expect(screen.getByRole('button', { name: 'Proximidade: 2,50%' })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar 5%' }));
    expect(entrada).toHaveValue('5,00');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.change(entrada, { target: { value: '100' } });
    expect(screen.getByRole('button', { name: 'Proximidade: 100,00%' })).toBeInTheDocument();
    fireEvent.keyDown(entrada, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Limpar resultados' }));
    expect(screen.getByRole('button', { name: 'Proximidade: 5,00%' })).toBeInTheDocument();
  });

  it('preserva o limite ao consultar fontes e a ajuda e não o persiste ao sair da página', () => {
    const pagina = render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8,03' } });
    fireEvent.click(screen.getByRole('button', { name: 'Proximidade: 5,00%' }));
    fireEvent.change(screen.getByLabelText('Limite de proximidade (%)'), { target: { value: '7,25' } });
    fireEvent.keyDown(screen.getByLabelText('Limite de proximidade (%)'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar fontes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Perfis de Projéteis — Eliane Baruch' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Entenda o cálculo' }));
    expect(screen.getByText('Verde: até 7,25% da referência')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Proximidade: 7,25%' })).toBeInTheDocument();
    expect(screen.getByLabelText('Massa (g)')).toHaveValue('8,03');
    pagina.unmount();
    render(<ProjeteisPage />);
    expect(screen.getByRole('button', { name: 'Proximidade: 5,00%' })).toBeInTheDocument();
  });

  it('explica perda de material por foco e fecha com Escape sem alterar o checkbox', async () => {
    render(<ProjeteisPage />);
    const checkbox = screen.getByRole('checkbox', { name: 'Houve perda de material' });
    expect(checkbox).toHaveAccessibleDescription('Marque se parte do projétil foi perdida. A massa será usada como limite inferior e não contará na proximidade.');
    const ajuda = screen.getByRole('button', { name: 'Sobre perda de material' });
    fireEvent.focus(ajuda);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('A massa será usada como limite inferior');
    fireEvent.keyDown(ajuda, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    fireEvent.click(ajuda);
    expect(checkbox).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8,03' } });
    fireEvent.change(screen.getByLabelText('Calibre real médio (mm)'), { target: { value: '9' } });
    fireEvent.click(checkbox);
    expect(screen.getAllByText('1 de 1 medida próxima')).toHaveLength(3);
    expect(screen.getAllByText('Massa usada como limite inferior')).toHaveLength(3);
  });

  it('abre a explicação de perda de material ao passar o ponteiro', async () => {
    render(<ProjeteisPage />);
    const ajuda = screen.getByRole('button', { name: 'Sobre perda de material' });
    const movimento = new MouseEvent('pointermove', { bubbles: true });
    Object.defineProperty(movimento, 'pointerType', { value: 'mouse' });
    fireEvent(ajuda, movimento);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Marque se parte do projétil foi perdida');
    expect(screen.getByRole('checkbox', { name: 'Houve perda de material' })).not.toBeChecked();
  });

  beforeEach(() => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', { value: vi.fn(), configurable: true });
    Object.defineProperty(window, 'ipcAPI', { value: {
      ...ipcOriginal,
      projetil: { listarPersonalizados: vi.fn().mockResolvedValue({ success: true, data: [] }) },
    }, writable: true });
  });

  afterAll(() => {
    Object.defineProperty(window, 'ipcAPI', { value: ipcOriginal, writable: true });
    if (rolagemOriginal) Object.defineProperty(Element.prototype, 'scrollIntoView', rolagemOriginal);
    else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  it('mostra três resultados, expande até dez e explica a sigla', async () => {
    render(<ProjeteisPage />);
    await waitFor(() => expect(window.ipcAPI.projetil.listarPersonalizados).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8,0' } });
    expect(screen.getAllByLabelText(/^Posição /)).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /ETOG: Encamisado total ogival/ })).toHaveLength(3);
    const principais = screen.getByRole('group', { name: 'Primeiras referências' });
    const posicoesPrincipais = within(principais).getAllByRole('img', { name: /^Posição / });
    expect(posicoesPrincipais.map(posicao => posicao.getAttribute('aria-label'))).toEqual([
      'Posição 1 na ordem das referências', 'Posição 2 na ordem das referências', 'Posição 3 na ordem das referências',
    ]);
    expect(screen.queryByRole('group', { name: 'Referências adicionais' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Mostrar mais opções/ }));
    expect(screen.getAllByLabelText(/^Posição /)).toHaveLength(10);
    expect(screen.getByText('CAL-10')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Primeiras referências' })).toBe(principais);
    expect(within(principais).getAllByRole('img', { name: /^Posição / })).toEqual(posicoesPrincipais);
    const adicionais = screen.getByRole('group', { name: 'Referências adicionais' });
    expect(within(adicionais).getAllByRole('img', { name: /^Posição / }).map(posicao => posicao.getAttribute('aria-label'))).toEqual(
      Array.from({ length: 7 }, (_, indice) => `Posição ${indice + 4} na ordem das referências`),
    );
    for (const posicao of posicoesPrincipais) {
      const cartao = posicao.parentElement;
      if (!cartao) throw new Error('Cartão principal ausente.');
      expect(within(cartao).getAllByRole('group', { name: /^Medida:/ }).map(medida => medida.getAttribute('aria-label'))).toEqual([
        'Medida: Calibre real médio', 'Medida: Altura máxima', 'Medida: Massa',
      ]);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar menos' }));
    expect(screen.queryByRole('group', { name: 'Referências adicionais' })).not.toBeInTheDocument();
    expect(within(principais).getAllByRole('img', { name: /^Posição / })).toEqual(posicoesPrincipais);
  });

  it.each([1, 2])('mostra somente %s referências principais quando o filtro restringe o resultado', async quantidade => {
    vi.mocked(window.ipcAPI.projetil.listarPersonalizados).mockResolvedValueOnce({ success: true, data:
      Array.from({ length: quantidade }, (_, indice) => ({
        id: `local-${indice}`, calibre: `Local ${indice}`, tipo: 'NTA', sigla: 'NTA', massaGramas: 8,
        calibreRealMinMm: 9, calibreRealMaxMm: 9, alturaMinMm: 15, alturaMaxMm: 15,
        situacao: 'personalizada' as const, fonte: 'Local', localizacao: 'Local',
      })),
    });
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8' } });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Formato/Constituição' }), { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: /^NTA —/ }));
    expect(within(screen.getByRole('group', { name: 'Primeiras referências' })).getAllByRole('img', { name: /^Posição / })).toHaveLength(quantidade);
    expect(screen.queryByRole('group', { name: 'Referências adicionais' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mostrar mais opções/ })).not.toBeInTheDocument();
  });

  it('filtra o catálogo por calibre nominal', () => {
    render(<ProjeteisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver catálogo completo' }));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText('13 variantes encontradas')).toBeInTheDocument();
    fireEvent.change(within(dialogo).getByLabelText('Calibre nominal'), { target: { value: 'CAL-12' } });
    expect(within(dialogo).getByText('1 variante encontrada')).toBeInTheDocument();
    expect(within(dialogo).getByText('CAL-12')).toBeInTheDocument();
  });

  it('abre a tabela visual sem apagar a medida da consulta', () => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Calibre real médio (mm)'), { target: { value: '9,01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar fontes' }));
    expect(screen.getByTitle(/^Fonte:/)).toHaveAttribute('src', expect.stringContaining('tabela-calibres-balistica-forense.pdf'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByLabelText('Calibre real médio (mm)')).toHaveValue('9,01');
  });
  it('seleciona massa por padrão e mantém uma única prioridade com rótulos acessíveis', () => {
    render(<ProjeteisPage />);
    expect(screen.queryByLabelText('Estado do projétil')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Priorizar massa' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Priorizar calibre real médio' }));
    expect(screen.getByRole('radio', { name: 'Priorizar calibre real médio' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Priorizar massa' })).not.toBeChecked();
    expect(screen.getAllByRole('radio').filter(item => (item as HTMLInputElement).checked)).toHaveLength(1);
    expect(screen.getByText('Prioridade sem valor')).toBeInTheDocument();
  });

  it('a perda de material com apenas massa não sugere proximidade', () => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8,0' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Houve perda de material' }));
    expect(screen.getByRole('heading', { name: 'Referências por relação de massa' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Referências por proximidade' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Massa como limite inferior').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sem comparação por proximidade')).toHaveLength(3);
  });

  it('preserva formulário e prioridade ao alternar os dois PDFs', () => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8,03' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Priorizar altura máxima' }));
    fireEvent.click(screen.getByRole('button', { name: 'Consultar fontes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Perfis de Projéteis — Eliane Baruch' }));
    expect(screen.getByTitle(/^Fonte:/)).toHaveAttribute('src', expect.stringContaining('perfis-projeteis-eliane-baruch.pdf'));
    fireEvent.click(screen.getByRole('button', { name: 'Tabela de calibres — Balística Forense' }));
    expect(screen.getByTitle(/^Fonte:/)).toHaveAttribute('src', expect.stringContaining('tabela-calibres-balistica-forense.pdf'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByLabelText('Massa (g)')).toHaveValue('8,03');
    expect(screen.getByRole('radio', { name: 'Priorizar altura máxima' })).toBeChecked();
  });

  it('indica a dimensão ausente na medida sem repetir o aviso no cabeçalho', () => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '9,2' } });
    fireEvent.change(screen.getByLabelText('Altura máxima (mm)'), { target: { value: '15,4' } });
    fireEvent.click(screen.getByRole('button', { name: /Mostrar mais opções/ }));
    expect(screen.getByText('CAL-13')).toBeInTheDocument();
    expect(screen.queryByText(/Comparação parcial: referência sem/)).not.toBeInTheDocument();
    const nome = screen.getByRole('heading', { name: 'CAL-13' });
    const cartao = screen.getAllByRole('img', { name: /^Posição / }).map(posicao => posicao.parentElement).find(elemento => elemento?.contains(nome));
    if (!cartao) throw new Error('Cartão da referência não encontrado');
    expect(within(within(cartao).getByRole('group', { name: 'Medida: Altura máxima' })).getByText('Não informada')).toBeInTheDocument();
  });

  it.each(['0', '-2', 'abc', 'Infinity'])('rejeita a medida inválida %s', valor => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: valor } });
    expect(screen.getByRole('alert')).toHaveTextContent('Use apenas medidas positivas.');
    expect(screen.queryAllByLabelText(/^Posição /)).toHaveLength(0);
  });

  it('sem medidas permite filtrar por formato sem indicar proximidade', () => {
    render(<ProjeteisPage />);
    expect(screen.getByRole('heading', { name: 'Referências filtradas' })).toBeInTheDocument();
    expect(screen.queryAllByLabelText(/^Posição /)).toHaveLength(0);
    expect(screen.queryByText(/Deixe em branco dimensões comprometidas/)).not.toBeInTheDocument();
  });

  it('destaca as três primeiras posições com ordinais e mantém números a partir da quarta', () => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8' } });
    for (const posicao of [1, 2, 3]) {
      expect(within(screen.getByRole('img', { name: `Posição ${posicao} na ordem das referências` })).getByText(`${posicao}º`)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: /Mostrar mais opções/ }));
    expect(within(screen.getByRole('img', { name: 'Posição 4 na ordem das referências' })).getByText('4')).toBeInTheDocument();
    expect(screen.queryByText('4º')).not.toBeInTheDocument();
    expect(screen.queryByText('Ordenado pelas medidas preenchidas')).not.toBeInTheDocument();
  });

  it('mostra duas fontes preferenciais visíveis e o documento selecionado', async () => {
    render(<ProjeteisPage />);
    const botao = screen.getByRole('button', { name: 'Consultar fontes' });
    fireEvent.click(botao);
    const dialogo = screen.getByRole('dialog', { name: 'Fontes de informação' });
    expect(within(dialogo).getByText('2 fontes preferenciais')).toBeInTheDocument();
    const tabela = within(dialogo).getByRole('button', { name: 'Tabela de calibres — Balística Forense' });
    const baruch = within(dialogo).getByRole('button', { name: 'Perfis de Projéteis — Eliane Baruch' });
    expect(tabela).toBeVisible();
    expect(baruch).toBeVisible();
    expect(tabela).toHaveAttribute('aria-pressed', 'true');
    expect(baruch).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(baruch);
    expect(baruch).toHaveAttribute('aria-pressed', 'true');
    expect(tabela).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(dialogo, { key: 'Escape' });
    await waitFor(() => expect(botao).toHaveFocus());
  });

  it('concentra instruções e cálculo na ajuda sem apagar o formulário e devolve o foco', async () => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8,03' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Priorizar altura máxima' }));
    expect(screen.queryByText(/erro relativo =/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Compare referências aproximadas/)).not.toBeInTheDocument();
    const botao = screen.getByRole('button', { name: 'Entenda o cálculo' });
    fireEvent.click(botao);
    const ajuda = screen.getByRole('dialog', { name: 'Entenda o cálculo' });
    expect(within(ajuda).getByRole('heading', { name: '1. Como usar' })).toBeInTheDocument();
    expect(within(ajuda).getByRole('heading', { name: '3. Como calculamos a ordem' })).toBeInTheDocument();
    expect(within(ajuda).getByRole('table')).toBeInTheDocument();
    expect(within(ajuda).getByText('60')).toBeInTheDocument();
    expect(within(ajuda).getByText('20')).toBeInTheDocument();
    expect(within(ajuda).getByText(/pontuação = soma/)).toBeInTheDocument();
    expect(within(ajuda).getByText(/0,012/)).toBeInTheDocument();
    expect(within(ajuda).getByText(/A pontuação não é probabilidade de identificação/)).toBeInTheDocument();
    fireEvent.keyDown(ajuda, { key: 'Escape' });
    await waitFor(() => expect(botao).toHaveFocus());
    expect(screen.getByLabelText('Massa (g)')).toHaveValue('8,03');
    expect(screen.getByRole('radio', { name: 'Priorizar altura máxima' })).toBeChecked();
  });

  it('mantém diferenças assinadas e coloca observações extensas nos detalhes', async () => {
    vi.mocked(window.ipcAPI.projetil.listarPersonalizados).mockResolvedValueOnce({ success: true, data: [{
      id: 'local', calibre: 'LOCAL', tipo: 'ETOG', sigla: 'ETOG', massaGramas: 8,
      calibreRealMinMm: 9, calibreRealMaxMm: 9, alturaMinMm: 15, alturaMaxMm: 15,
      situacao: 'personalizada', fonte: 'Local', localizacao: 'Local', observacao: 'Observação extensa para consulta adicional.',
    }] });
    render(<ProjeteisPage />);
    await waitFor(() => expect(screen.getByLabelText('Massa (g)')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8,01' } });
    const observacao = await screen.findByText('Observação extensa para consulta adicional.');
    expect(observacao.closest('details')).not.toHaveAttribute('open');
    expect(screen.getAllByText('+0,01 g (+0,13%)').length).toBeGreaterThan(0);
    expect(screen.queryByText(/medido acima/)).not.toBeInTheDocument();
    const detalhes = observacao.closest('details');
    if (!detalhes) throw new Error('Detalhes da referência ausentes.');
    fireEvent.click(within(detalhes).getByText('Detalhes da referência'));
    expect(detalhes).toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: /Mostrar mais opções/ }));
    expect(observacao.closest('details')).toBe(detalhes);
    expect(detalhes).toHaveAttribute('open');
  });

  it('destaca somente medidas próximas e mantém diferença assinada e candidato neutro', () => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8,03' } });
    fireEvent.change(screen.getByLabelText('Calibre real médio (mm)'), { target: { value: '9,6' } });
    const massas = screen.getAllByRole('group', { name: 'Medida: Massa' });
    const calibres = screen.getAllByRole('group', { name: 'Medida: Calibre real médio' });
    const alturas = screen.getAllByRole('group', { name: 'Medida: Altura máxima' });
    expect(massas[0]).toHaveClass('bg-emerald-500/10');
    expect(calibres.every(elemento => !elemento.classList.contains('bg-emerald-500/10'))).toBe(true);
    expect(alturas.every(elemento => !elemento.classList.contains('bg-emerald-500/10'))).toBe(true);
    expect(screen.getAllByText('Próxima da referência')).toHaveLength(3);
    expect(screen.getByText('+0,03 g (+0,38%)')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Posição 1 na ordem das referências' }).parentElement).not.toHaveClass('bg-emerald-500/10');
  });

  it('mantém coincidências distintas e não destaca massa com perda de material', () => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8' } });
    expect(screen.getByText(/Mesmo valor/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Houve perda de material' }));
    expect(screen.getAllByRole('group', { name: 'Medida: Massa' }).every(elemento => !elemento.classList.contains('bg-emerald-500/10'))).toBe(true);
    expect(screen.queryByText('Próxima da referência')).not.toBeInTheDocument();
  });

  it('separa a região rolável do cabeçalho e explica as duas fórmulas na ajuda', () => {
    render(<ProjeteisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Entenda o cálculo' }));
    const regiao = screen.getByRole('region', { name: 'Conteúdo da ajuda' });
    expect(regiao).toHaveAttribute('tabindex', '0');
    expect(regiao).toHaveClass('overflow-y-auto');
    expect(within(regiao).queryByRole('heading', { name: 'Entenda o cálculo' })).not.toBeInTheDocument();
    expect(within(regiao).getAllByRole('heading', { level: 3 }).map(elemento => elemento.textContent)).toEqual([
      '1. Como usar', '2. Como interpretar os cartões', '3. Como calculamos a ordem', '4. Situações especiais',
    ]);
    expect(within(regiao).getByText(/desvio percentual =/)).toHaveTextContent('/ referência × 100');
    expect(within(regiao).getByText(/erro relativo =/)).toHaveTextContent('/ observado');
    expect(within(regiao).getByText('limite de proximidade', { exact: true })).toBeInTheDocument();
    expect(within(regiao).getByText(/Verde: até 5% da referência/)).toBeInTheDocument();
  });

  it.each([
    ['8,04', '+0,04 g (+0,50%)'],
    ['8,06', '-0,04 g (-0,49%)'],
    ['8', '0 g (0,00%) · Mesmo valor'],
  ])('exibe diferença absoluta e percentual para massa %s', (valor, esperado) => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: valor } });
    expect(screen.getByText(esperado)).toBeInTheDocument();
  });

  it('exibe percentual zero dentro da faixa e usa o limite próximo fora dela', () => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Calibre real médio (mm)'), { target: { value: '9,01' } });
    expect(screen.getAllByText('0 mm (0,00%) · Dentro da faixa')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Calibre real médio (mm)'), { target: { value: '9,1' } });
    expect(screen.getAllByText('+0,08 mm (+0,89%)')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Calibre real médio (mm)'), { target: { value: '8,9' } });
    expect(screen.getAllByText('-0,1 mm (-1,11%)')).toHaveLength(3);
  });

  it('limpa consulta e resultados e restaura as preferências iniciais', () => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8,03' } });
    fireEvent.change(screen.getByLabelText('Calibre real médio (mm)'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Altura máxima (mm)'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Priorizar altura máxima' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Houve perda de material' }));
    fireEvent.click(screen.getByRole('button', { name: /Mostrar mais opções/ }));
    expect(screen.getAllByLabelText(/^Posição /)).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar resultados' }));
    for (const rotulo of ['Massa (g)', 'Calibre real médio (mm)', 'Altura máxima (mm)']) {
      expect(screen.getByLabelText(rotulo)).toHaveValue('');
    }
    expect(screen.getByRole('radio', { name: 'Priorizar massa' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Houve perda de material' })).not.toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Formato/Constituição' })).toHaveTextContent('Todos');
    expect(screen.queryAllByLabelText(/^Posição /)).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: '8' } });
    expect(screen.getAllByLabelText(/^Posição /)).toHaveLength(3);
  });

  it('limpa uma entrada inválida e permite limpar novamente uma consulta vazia', () => {
    render(<ProjeteisPage />);
    fireEvent.change(screen.getByLabelText('Massa (g)'), { target: { value: 'abc' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar resultados' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar resultados' }));
    expect(screen.queryAllByLabelText(/^Posição /)).toHaveLength(0);
  });

});
