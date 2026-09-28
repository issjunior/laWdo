const usuariosPorJanela = new Map<number, string>();

export const authSessaoService = {
  iniciar(janelaId: number, usuarioId: string): void {
    usuariosPorJanela.set(janelaId, usuarioId);
  },
  encerrar(janelaId: number): void {
    usuariosPorJanela.delete(janelaId);
  },
  exigir(janelaId: number): string {
    const usuarioId = usuariosPorJanela.get(janelaId);
    if (!usuarioId) throw new Error('Faça login novamente para acessar o backup.');
    return usuarioId;
  },
};
