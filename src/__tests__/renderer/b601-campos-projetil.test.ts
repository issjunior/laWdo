import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from 'tinymce';
import { lerMedidasCampoCalibreB601, limparInteracaoCamposB601, prepararCamposProjeteisB601, registrarSeletoresCamposB601 } from '@/lib/b601-campos-projetil';
import { catalogoProjeteis } from '@shared/catalogos/projeteis.catalogo';
import type { ProjetilReferencia } from '@shared/types/projetil.types';

const encerramentos: Array<() => void> = [];

function montar({ coleta = false, leitura = false, envoltorio = '' } = {}) {
  const projetilOriginal = window.ipcAPI.projetil;
  Object.assign(window.ipcAPI, { projetil: { listarPersonalizados: vi.fn().mockResolvedValue({ success: true, data: [] }) } });
  encerramentos.push(() => { window.ipcAPI.projetil = projetilOriginal; });
  const raiz = document.createElement('div');
  const grupo = `<div data-b601-grupo="105" ${coleta ? 'data-b601-modelo-coleta="true"' : ''}>
    <span data-b601-campo-projetil="tipo">Projétil</span><span data-b601-campo-projetil="constituicao_formato">CHOG</span></div>`;
  raiz.innerHTML = envoltorio ? `<div ${envoltorio}>${grupo}</div>` : grupo;
  document.body.append(raiz);
  const eventos = new Map<string, Array<() => void>>();
  const editor = {
    getDoc: () => document, getBody: () => raiz, getContent: () => raiz.innerHTML,
    mode: { isReadOnly: () => leitura }, nodeChanged: vi.fn(),
    undoManager: { ignore: (acao: () => void) => acao(), transact: vi.fn((acao: () => void) => acao()) },
    on: (nomes: string, acao: () => void) => nomes.split(' ').forEach(nome => eventos.set(nome, [...eventos.get(nome) ?? [], acao])),
    off: vi.fn(),
  };
  const alterar = vi.fn();
  registrarSeletoresCamposB601(editor as unknown as Editor, alterar);
  encerramentos.push(() => eventos.get('remove')?.forEach(acao => acao()));
  const controle = () => {
    const seletor = raiz.querySelector<HTMLSelectElement>('[data-b601-campo-projetil="tipo"] select');
    if (!seletor) throw new Error('Seletor de tipo ausente');
    return seletor;
  };
  const escolher = (valor: string) => {
    controle().value = valor;
    controle().dispatchEvent(new Event('change', { bubbles: true }));
  };
  return { raiz, editor, alterar, controle, escolher };
}

function montarTabela(medidas: Array<{ massa: string; diametro: string; altura: string }>) {
  const raiz = document.createElement('div');
  raiz.setAttribute('data-laudo-edicao-direta', 'true');
  const cabecalhos = medidas.map((_, indice) => `<th>PQ${String(indice + 1).padStart(2, '0')}</th>`).join('');
  const linha = (rotulo: string, chave: keyof typeof medidas[number]) => `<tr><th>${rotulo}</th>${medidas.map(item => `<td>${item[chave]}</td>`).join('')}</tr>`;
  raiz.innerHTML = `<div data-b601-grupo="105" data-b601-campos-versao="1"><table><thead><tr><th>Características</th>${cabecalhos}</tr></thead><tbody>
    ${linha('Massa (g)', 'massa')}${linha('Diâmetro médio (mm)', 'diametro')}${linha('Altura (mm)', 'altura')}
    <tr><th>Calibre nominal (provável)</th>${medidas.map((_, indice) => `<td><span data-b601-campo="calibre_nominal_provavel" data-b601-campo-projetil="calibre_nominal_provavel" data-b601-pq="PQ${String(indice + 1).padStart(2, '0')}">XXX</span></td>`).join('')}</tr>
    </tbody></table></div>`;
  document.body.append(raiz);
  return raiz;
}

