import type { Editor } from 'tinymce';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registrarPreparacaoConteudo } from '@/lib/preparacao-conteudo-editor';

function criarEditor() {
  const ouvintes = new Map<string, Set<() => void>>();
  const estado = { removed: false, destroyed: false };
  const editor = {
    ...estado, getDoc: () => document,
    on: (nomes: string, acao: () => void) => nomes.split(' ').forEach(nome => {
      if (!ouvintes.has(nome)) ouvintes.set(nome, new Set());
      ouvintes.get(nome)!.add(acao);
    }),
    off: (nomes: string, acao: () => void) => nomes.split(' ').forEach(nome => ouvintes.get(nome)?.delete(acao)),
  };
  return { editor, instancia: editor as unknown as Editor, disparar: (nome: string) => ouvintes.get(nome)?.forEach(acao => acao()) };
}

afterEach(() => { vi.useRealTimers(); });

describe('preparação agrupada do conteúdo', () => {
  it('agrupa todos os eventos em um quadro, ordena prioridades e permite novo quadro', () => {
    vi.useFakeTimers();
    const { instancia, disparar } = criarEditor();
    const ordem: string[] = [];
    const preparar = vi.fn(() => ordem.push('campos'));
    registrarPreparacaoConteudo(instancia, preparar);
    const agendar = registrarPreparacaoConteudo(instancia, () => ordem.push('travas'), 0);
    for (const evento of ['SetContent', 'LoadContent', 'Undo', 'Redo', 'SwitchMode', 'PlaceholdersAplicados', 'ConteudoInterativoAlterado']) disparar(evento);
    agendar();
    expect(ordem).toEqual([]);
    vi.advanceTimersToNextFrame();
    expect(ordem).toEqual(['travas', 'campos']);
    expect(preparar).toHaveBeenCalledTimes(1);
    disparar('Undo'); vi.advanceTimersToNextFrame();
    expect(preparar).toHaveBeenCalledTimes(2);
  });

  it.each(['remove', 'removed', 'destroyed'] as const)('não executa tarefa de editor encerrado por %s', motivo => {
    vi.useFakeTimers();
    const { editor, instancia, disparar } = criarEditor();
    const preparar = vi.fn();
    const agendar = registrarPreparacaoConteudo(instancia, preparar);
    agendar();
    if (motivo === 'remove') disparar('remove'); else editor[motivo] = true;
    vi.advanceTimersToNextFrame();
    disparar('SetContent'); vi.advanceTimersToNextFrame();
    expect(preparar).not.toHaveBeenCalled();
  });

  it('mantém sessões de editores independentes', () => {
    vi.useFakeTimers();
    const primeiro = criarEditor(); const segundo = criarEditor();
    const prepararPrimeiro = vi.fn(); const prepararSegundo = vi.fn();
    registrarPreparacaoConteudo(primeiro.instancia, prepararPrimeiro)();
    registrarPreparacaoConteudo(segundo.instancia, prepararSegundo)();
    primeiro.disparar('remove'); vi.advanceTimersToNextFrame();
    expect(prepararPrimeiro).not.toHaveBeenCalled();
    expect(prepararSegundo).toHaveBeenCalledTimes(1);
    segundo.disparar('remove');
  });
});
