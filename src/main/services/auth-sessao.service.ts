import { notificarContextoGdlAlterado } from './gdl-agendamento-eventos.service.js';

const usuariosPorJanela = new Map<number, string>();

export const authSessaoService = {
  iniciar(janelaId: number, usuarioId: string): void {
    usuariosPorJanela.set(janelaId, usuarioId);
    notificarContextoGdlAlterado();
  },
  encerrar(janelaId: number): void {
    if (usuariosPorJanela.delete(janelaId)) notificarContextoGdlAlterado();
  },
  aoIniciarNavegacao(janelaId: number, detalhes: { isMainFrame: boolean; isSameDocument: boolean }): void {
    if (detalhes.isMainFrame && !detalhes.isSameDocument) this.encerrar(janelaId);
  },
  obterUsuarios(): string[] {
    return [...new Set(usuariosPorJanela.values())];
  },
  exigir(janelaId: number): string {
    const usuarioId = usuariosPorJanela.get(janelaId);
    if (!usuarioId) throw new Error('Faça login novamente para acessar o backup.');
    return usuarioId;
  },
};
