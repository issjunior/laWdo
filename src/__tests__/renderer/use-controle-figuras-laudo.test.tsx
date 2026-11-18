import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useControleFigurasLaudo } from '../../renderer/features/figuras/useControleFigurasLaudo';

function criarPromessaControlada<T>() {
  let resolver: (valor: T) => void = () => {};
  const promessa = new Promise<T>(resolve => { resolver = resolve; });
  return { promessa, resolver };
}

function criarOpcoes(sessaoEditor: number, obterSessao: () => number) {
  return {
    editorMode: 'single' as const,
    singleEditorHtml: '',
    secoes: [],
    secoesAtuaisRef: { current: [] as Array<{ conteudo: string }> },
    sessaoEditor,
    obterSessao,
    sessaoAtual: vi.fn(() => true),
    obterEditor: vi.fn(() => null),
    editoresFigurasAlteradosRef: { current: new Set<string>() },
  };
}

describe('useControleFigurasLaudo', () => {
  it('serializa operações da mesma sessão e mantém a pendência até a fila terminar', async () => {
    const primeira = criarPromessaControlada<void>();
    const segunda = criarPromessaControlada<void>();
    const executarPrimeira = vi.fn(() => primeira.promessa);
    const executarSegunda = vi.fn(() => segunda.promessa);
    const { result } = renderHook(() => useControleFigurasLaudo(criarOpcoes(1, () => 1)));

    let operacaoPrimeira!: Promise<void>;
    let operacaoSegunda!: Promise<void>;
    act(() => {
      operacaoPrimeira = result.current.executarOperacaoFigura(executarPrimeira);
      operacaoSegunda = result.current.executarOperacaoFigura(executarSegunda);
    });

    await Promise.resolve();
    expect(executarPrimeira).toHaveBeenCalledOnce();
    expect(executarSegunda).not.toHaveBeenCalled();
    expect(result.current.haOperacoesPendentes()).toBe(true);

    primeira.resolver();
    await operacaoPrimeira;
    await Promise.resolve();
    expect(executarSegunda).toHaveBeenCalledOnce();
    expect(result.current.haOperacoesPendentes()).toBe(true);

    segunda.resolver();
    await operacaoSegunda;
    expect(result.current.haOperacoesPendentes()).toBe(false);
  });

  it('isola pendências de uma sessão encerrada da sessão seguinte', async () => {
    const pendente = criarPromessaControlada<void>();
    let sessaoAtual = 1;
    const { result, rerender } = renderHook(({ sessao }) => (
      useControleFigurasLaudo(criarOpcoes(sessao, () => sessaoAtual))
    ), { initialProps: { sessao: 1 } });

    let operacao!: Promise<void>;
    act(() => { operacao = result.current.executarOperacaoFigura(() => pendente.promessa); });
    await Promise.resolve();
    expect(result.current.haOperacoesPendentes()).toBe(true);

    sessaoAtual = 2;
    rerender({ sessao: 2 });
    expect(result.current.haOperacoesPendentes()).toBe(false);

    pendente.resolver();
    await operacao;
    expect(result.current.haOperacoesPendentes()).toBe(false);
  });
});
