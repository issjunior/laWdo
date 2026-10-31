import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from 'tinymce';
import { limparInteracaoCamposB601, prepararCamposProjeteisB601, registrarSeletoresCamposB601 } from '@/lib/b601-campos-projetil';

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
