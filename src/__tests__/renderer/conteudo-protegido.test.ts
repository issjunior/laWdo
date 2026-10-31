import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from 'tinymce';
import { toast } from 'sonner';
import { registrarConteudoInterativo } from '@/lib/conteudo-interativo';
import { permiteEdicaoCampo } from '@/lib/politica-edicao-conteudo';
import { criarDadosB601 } from '@shared/types/b601.types';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/desempenho-editor-laudo', () => ({ medirOperacaoEditorLaudo: (_nome: string, executar: () => unknown) => executar() }));

const dados = { ...criarDadosB601(), pecas: [{ idLocal: 'p1', origem: 'manual', alteradaLocalmente: false,
  tipoCodigo: '105', tipoPeca: 'PROJÉTEIS', comuns: { identificacao: '', quantidade: 1, unidadeMedida: 'UNIDADES',
    quantidadeDescricao: '', examinadoInLoco: false, dataEntrada: '', lacreEntrada: '', lacreSaida: '', dataLiberacao: '',
    codigoVestigio: '', consumida: 'N', observacao: '' }, personalizados: { '105:origem_coleta': '94' }, extrasGdl: {} }] };
const grupo = '<div data-b601-grupo="105" data-repeat-owner="dono"><p>Descrição local</p><div data-b601-complemento="true"><figure data-image-id="foto"><img src="foto.png"><figcaption>Legenda local</figcaption></figure><p>Observação local</p></div></div>';

function pendencia<T>() {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>(resolve => { resolver = resolve; });
  return { promessa, resolver };
}

const encerramentos: Array<() => void> = [];
function preparar(html = grupo, confirmar = vi.fn(async () => true), somenteLeitura = false) {
  const raiz = document.createElement('div'); raiz.innerHTML = html; document.body.append(raiz);
  const eventos = new Map<string, Array<() => void>>();
  const editor = {
    removed: false, destroyed: false, getDoc: () => document, getBody: () => raiz, getContent: () => raiz.innerHTML,
    mode: { isReadOnly: () => somenteLeitura }, dom: { addStyle: vi.fn() }, dispatch: vi.fn(),
    undoManager: { ignore: (acao: () => void) => acao(), transact: vi.fn((acao: () => void) => acao()) },
    on: (nomes: string, acao: () => void) => nomes.split(' ').forEach(nome => eventos.set(nome, [...eventos.get(nome) ?? [], acao])),
    off: vi.fn(),
  };
  const aoAlterar = vi.fn(); const aoRestaurar = vi.fn();
  const laudo = vi.fn().mockResolvedValue({ success: true, data: { rep_id: 'rep' } });
  const rep = vi.fn().mockResolvedValue({ success: true, data: { campos_especificos: JSON.stringify({ b601: dados }) } });
  Object.assign(window.ipcAPI, { laudo: { findById: laudo }, rep: { findById: rep } });
  registrarConteudoInterativo(editor as unknown as Editor, { laudoId: 'laudo', confirmar, aoAlterar, aoRestaurar });
  const encerrar = () => eventos.get('remove')?.forEach(acao => acao());
  encerramentos.push(encerrar);
  const alvo = raiz.firstElementChild as HTMLElement;
  const botao = (acao: string, bloco = alvo) => bloco.querySelector<HTMLButtonElement>(`:scope > [data-controles-conteudo] [data-acao-conteudo="${acao}"]`)!;
  return { raiz, alvo, editor, botao, laudo, rep, aoAlterar, aoRestaurar, confirmar, encerrar };
}

afterEach(() => { encerramentos.splice(0).forEach(encerrar => encerrar()); document.body.innerHTML = ''; vi.clearAllMocks(); });
const aguardarSucesso = () => vi.waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1), { interval: 1 });
const aguardarFalha = () => vi.waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1), { interval: 1 });

