import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from 'tinymce';
import { criarDadosB601 } from '../../shared/types/b601.types';
import { criarPecaColeta } from '../fixtures/b601-coleta';
import { esquemaRepsMesmoCasoGdl } from '../../shared/gdl/reps-mesmo-caso';
import { buildPlaceholderMapping, resolverPlaceholdersExportacao } from '@/lib/exportacao-placeholders';
import { aplicarReferenciasColetaB601, atualizarReferenciasEditorColetaB601, limparInteracaoColetaB601, prepararColetaB601, registrarColetaB601, sincronizarCacheColetaB601 } from '@/lib/b601-coleta';
import { criarCopiaVisualizacaoPlaceholders, restaurarTabelaPlaceholder } from '@/lib/apresentacao-placeholders';
import { construirMapaPlaceholdersResolvidos } from '@/lib/exportacao-placeholders';
import { removerFormatacaoPlaceholdersDoDom } from '@/lib/utils';
import { parseHtmlParaEstrutura } from '@/lib/exportacao-parser';
import { laudoPadraoB601LocalNecropsiaV1 } from '../../main/templates/integrados/b601/laudo-padrao-b601-local-necropsia.v1';

const snapshot = esquemaRepsMesmoCasoGdl.parse({ ambiente: 'producao', numeroRep: '100', anoRep: '2026', numeroCaso: '42', consultadoEm: new Date().toISOString(),
  reps: [{ numero: '20', ano: '2026', codigoNatureza: 'M110' }, { numero: '21', ano: '2026', codigoNatureza: 'T002' }] });
const contexto = { repData: { numero: '100/2026', campos_especificos: JSON.stringify({ b601: { ...criarDadosB601(), pecas: [criarPecaColeta('local', '93'), criarPecaColeta('necro', '94')] }, integracaoGdl: { repsMesmoCaso: snapshot } }) } };
const tabela = () => buildPlaceholderMapping(contexto).b601_tabela_material_coleta;
const encerramentos: (() => void)[] = [];
const gdlOriginal = window.ipcAPI.gdl;

function montarEditor(html: string) {
  document.body.innerHTML = html;
  const eventos = new Map<string, (() => void)[]>();
  const historico: string[] = [];
  let somenteLeitura = false;
  const getContent = () => {
    const copia = document.body.cloneNode(true);
    if (!(copia instanceof HTMLElement)) throw new Error('Documento inválido');
    removerFormatacaoPlaceholdersDoDom(copia);
    return copia.innerHTML;
  };
  const editor = {
    getDoc: () => document, getBody: () => document.body, getContent,
    mode: { isReadOnly: () => somenteLeitura }, nodeChanged: vi.fn(),
    notificationManager: { open: vi.fn() }, windowManager: { open: vi.fn<(opcoes: { onSubmit: (api: { getData: () => { valor: string }; close: () => void }) => void }) => void>() },
    undoManager: { ignore: (acao: () => void) => acao(), transact: (acao: () => void) => { historico.push(getContent()); acao(); } },
    on: (nomes: string, acao: () => void) => nomes.split(' ').forEach(nome => eventos.set(nome, [...eventos.get(nome) ?? [], acao])),
    off: vi.fn(),
  };
  const alterar = vi.fn();
  registrarColetaB601(editor as unknown as Editor, 'laudo-1', alterar);
  const disparar = (nome: string) => eventos.get(nome)?.forEach(acao => acao());
  encerramentos.push(() => disparar('remove'));
  return { editor, alterar, getContent, disparar,
    undo: () => { document.body.innerHTML = historico.pop() || ''; disparar('Undo'); },
    leitura: () => { somenteLeitura = true; disparar('SwitchMode'); } };
}

afterEach(() => { encerramentos.splice(0).forEach(encerrar => encerrar()); document.body.innerHTML = ''; window.ipcAPI.gdl = gdlOriginal; });

