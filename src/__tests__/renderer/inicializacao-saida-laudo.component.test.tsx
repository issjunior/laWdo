import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Editor } from 'tinymce';
import { prepararInicializacaoEditorLaudo } from '@/lib/sincronizacao-editor-laudo';
import { normalizarConteudoComparavel } from '@/lib/conteudo-comparavel-laudo';
import { useGerenciadorAlteracoesLaudo } from '@/hooks/useGerenciadorAlteracoesLaudo';

function criarEditor() {
  let concluir!: (resultado: Array<{ status: boolean }>) => void;
  const promessa = new Promise<Array<{ status: boolean }>>(resolve => { concluir = resolve; });
  const editor = { removed: false, destroyed: false, uploadImages: vi.fn(() => promessa) };
  return { editor, instancia: editor as unknown as Editor, concluir };
}

describe('preparação integrada à proteção de saída', () => {
  it('aguarda imagem atrasada, permite sair sem edição e protege edição, desfazer e salvamento concorrente', async () => {
    const { result } = renderHook(() => useGerenciadorAlteracoesLaudo());
    const { instancia, concluir } = criarEditor();
    let html = '<img src="blob:temporario"><span data-placeholder="{{nome}}" contenteditable="false">Nome</span>';
    act(() => result.current.iniciarSessao(normalizarConteudoComparavel(html), true));
    const sessao = result.current.obterSessao();
    const preparar = vi.fn(() => result.current.concluirInicializacao(normalizarConteudoComparavel(html), sessao));
    const pendente = prepararInicializacaoEditorLaudo(instancia, () => result.current.sessaoAtual(sessao), preparar);
    expect(preparar).not.toHaveBeenCalled();
    act(() => expect(result.current.atualizarConteudo('estado antigo')).toBe(false));
    await act(async () => {
      html = html.replace('blob:temporario', 'data:image/png;base64,AA==');
      concluir([{ status: true }]);
      await pendente;
    });
    const salvo = normalizarConteudoComparavel(html);
    act(() => expect(result.current.atualizarConteudo(salvo, 'voltar')).toBe(false));
    act(() => result.current.atualizarConteudo(salvo.replace('AA==', 'BB=='), 'voltar'));
    expect(result.current.alteracoesPendentes).toBe(true);
    act(() => result.current.atualizarConteudo(salvo, 'voltar'));
    expect(result.current.alteracoesPendentes).toBe(false);
    act(() => {
      result.current.atualizarConteudo('edição');
      result.current.concluirInicializacao('edição', sessao);
    });
    expect(result.current.alteracoesPendentes).toBe(true);
    act(() => {
      result.current.iniciarSalvamento();
      result.current.concluirSalvamento('edição', 'nova edição', sessao);
    });
    expect(result.current.alteracoesPendentes).toBe(true);
    act(() => {
      result.current.iniciarSalvamento();
      result.current.concluirSalvamento('nova edição', 'nova edição', sessao);
    });
    act(() => expect(result.current.atualizarConteudo('nova edição', 'voltar')).toBe(false));
  });

  it.each(['sessão', 'removido', 'destruído'])('ignora conclusão antiga: %s', async motivo => {
    const { instancia, editor, concluir } = criarEditor();
    let atual = true;
    const preparar = vi.fn();
    const pendente = prepararInicializacaoEditorLaudo(instancia, () => atual, preparar);
    if (motivo === 'sessão') atual = false;
    if (motivo === 'removido') editor.removed = true;
    if (motivo === 'destruído') editor.destroyed = true;
    concluir([{ status: true }]);
    expect(await pendente).toBe(false);
    expect(preparar).not.toHaveBeenCalled();
  });

  it('não estabelece referência se imagem falha e permite nova tentativa', async () => {
    const { instancia, editor, concluir } = criarEditor();
    const preparar = vi.fn();
    const pendente = prepararInicializacaoEditorLaudo(instancia, () => true, preparar);
    concluir([{ status: false }]);
    await expect(pendente).rejects.toThrow('Não foi possível preparar as imagens');
    expect(preparar).not.toHaveBeenCalled();
    editor.uploadImages.mockResolvedValue([{ status: true }]);
    expect(await prepararInicializacaoEditorLaudo(instancia, () => true, preparar)).toBe(true);
    expect(preparar).toHaveBeenCalledTimes(1);
  });
});