describe('ações de conteúdo protegido', () => {
  it.each([['105', false], ['105', true], ['101', false], ['101', true]] as const)(
    'restaura grupo %s, coleta %s, preservando fotos, legendas e complementos em uma transação', async (tipo, coleta) => {
    const sessao = preparar(grupo.replace('data-b601-grupo="105"', `data-b601-grupo="${tipo}"${coleta ? ' data-b601-modelo-coleta="true"' : ''}`));
    sessao.rep.mockResolvedValue({ success: true, data: { campos_especificos: JSON.stringify({ b601: {
      ...dados, pecas: dados.pecas.map(peca => ({ ...peca, tipoCodigo: tipo, tipoPeca: tipo === '105' ? 'PROJÉTEIS' : 'ESTOJOS' })),
    } }) } });
    sessao.botao('restaurar').click(); await aguardarSucesso();
    expect(sessao.laudo).toHaveBeenCalledExactlyOnceWith('laudo');
    expect(sessao.rep).toHaveBeenCalledExactlyOnceWith('rep');
    expect(sessao.raiz.textContent).not.toContain('Descrição local');
    expect(sessao.raiz.textContent).toContain(tipo === '105' ? 'PQ01' : 'DESCRIÇÃO DOS ESTOJOS');
    expect(sessao.raiz.querySelectorAll('[data-image-id="foto"]')).toHaveLength(1);
    expect(sessao.raiz.querySelector('img')?.getAttribute('src')).toBe('foto.png');
    expect(sessao.raiz.textContent).toContain('Legenda local');
    expect(sessao.raiz.textContent).toContain('Observação local');
    expect(sessao.editor.undoManager.transact).toHaveBeenCalledTimes(1);
    expect(sessao.aoAlterar).toHaveBeenCalledTimes(1); expect(sessao.aoRestaurar).toHaveBeenCalledTimes(1);
  });

  it.each(['laudo', 'rep', 'json', 'sem-b601', 'sem-material', 'figura-fora'] as const)('preserva conteúdo quando restauração falha: %s', async falha => {
    const sessao = preparar(falha === 'figura-fora' ? grupo.replace('</p><div data-b601-complemento', '</p><figure><img src="fora.png"></figure><div data-b601-complemento') : grupo);
    if (falha === 'laudo') sessao.laudo.mockResolvedValue({ success: false });
    if (falha === 'rep') sessao.rep.mockRejectedValue(new Error('Falha IPC'));
    if (['json', 'sem-b601', 'sem-material'].includes(falha)) sessao.rep.mockResolvedValue({ success: true, data: {
      campos_especificos: falha === 'json' ? '{' : falha === 'sem-b601' ? '{}' : JSON.stringify({ b601: criarDadosB601() }),
    } });
    const antes = sessao.alvo.innerHTML;
    sessao.botao('restaurar').click(); await aguardarFalha();
    expect(sessao.alvo.innerHTML).toBe(antes);
    expect(sessao.aoAlterar).not.toHaveBeenCalled(); expect(sessao.aoRestaurar).not.toHaveBeenCalled();
    expect(sessao.editor.undoManager.transact).not.toHaveBeenCalled();
  });

  it('cancela restauração sem consultar a REP nem alterar conteúdo', async () => {
    const confirmacao = pendencia<boolean>();
    const sessao = preparar(grupo, vi.fn(() => confirmacao.promessa));
    const antes = sessao.alvo.innerHTML;
    sessao.botao('restaurar').click(); confirmacao.resolver(false);
    await vi.waitFor(() => expect(sessao.botao('restaurar')).toBeEnabled(), { interval: 1 });
    expect(sessao.alvo.innerHTML).toBe(antes); expect(sessao.laudo).not.toHaveBeenCalled();
    expect(sessao.aoAlterar).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalled();
  });

  it.each(['alterar', 'remover', 'encerrar'] as const)('rejeita alvo obsoleto durante consulta: %s', async motivo => {
    const sessao = preparar();
    const consulta = pendencia<{ success: boolean; data: { campos_especificos: string } }>();
    sessao.rep.mockReturnValue(consulta.promessa);
    sessao.botao('restaurar').click();
    await vi.waitFor(() => expect(sessao.rep).toHaveBeenCalledTimes(1), { interval: 1 });
    if (motivo === 'alterar') sessao.alvo.querySelector('p')!.textContent = 'Alteração recente';
    if (motivo === 'remover') sessao.alvo.remove();
    if (motivo === 'encerrar') { sessao.editor.removed = true; sessao.encerrar(); }
    consulta.resolver({ success: true, data: { campos_especificos: JSON.stringify({ b601: dados }) } });
    await aguardarFalha();
    expect(sessao.aoAlterar).not.toHaveBeenCalled(); expect(sessao.editor.undoManager.transact).not.toHaveBeenCalled();
    if (motivo === 'alterar') expect(sessao.raiz.textContent).toContain('Alteração recente');
  });

  it('bloqueia cliques concorrentes enquanto aguarda confirmação', async () => {
    const confirmacao = pendencia<boolean>(); const confirmar = vi.fn(() => confirmacao.promessa);
    const sessao = preparar(grupo, confirmar);
    sessao.botao('restaurar').click(); sessao.botao('restaurar').click(); sessao.botao('editar').click();
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(sessao.editor.undoManager.transact).not.toHaveBeenCalled();
    confirmacao.resolver(true); await aguardarSucesso();
    expect(sessao.editor.undoManager.transact).toHaveBeenCalledTimes(1);
  });

  it('suprime bloco condicional após confirmar e publica a alteração', async () => {
    const sessao = preparar('<div class="cond-bloco" data-cond-bloco="teste"><p>Texto</p></div>');
    sessao.botao('excluir').click(); await aguardarSucesso();
    expect(sessao.alvo.getAttribute('data-cond-suprimido')).toBe('true');
    expect(sessao.aoAlterar).toHaveBeenCalledTimes(1);
    expect(sessao.editor.undoManager.transact).toHaveBeenCalledTimes(1);
  });

  it('mantém ações indisponíveis em somente leitura e não permite excluir descrições', () => {
    const leitura = preparar(grupo, vi.fn(async () => true), true);
    for (const acao of ['editar', 'restaurar', 'excluir']) { expect(leitura.botao(acao)).toBeDisabled(); leitura.botao(acao).click(); }
    expect(leitura.confirmar).not.toHaveBeenCalled(); expect(leitura.aoAlterar).not.toHaveBeenCalled();
    const edicao = preparar(); expect(edicao.botao('excluir')).toBeDisabled();
  });

  it('só libera campo comum quando todos os blocos ancestrais estão em edição', () => {
    const sessao = preparar(`<div class="cond-bloco" data-cond-bloco="teste">${grupo}</div>`);
    const interno = sessao.alvo.querySelector<HTMLElement>('[data-b601-grupo]')!;
    const campo = interno.querySelector('p')!;
    expect(sessao.botao('editar', interno)).toBeDisabled();
    expect(permiteEdicaoCampo(campo, false)).toBe(false);
    sessao.botao('editar').click(); sessao.botao('editar', interno).click();
    expect(permiteEdicaoCampo(campo, false)).toBe(true);
    sessao.botao('editar').click(); expect(permiteEdicaoCampo(campo, false)).toBe(false);
    expect(permiteEdicaoCampo(campo, true, true)).toBe(false);
  });

  it.each(['th', 'td data-placeholder-celula-fixa="true"', 'span data-mce-bogus="all"'])('não libera campo fixo %s nem para preenchimento pontual', marca => {
    const recipiente = document.createElement('div'); recipiente.innerHTML = marca.startsWith('t') ? `<table><tr><${marca}><span>Campo</span></${marca.split(' ')[0]}></tr></table>` : `<${marca}><span>Campo</span></span>`;
    expect(permiteEdicaoCampo(recipiente.querySelector('span')!, false, true)).toBe(false);
  });
});