afterEach(() => {
  encerramentos.splice(0).forEach(encerrar => encerrar());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('seletores protegidos de projéteis B-601', () => {
  it('impede evento de alteração em grupo fechado mesmo quando disparado programaticamente', () => {
    const sessao = montar();
    expect(sessao.controle()).toBeDisabled();
    expect(Array.from(sessao.controle().options, opcao => opcao.value)).toContain('Fragmento');
    sessao.escolher('Fragmento');
    expect(sessao.raiz.querySelector('[data-b601-campo-texto]')?.textContent).toBe('Projétil');
    expect(sessao.editor.undoManager.transact).not.toHaveBeenCalled();
    expect(sessao.alterar).not.toHaveBeenCalled();
  });

  it('libera tipo na coleta sem abrir o grupo e publica uma única alteração com undo', () => {
    const sessao = montar({ coleta: true });
    expect(sessao.controle()).toBeEnabled();
    const opcao = Array.from(sessao.controle().options).find(item => item.value && item.value !== 'Projétil');
    if (!opcao) throw new Error('Opção alternativa ausente');
    sessao.escolher(opcao.value);
    expect(sessao.raiz.querySelector('[data-b601-campo-texto]')?.textContent).toBe(opcao.value);
    expect(sessao.editor.undoManager.transact).toHaveBeenCalledOnce();
    expect(sessao.alterar).toHaveBeenCalledOnce();
    const copia = sessao.raiz.cloneNode(true) as HTMLElement;
    limparInteracaoCamposB601(copia);
    expect(copia.querySelector('select')).toBeNull();
    expect(copia.querySelector('[data-b601-campo-projetil="tipo"]')?.textContent).toBe(opcao.value);
  });

  it.each([
    { leitura: false, envoltorio: 'data-placeholder-celula-fixa="true"' },
    { leitura: false, envoltorio: 'data-mce-bogus="all"' },
  ])('não permite à seleção pontual superar trava %j', opcoes => {
    const sessao = montar({ coleta: true, ...opcoes });
    expect(sessao.controle()).toBeDisabled();
    const alternativa = Array.from(sessao.controle().options).find(item => item.value !== 'Projétil');
    if (!alternativa) throw new Error('Opção alternativa ausente');
    sessao.escolher(alternativa.value);
    expect(sessao.editor.undoManager.transact).not.toHaveBeenCalled();
    expect(sessao.alterar).not.toHaveBeenCalled();
  });

  it('não cria seletores em somente leitura, preservando os valores do documento', () => {
    const sessao = montar({ coleta: true, leitura: true });
    expect(sessao.raiz.querySelector('select')).toBeNull();
    expect(sessao.raiz.querySelector('[data-b601-campo-projetil="tipo"]')?.textContent).toBe('Projétil');
    expect(sessao.editor.undoManager.transact).not.toHaveBeenCalled();
    expect(sessao.alterar).not.toHaveBeenCalled();
  });

  it('exige liberação de todos os ancestrais e atualiza a trava ao concluir a edição', () => {
    const sessao = montar({ envoltorio: 'class="cond-bloco" data-cond-bloco="externo"' });
    const grupo = sessao.raiz.querySelector('[data-b601-grupo]')!;
    grupo.classList.add('conteudo-laudo-editando');
    prepararCamposProjeteisB601(sessao.raiz);
    expect(sessao.controle()).toBeDisabled();
    sessao.raiz.firstElementChild!.classList.add('conteudo-laudo-editando');
    prepararCamposProjeteisB601(sessao.raiz);
    expect(sessao.controle()).toBeEnabled();
    grupo.classList.remove('conteudo-laudo-editando');
    prepararCamposProjeteisB601(sessao.raiz);
    expect(sessao.controle()).toBeDisabled();
  });

  it('preserva a seleção e os nós das opções na preparação repetida e ignora valor inalterado', () => {
    const sessao = montar({ coleta: true });
    const seletor = sessao.controle();
    const opcoes = Array.from(seletor.options);
    prepararCamposProjeteisB601(sessao.raiz);
    expect(sessao.controle()).toBe(seletor);
    opcoes.forEach((opcao, indice) => expect(seletor.options[indice]).toBe(opcao));
    expect(seletor.value).toBe('Projétil');
    sessao.escolher('Projétil');
    expect(sessao.editor.undoManager.transact).not.toHaveBeenCalled();
    expect(sessao.alterar).not.toHaveBeenCalled();
  });
});

describe('classificação de calibres nas tabelas B-601', () => {
  it('reproduz a ordem da ferramenta e deduplica calibres pela melhor referência', () => {
    const raiz = montarTabela([{ massa: '5,7', diametro: '9', altura: '17,39' }]);
    prepararCamposProjeteisB601(raiz, false, [], { habilitarClassificacao: true });
    const valores = Array.from(raiz.querySelectorAll<HTMLOptionElement>('select option'), opcao => opcao.value)
      .filter(valor => valor !== 'Prejudicado' && valor !== '__manual__');
    expect(valores[0]).toBe('.38 Curto');
    expect(new Set(valores.map(valor => valor.replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR'))).size).toBe(valores.length);
  });

  it('classifica com medidas parciais e inclui referências personalizadas validadas', () => {
    const raiz = montarTabela([{ massa: '31,234', diametro: '19,123', altura: '' }]);
    const personalizado: ProjetilReferencia = {
      id: 'personalizado-exato', calibre: 'Calibre personalizado', tipo: 'Teste', sigla: null,
      massaGramas: 31.234, calibreRealMinMm: 19.123, calibreRealMaxMm: 19.123,
      alturaMinMm: null, alturaMaxMm: null, situacao: 'personalizada', fonte: 'Cadastro local', localizacao: 'Cadastro local',
    };
    prepararCamposProjeteisB601(raiz, false, [personalizado], { habilitarClassificacao: true });
    expect(raiz.querySelector<HTMLOptionElement>('select option')?.value).toBe('Calibre personalizado');
  });

  it('usa ordem alfabética quando há medida inválida ou nenhuma medida', () => {
    const esperado = [...new Set(catalogoProjeteis.map(item => item.calibre))].sort((a, b) => a.localeCompare(b, 'pt-BR'))[0];
    for (const medidas of [
      { massa: 'inválida', diametro: '9', altura: '17,39' },
      { massa: '', diametro: '', altura: '' },
    ]) {
      const raiz = montarTabela([medidas]);
      prepararCamposProjeteisB601(raiz, false, [], { habilitarClassificacao: true });
      expect(raiz.querySelector<HTMLOptionElement>('select option')?.value).toBe(esperado);
      raiz.remove();
    }
  });

  it('captura cada coluna, cria a ação transitória e a remove na limpeza', () => {
    const raiz = montarTabela([
      { massa: '5,7', diametro: '9', altura: '17,39' },
      { massa: '8', diametro: '9,02', altura: '15' },
    ]);
    prepararCamposProjeteisB601(raiz, false, [], { habilitarClassificacao: true });
    const campos = raiz.querySelectorAll<HTMLElement>('[data-b601-campo-projetil="calibre_nominal_provavel"]');
    expect(lerMedidasCampoCalibreB601(campos[1])).toEqual({ massaGramas: '8', calibreRealMm: '9,02', alturaMaximaMm: '15' });
    expect(raiz.querySelectorAll('[data-b601-identificar-projetil="true"]')).toHaveLength(2);
    limparInteracaoCamposB601(raiz);
    expect(raiz.querySelector('[data-b601-identificar-projetil="true"]')).toBeNull();
    expect(raiz.querySelector('select')).toBeNull();
  });

  it('reordena após digitação e solicita o modal sem alterar o conteúdo persistido', async () => {
    const projetilOriginal = window.ipcAPI.projetil;
    Object.assign(window.ipcAPI, { projetil: { listarPersonalizados: vi.fn().mockResolvedValue({ success: true, data: [] }) } });
    encerramentos.push(() => { window.ipcAPI.projetil = projetilOriginal; });
    const raiz = montarTabela([{ massa: '', diametro: '', altura: '' }]);
    const eventos = new Map<string, Array<() => void>>();
    const editor = {
      getDoc: () => document, getBody: () => raiz, getContent: () => raiz.innerHTML,
      mode: { isReadOnly: () => false }, nodeChanged: vi.fn(),
      undoManager: { ignore: (acao: () => void) => acao(), transact: vi.fn((acao: () => void) => acao()) },
      on: (nomes: string, acao: () => void) => nomes.split(' ').forEach(nome => eventos.set(nome, [...eventos.get(nome) ?? [], acao])),
      off: vi.fn(),
    };
    const alterar = vi.fn();
    const solicitar = vi.fn();
    registrarSeletoresCamposB601(editor as unknown as Editor, alterar, solicitar);
    encerramentos.push(() => eventos.get('remove')?.forEach(acao => acao()));
    const valores = ['5,7', '9', '17,39'];
    raiz.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((linha, indice) => {
      if (indice < valores.length) {
        linha.children[1].textContent = valores[indice];
      }
    });
    raiz.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await vi.waitFor(() => expect(raiz.querySelector<HTMLOptionElement>('select option')?.value).toBe('.38 Curto'));
    const botao = raiz.querySelector<HTMLButtonElement>('[data-b601-identificar-projetil="true"]');
    if (!botao) throw new Error('Ação de identificação ausente');
    botao.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    botao.click();
    expect(solicitar).toHaveBeenCalledOnce();
    expect(solicitar.mock.calls[0][0].medidas).toEqual({ massaGramas: '5,7', calibreRealMm: '9', alturaMaximaMm: '17,39' });
    solicitar.mock.calls[0][0].restaurarFoco();
    expect(botao).toHaveFocus();
    expect(alterar).not.toHaveBeenCalled();
    expect(editor.undoManager.transact).not.toHaveBeenCalled();
  });
});