describe('coleta B-601 no editor e na exportação', () => {
  it('preserva as tabelas estruturais dentro das seções do novo modelo', () => {
    const fonte = laudoPadraoB601LocalNecropsiaV1.secoes.filter(secao => ['objetivo', 'material-apresentado'].includes(secao.chave)).map(secao => secao.conteudo).join('');
    const estrutura = parseHtmlParaEstrutura(resolverPlaceholdersExportacao(fonte, contexto));
    expect(estrutura.secoes[0].blocos.filter(bloco => bloco.tipo === 'tabela')).toHaveLength(3);
  });
  it('gera referências por peça e mantém o placeholder padrão independente', () => {
    expect(tabela()).toContain('20/2026');
    expect(tabela()).toContain('21/2026');
    expect(tabela()).toContain('data-b601-peca-id="local"');
    expect(buildPlaceholderMapping(contexto).b601_tabela_material_enc).not.toContain('Nº Exame Coleta');
    const outraRep = { repData: { ...contexto.repData, numero: '999/2026' } };
    expect(buildPlaceholderMapping(outraRep).b601_tabela_material_coleta).not.toContain('20/2026');
  });

  it('reaproveita o cache da REP local com hífen e formata o exame só como número e ano', () => {
    const contextoHifen = { repData: { ...contexto.repData, numero: '100-2026' } };
    const html = buildPlaceholderMapping(contextoHifen).b601_tabela_material_coleta;
    montarEditor(html);
    expect(document.querySelector<HTMLSelectElement>('[data-b601-exame-coleta] select')?.value).toBe('20/2026');
    aplicarReferenciasColetaB601(document.body, { ...snapshot, reps: [{ numero: '39253', ano: '2022', codigoNatureza: 'M110' }] });
    prepararColetaB601(document.body);
    const controle = document.querySelector<HTMLSelectElement>('[data-b601-exame-coleta] select')!;
    expect(controle.textContent).toContain('39.253/2022');
    expect(controle.textContent).not.toMatch(/REP |M110|T002/);
  });

  it('materializa a tabela na escolha, preserva o texto e permite desfazer', () => {
    const html = `<p><span data-placeholder="{{b601_tabela_material_coleta}}" data-placeholder-preview-id="t1">{{b601_tabela_material_coleta}}</span></p><div data-placeholder-preview="true" data-placeholder-preview-tabela="true" data-placeholder-preview-id="t1">${tabela()}</div>`;
    const sessao = montarEditor(html);
    const controle = document.querySelector<HTMLSelectElement>('[data-b601-exame-coleta] select')!;
    controle.value = '20/2026';
    controle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelector('[data-placeholder-tabela-personalizada]')).not.toBeNull();
    const salvo = sessao.getContent();
    expect(salvo).not.toContain('<select');
    expect(salvo).not.toContain('<button');
    expect(salvo).toContain('21/2026');
    document.body.innerHTML = salvo;
    sessao.disparar('SetContent');
    expect(document.querySelector<HTMLSelectElement>('[data-b601-exame-coleta] select')?.value).toBe('20/2026');
    sessao.undo();
    expect(document.querySelector('[data-placeholder-tabela-personalizada]')).toBeNull();
  });

  it('atualiza opções por origem, preserva texto manual e permite reabrir', () => {
    const sessao = montarEditor(tabela() + '<p>Outra edição em andamento</p>');
    const campo = document.querySelector('[data-b601-exame-coleta] [data-b601-coleta-texto]')!;
    campo.textContent = 'Exame manual 123';
    aplicarReferenciasColetaB601(document.body, { ...snapshot, reps: [
      { numero: '99', ano: '2026', codigoNatureza: 'M110' },
      { numero: '98', ano: '2026', codigoNatureza: 'T002' },
    ] });
    prepararColetaB601(document.body);
    const controles = document.querySelectorAll<HTMLSelectElement>('[data-b601-exame-coleta] select');
    expect(controles[0].value).toBe('Exame manual 123');
    expect(controles[0].textContent).toContain('99/2026');
    expect(controles[0].textContent).not.toContain('98/2026');
    expect(controles[1].textContent).toContain('98/2026');
    expect(controles[1].textContent).not.toContain('99/2026');
    const salvo = sessao.getContent();
    document.body.innerHTML = salvo;
    sessao.disparar('SetContent');
    expect(document.querySelector<HTMLSelectElement>('[data-b601-exame-coleta] select')?.value).toBe('Exame manual 123');
    expect(document.body.textContent).toContain('Outra edição em andamento');
    expect(document.querySelector('button[data-b601-coleta-controle]')).toBeNull();
  });

  it('preenche apenas XXX com correspondência única e mantém várias ou nenhuma sem escolha', () => {
    const semReferencias = { repData: { ...contexto.repData, campos_especificos: JSON.stringify({ b601: { ...criarDadosB601(), pecas: [criarPecaColeta('local', '93'), criarPecaColeta('necro', '94')] } }) } };
    montarEditor(buildPlaceholderMapping(semReferencias).b601_tabela_material_coleta);
    aplicarReferenciasColetaB601(document.body, { ...snapshot, reps: [] });
    prepararColetaB601(document.body);
    expect(Array.from(document.querySelectorAll<HTMLSelectElement>('[data-b601-exame-coleta] select')).map(c => c.value)).toEqual(['XXX', 'XXX']);
    aplicarReferenciasColetaB601(document.body, { ...snapshot, reps: [...snapshot.reps, { numero: '99', ano: '2026', codigoNatureza: 'M110' }] });
    prepararColetaB601(document.body);
    expect(Array.from(document.querySelectorAll<HTMLSelectElement>('[data-b601-exame-coleta] select')).map(c => c.value)).toEqual(['XXX', '21/2026']);
    expect(document.querySelector('[data-b601-exame-coleta] select')?.textContent).toContain('Preencher manualmente');
    aplicarReferenciasColetaB601(document.body, snapshot);
    prepararColetaB601(document.body);
    expect(Array.from(document.querySelectorAll<HTMLSelectElement>('[data-b601-exame-coleta] select')).map(c => c.value)).toEqual(['20/2026', '21/2026']);
  });

  it('atualiza a prévia sem materializar a tabela nem alterar outras edições', () => {
    const html = `<p>Edição anterior à consulta</p><p><span data-placeholder="{{b601_tabela_material_coleta}}" data-placeholder-preview-id="t1">{{b601_tabela_material_coleta}}</span></p><div data-placeholder-preview="true" data-placeholder-preview-tabela="true" data-placeholder-preview-id="t1">${tabela()}</div>`;
    const sessao = montarEditor(html);
    const salvo = atualizarReferenciasEditorColetaB601(sessao.editor as unknown as Editor, snapshot);
    expect(document.querySelector('[data-placeholder-tabela-personalizada]')).toBeNull();
    expect(salvo).toContain('Edição anterior à consulta');
    expect(salvo).not.toContain('<select');
    expect(document.querySelector('[data-b601-exame-coleta] select')?.textContent).toContain('20/2026');
    expect(sessao.editor.nodeChanged).toHaveBeenCalled();
  });

  it('oferece seletores com os dados importados e recalcula o exame na troca de origem', () => {
    const sessao = montarEditor(tabela());
    const obter = (campo: string) => document.querySelector<HTMLSelectElement>(`[data-b601-campo-coleta="${campo}"] select`)!;
    expect(obter('tipo').value).toBe('PROJÉTEIS');
    expect(obter('quantidade').value).toBe('1 UNIDADES');
    expect(obter('origem').value).toBe('LOCAL DE CRIME');
    expect(obter('tipo').textContent).toContain('ESTOJO(S)');
    obter('tipo').value = 'ESTOJO(S)';
    obter('tipo').dispatchEvent(new Event('change', { bubbles: true }));
    obter('origem').value = 'NECRÓPSIA';
    obter('origem').dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelector<HTMLSelectElement>('[data-b601-exame-coleta] select')?.value).toBe('21/2026');
    expect(document.querySelector('[data-b601-exame-coleta] select')?.textContent).not.toMatch(/REP |T002|M110/);
    const salvo = sessao.getContent();
    document.body.innerHTML = salvo;
    sessao.disparar('SetContent');
    expect(obter('tipo').value).toBe('ESTOJO(S)');
    expect(obter('origem').value).toBe('NECRÓPSIA');
    obter('origem').value = 'HOSPITAL';
    obter('origem').dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelector<HTMLSelectElement>('[data-b601-exame-coleta] select')?.value).toBe('XXX');
  });

  it('valida quantidade manual e mantém a quantidade importada entre as opções', () => {
    const sessao = montarEditor(tabela());
    const quantidade = document.querySelector<HTMLSelectElement>('[data-b601-campo-coleta="quantidade"] select')!;
    quantidade.value = '__manual__'; quantidade.dispatchEvent(new Event('change', { bubbles: true }));
    const opcoes = sessao.editor.windowManager.open.mock.calls[0][0];
    const fechar = vi.fn();
    for (const valor of ['0', '-1', '1,5', 'abc']) opcoes.onSubmit({ getData: () => ({ valor }), close: fechar });
    expect(fechar).not.toHaveBeenCalled();
    opcoes.onSubmit({ getData: () => ({ valor: '12' }), close: fechar });
    expect(fechar).toHaveBeenCalledOnce();
    const controle = document.querySelector<HTMLSelectElement>('[data-b601-campo-coleta="quantidade"] select')!;
    expect(controle.value).toBe('12 UNIDADES');
    expect(controle.textContent).toContain('1 UNIDADES');
    const salvo = sessao.getContent();
    expect(salvo).toContain('12 UNIDADES');
    expect(salvo).not.toContain('<select');
  });

  it('restaura a tabela inteira com os dados atuais locais da REP', () => {
    const html = `<p><span data-placeholder="{{b601_tabela_material_coleta}}" data-placeholder-preview-id="t1">{{b601_tabela_material_coleta}}</span></p><div data-placeholder-preview="true" data-placeholder-preview-tabela="true" data-placeholder-preview-id="t1">${tabela()}</div>`;
    const sessao = montarEditor(html);
    const tipo = document.querySelector<HTMLSelectElement>('[data-b601-campo-coleta="tipo"] select')!;
    tipo.value = 'ESTOJO(S)'; tipo.dispatchEvent(new Event('change', { bubbles: true }));
    const quantidade = document.querySelector<HTMLSelectElement>('[data-b601-campo-coleta="quantidade"] select')!;
    quantidade.value = '__manual__'; quantidade.dispatchEvent(new Event('change', { bubbles: true }));
    sessao.editor.windowManager.open.mock.calls[0][0].onSubmit({ getData: () => ({ valor: '12' }), close: vi.fn() });
    const origem = document.querySelector<HTMLSelectElement>('[data-b601-campo-coleta="origem"] select')!;
    origem.value = 'NECRÓPSIA'; origem.dispatchEvent(new Event('change', { bubbles: true }));
    const lacre = document.querySelector('[data-b601-exame-coleta]')!.closest('tr')!.lastElementChild!;
    lacre.textContent = 'LACRE EDITADO';
    const botao = document.querySelector<HTMLElement>('[data-acao-tabela-placeholder="restaurar"]')!;
    expect(restaurarTabelaPlaceholder(sessao.editor as unknown as Editor, botao)).toBe(true);
    const pecaAtual = criarPecaColeta('local', '93', 3);
    pecaAtual.comuns.lacreEntrada = 'L2';
    const contextoAtual = { repData: { numero: '100/2026', campos_especificos: JSON.stringify({ b601: { ...criarDadosB601(), pecas: [pecaAtual] }, integracaoGdl: { repsMesmoCaso: { ...snapshot, reps: [{ numero: '99', ano: '2026', codigoNatureza: 'M110' }] } } }) } };
    const copia = criarCopiaVisualizacaoPlaceholders(sessao.getContent(), { modo: 'dados', valores: construirMapaPlaceholdersResolvidos(contextoAtual), placeholdersPersonalizados: [], descreverPendente: () => '' });
    document.body.innerHTML = copia.innerHTML;
    sessao.disparar('SetContent');
    expect(document.querySelector<HTMLSelectElement>('[data-b601-campo-coleta="tipo"] select')?.value).toBe('PROJÉTEIS');
    expect(document.querySelector<HTMLSelectElement>('[data-b601-campo-coleta="quantidade"] select')?.value).toBe('3 UNIDADES');
    expect(document.querySelector<HTMLSelectElement>('[data-b601-campo-coleta="origem"] select')?.value).toBe('LOCAL DE CRIME');
    expect(document.querySelector<HTMLSelectElement>('[data-b601-exame-coleta] select')?.value).toBe('99/2026');
    expect(document.body.textContent).toContain('L2');
    expect(document.body.textContent).not.toContain('LACRE EDITADO');
    expect(document.querySelector('[data-placeholder-tabela-personalizada]')).toBeNull();
  });

  it('inclui e remove BNPB/SINAB por ação e não oferece controles em somente leitura', () => {
    const sessao = montarEditor(tabela() + '<div data-b601-sinab="opcional"><p>&nbsp;</p></div>');
    expect(sessao.getContent()).not.toContain('Cumpre ressaltar');
    document.querySelector<HTMLButtonElement>('[data-b601-coleta-controle="sinab"]')!.click();
    expect(sessao.getContent()).toContain('REP) nº XXX');
    document.querySelector<HTMLButtonElement>('[data-b601-coleta-controle="sinab"]')!.click();
    expect(sessao.getContent()).not.toContain('Cumpre ressaltar');
    sessao.leitura();
    expect(document.querySelector('select,button')).toBeNull();
  });

  it('ignora referências salvas de outro ambiente e preserva os valores locais', () => {
    montarEditor(tabela());
    const modelo = buildPlaceholderMapping({ ...contexto, ambienteGdl: 'homologacao' }).b601_tabela_material_coleta;
    expect(modelo).not.toContain('data-b601-referencias');
    sincronizarCacheColetaB601(document.body, modelo);
    const controle = document.querySelector<HTMLSelectElement>('[data-b601-exame-coleta] select')!;
    expect(controle.value).toBe('20/2026');
    expect(controle.options).toHaveLength(2);
    expect(document.querySelector('[data-b601-referencias]')).toBeNull();
  });

  it('retira controles e metadados da saída preservando texto e fotografias', () => {
    document.body.innerHTML = tabela() + '<figure class="laudo-figure" data-image-id="foto-preservada"><img src="data:image/png;base64,AAAA"><figcaption>Figura 1</figcaption></figure>';
    prepararColetaB601(document.body);
    const resultado = resolverPlaceholdersExportacao(document.body.innerHTML, contexto);
    expect(resultado).toContain('20/2026');
    expect(resultado).toContain('foto-preservada');
    expect(resultado).not.toContain('<select');
    expect(resultado).not.toContain('<button');
    expect(resultado).not.toContain('data-b601-referencias');
    expect(parseHtmlParaEstrutura(resultado).secoes[0].blocos.some(bloco => bloco.tipo === 'tabela')).toBe(true);
    limparInteracaoColetaB601(document.body);
    expect(document.querySelector('[data-b601-exame-coleta]')?.textContent).toBe('20/2026');
  });
});
