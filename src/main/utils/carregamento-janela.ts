export async function carregarConteudoJanela(
  carregar: () => Promise<void>,
  tempoLimiteMs = 20_000,
): Promise<void> {
  let temporizador: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      carregar(),
      new Promise<never>((_, rejeitar) => {
        temporizador = setTimeout(() => rejeitar(new Error('TEMPO_LIMITE_CARREGAMENTO_JANELA')), tempoLimiteMs);
      }),
    ]);
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}
