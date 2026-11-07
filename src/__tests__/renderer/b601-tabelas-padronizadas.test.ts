import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from 'tinymce';
import { CAMPOS_ESTOJOS_B601, CAMPOS_PROJETEIS_B601, obterOpcoesCampoTabelaB601 } from '@shared/catalogos/b601-tabelas.catalogo';
import { criarDadosB601 } from '@shared/types/b601.types';
import { gerarDescricaoAgrupadaB601, gerarDescricaoColetaB601 } from '@shared/utils/b601-descricao-agrupada';
import { preservarDescricaoAgrupadaB601 } from '@main/services/b601-secoes.service';
import { limparInteracaoCamposB601, prepararCamposProjeteisB601, registrarSeletoresCamposB601 } from '@/lib/b601-campos-projetil';
import { registrarMenuPreenchimentoB601 } from '@/lib/menu-preenchimento-b601';
import { criarPecaColeta } from '../fixtures/b601-coleta';

const dados = { ...criarDadosB601(), pecas: [criarPecaColeta('p', '94'), criarPecaColeta('e', '95', 1, '101')] };
const encerramentos: Array<() => void> = [];

function montar(html: string, leitura = false) {
  const raiz = document.createElement('div');
  raiz.innerHTML = html;
  document.body.append(raiz);
  const projetilOriginal = window.ipcAPI.projetil;
  Object.assign(window.ipcAPI, { projetil: { listarPersonalizados: vi.fn().mockResolvedValue({ success: true, data: [] }) } });
  const abrir = vi.fn<(configuracao: {
    title: string; initialData: { valor: string };
    onSubmit: (api: { getData: () => { valor: string }; close: () => void }) => void;
  }) => void>();
  const eventos = new Map<string, Array<() => void>>();
  let inicioSelecao: Element = raiz;
  const editor = {
    getDoc: () => document, getBody: () => raiz, getContent: () => raiz.innerHTML,
    getContainer: () => raiz, focus: vi.fn(), removed: false, destroyed: false,
    selection: { getStart: () => inicioSelecao, select: vi.fn(), collapse: vi.fn() },
    mode: { isReadOnly: () => leitura }, nodeChanged: vi.fn(), windowManager: { open: abrir },
    undoManager: { ignore: (acao: () => void) => acao(), transact: vi.fn((acao: () => void) => acao()) },
    on: (nomes: string, acao: () => void) => nomes.split(' ').forEach(nome => eventos.set(nome, [...eventos.get(nome) ?? [], acao])), off: vi.fn(),
  };
  const alterar = vi.fn();
  registrarSeletoresCamposB601(editor as unknown as Editor, alterar);
  registrarMenuPreenchimentoB601(editor as unknown as Editor, alterar);
  encerramentos.push(() => { eventos.get('remove')?.forEach(acao => acao()); window.ipcAPI.projetil = projetilOriginal; });
  const escolher = (chave: string, valor: string) => {
    const controle = raiz.querySelector<HTMLSelectElement>(`[data-b601-campo="${chave}"] select`);
    if (!controle) throw new Error(`Controle ausente: ${chave}`);
    controle.value = valor;
    if (controle.hasAttribute('data-valor-livre')) controle.setAttribute('data-valor-livre', valor);
    controle.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const usarAtalho = (chave: string, letra: 'a' | 'p') => {
    const controle = raiz.querySelector<HTMLSelectElement>(`[data-b601-campo="${chave}"] select`);
    if (!controle) throw new Error(`Controle ausente: ${chave}`);
    inicioSelecao = controle;
    controle.focus();
    controle.dispatchEvent(new KeyboardEvent('keydown', { key: letra, ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
  };
  return { raiz, abrir, alterar, editor, escolher, usarAtalho };
}

afterEach(() => {
  encerramentos.splice(0).forEach(encerrar => encerrar());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('contrato comum das tabelas B-601', () => {
  it.each(['105', '101'] as const)('gera campos iguais no padrão, coleta e um terceiro template: %s', tipo => {
    const gerar = [() => gerarDescricaoAgrupadaB601(dados, tipo, 'padrao'),
      () => gerarDescricaoColetaB601(dados, tipo, 'necropsia'),
      () => gerarDescricaoAgrupadaB601(dados, tipo, 'template-personalizado')];
    const campos = tipo === '105' ? CAMPOS_PROJETEIS_B601 : CAMPOS_ESTOJOS_B601;
    for (const gerador of gerar) {
      const raiz = document.createElement('div'); raiz.innerHTML = gerador();
      expect(raiz.querySelector('[data-b601-campos-versao="1"]')).not.toBeNull();
      expect(Array.from(raiz.querySelectorAll('[data-b601-campo]'), campo => campo.getAttribute('data-b601-campo')))
        .toEqual(campos.filter(campo => campo.fonte).map(campo => campo.chave));
      expect(raiz.querySelector('[data-b601-campo="origem"]')?.textContent).toBe(tipo === '105' ? 'NECRÓPSIA' : 'DELEGACIA');
      expect(raiz.querySelector('[data-b601-campo="procedencia"]')).toBeNull();
      prepararCamposProjeteisB601(raiz);
      const controles = Array.from(raiz.querySelectorAll('select'));
      expect(controles).toHaveLength(campos.filter(campo => campo.fonte).length);
      expect(controles.every(controle => !controle.disabled)).toBe(true);
      controles.forEach(controle => {
        expect(Array.from(controle.options, opcao => opcao.value)).toEqual(expect.arrayContaining(['Prejudicado', '__manual__']));
      });
    }
  });

  it('oferece todas as origens do GDL com ações ao final', () => {
    const origem = CAMPOS_ESTOJOS_B601.find(campo => campo.chave === 'origem')!;
    expect(obterOpcoesCampoTabelaB601(origem).map(opcao => opcao.valor)).toEqual([
      'DELEGACIA', 'HOSPITAL', 'LOCAL DE CRIME', 'NECRÓPSIA', 'Outro', 'Prejudicado', '__manual__',
    ]);
  });

  it('preserva tabelas antigas na reconciliação e somente gera novo contrato ao recriar', () => {
    const legado = '<div data-b601-grupo="101" data-repeat-owner="secao"><table><tbody><tr><td>Procedência</td><td>NECRÓPSIA</td></tr></tbody></table></div>';
    const novo = gerarDescricaoAgrupadaB601(dados, '101', 'secao');
    const preservado = preservarDescricaoAgrupadaB601(novo, legado);
    expect(preservado).not.toContain('data-b601-campos-versao');
    expect(new DOMParser().parseFromString(preservado, 'text/html').body.textContent).toBe('ProcedênciaNECRÓPSIA');
    expect(novo).toContain('data-b601-campos-versao="1"');
  });

  it.each(['105', '101'] as const)('mantém os campos protegidos em somente leitura: %s', tipo => {
    const sessao = montar(gerarDescricaoColetaB601(dados, tipo, 'secao'), true);
    expect(sessao.raiz.querySelector('select')).toBeNull();
    expect(sessao.alterar).not.toHaveBeenCalled();
  });

  it.each(['aderencias', 'calibre_nominal_provavel'])('aplica texto manual com undo e reabre com o valor salvo: %s', chave => {
    const sessao = montar(gerarDescricaoAgrupadaB601(dados, '105', 'secao'));
    sessao.escolher(chave, '__manual__');
    expect(sessao.abrir).toHaveBeenCalledOnce();
    expect(sessao.alterar).not.toHaveBeenCalled();
    const dialogo = sessao.abrir.mock.calls[0][0];
    expect(dialogo.initialData.valor).toBe('');
    dialogo.onSubmit({ getData: () => ({ valor: '  Valor especial <teste>  ' }), close: vi.fn() });
    expect(sessao.editor.undoManager.transact).toHaveBeenCalledOnce();
    expect(sessao.alterar).toHaveBeenCalledOnce();
    expect(sessao.raiz.querySelector(`[data-b601-campo="${chave}"] [data-b601-campo-texto]`)?.textContent).toBe('Valor especial <teste>');
    sessao.escolher(chave, '__manual__');
    expect(sessao.abrir.mock.calls[1][0].initialData.valor).toBe('Valor especial <teste>');
    limparInteracaoCamposB601(sessao.raiz);
    expect(sessao.raiz.querySelector('select, button, [data-b601-campo-texto]')).toBeNull();
    expect(sessao.raiz.innerHTML).not.toContain('__manual__');
    expect(sessao.raiz.querySelector(`[data-b601-campo="${chave}"]`)?.textContent).toBe('Valor especial <teste>');
    prepararCamposProjeteisB601(sessao.raiz);
    expect(sessao.raiz.querySelector<HTMLSelectElement>(`[data-b601-campo="${chave}"] select`)?.value).toBe('Valor especial <teste>');
  });

  it('cancelar não altera conteúdo e confirmação obsoleta não altera outro alvo', () => {
    const sessao = montar(gerarDescricaoAgrupadaB601(dados, '105', 'secao'));
    const original = sessao.raiz.innerHTML;
    sessao.escolher('aderencias', '__manual__');
    expect(sessao.raiz.innerHTML).toBe(original);
    expect(sessao.alterar).not.toHaveBeenCalled();
    const dialogo = sessao.abrir.mock.calls[0][0];
    sessao.raiz.querySelector('[data-b601-campo="aderencias"]')?.remove();
    dialogo.onSubmit({ getData: () => ({ valor: 'Brasil' }), close: vi.fn() });
    expect(sessao.alterar).not.toHaveBeenCalled();
  });

  it('selecionar Prejudicado altera apenas o campo e mantém os grupos de coleta', () => {
    const sessao = montar(gerarDescricaoColetaB601(dados, '105', 'secao'));
    const fotos = sessao.raiz.querySelector('[data-b601-complemento]')?.outerHTML;
    sessao.escolher('origem', 'HOSPITAL');
    sessao.escolher('tipo_raiamento', 'Prejudicado');
    expect(sessao.raiz.querySelector('[data-b601-campo="tipo_raiamento"] [data-b601-campo-texto]')?.textContent).toBe('Prejudicado');
    expect(sessao.raiz.querySelector('[data-b601-complemento]')?.outerHTML).toBe(fotos);
    expect(sessao.raiz.querySelector('th[colspan]')?.textContent).toContain('NECRÓPSIA');
  });

  it.each([
    { chave: 'aderencias', inicial: 'Caliça', letra: 'a' as const, esperado: 'Ausente' },
    { chave: 'tipo_raiamento', inicial: 'Valor anterior', letra: 'p' as const, esperado: 'Prejudicado' },
  ])('aplica o atalho sobre o valor selecionado de $chave', ({ chave, inicial, letra, esperado }) => {
    const sessao = montar(gerarDescricaoAgrupadaB601(dados, '105', 'secao'));
    sessao.escolher(chave, '__manual__');
    const dialogo = sessao.abrir.mock.calls[0][0];
    dialogo.onSubmit({ getData: () => ({ valor: inicial }), close: vi.fn() });
    sessao.alterar.mockClear();
    sessao.editor.undoManager.transact.mockClear();

    sessao.usarAtalho(chave, letra);

    const campo = sessao.raiz.querySelector(`[data-b601-campo="${chave}"]`);
    expect(campo?.querySelector('[data-b601-campo-texto]')?.textContent).toBe(esperado);
    expect(campo?.querySelector<HTMLSelectElement>('select')?.value).toBe(esperado);
    expect(sessao.alterar).toHaveBeenCalledOnce();
    expect(sessao.editor.undoManager.transact).toHaveBeenCalled();
    expect(sessao.editor.focus).toHaveBeenCalledWith({ scrollToSelection: false });
  });

  it('não aplica o atalho ao combobox de origem inelegível', () => {
    const sessao = montar(gerarDescricaoAgrupadaB601(dados, '105', 'secao'));
    const original = sessao.raiz.querySelector('[data-b601-campo="origem"] [data-b601-campo-texto]')?.textContent;
    sessao.usarAtalho('origem', 'a');
    expect(sessao.raiz.querySelector('[data-b601-campo="origem"] [data-b601-campo-texto]')?.textContent).toBe(original);
    expect(sessao.alterar).not.toHaveBeenCalled();
    expect(sessao.editor.undoManager.transact).not.toHaveBeenCalled();
  });
});
