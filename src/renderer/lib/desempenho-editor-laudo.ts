export function medirOperacaoEditorLaudo<T>(
  operacao: string,
  executar: () => T,
  metadados: Record<string, number | boolean | null> = {},
): T {
  const inicio = performance.now();
  let falhou = false;
  try {
    return executar();
  } catch (erro) {
    falhou = true;
    throw erro;
  } finally {
    window.ipcAPI?.desempenho?.registrar({
      origem: 'renderer', categoria: 'editor', evento: falhou ? 'falhou' : 'concluido',
      operacao, duracaoMs: performance.now() - inicio, metadados: { ...metadados, falhou },
    });
  }
}
