import { notificarContextoGdlAlterado } from './gdl-agendamento-eventos.service.js';

const usuariosPorJanela = new Map<number, string>();
const janelaPaiPorJanela = new Map<number, number>();

function encerrarJanelaEFilhas(janelaId: number): void {
  usuariosPorJanela.delete(janelaId);
  janelaPaiPorJanela.delete(janelaId);

  for (const [janelaFilhaId, janelaPaiId] of janelaPaiPorJanela) {
    if (janelaPaiId === janelaId) encerrarJanelaEFilhas(janelaFilhaId);
  }
}

function obterUsuarioDaJanela(janelaId: number): string | undefined {
  const visitadas = new Set<number>();
  let atual: number | undefined = janelaId;

  while (atual !== undefined && !visitadas.has(atual)) {
    visitadas.add(atual);
    const usuarioId = usuariosPorJanela.get(atual);
    if (usuarioId) return usuarioId;
    atual = janelaPaiPorJanela.get(atual);
  }

  return undefined;
}

export const authSessaoService = {
  iniciar(janelaId: number, usuarioId: string): void {
    janelaPaiPorJanela.delete(janelaId);
    usuariosPorJanela.set(janelaId, usuarioId);
    notificarContextoGdlAlterado();
  },
  encerrar(janelaId: number): void {
    const haviaSessao = usuariosPorJanela.has(janelaId) || janelaPaiPorJanela.has(janelaId);
    encerrarJanelaEFilhas(janelaId);
    if (haviaSessao) notificarContextoGdlAlterado();
  },
  vincularJanelaFilha(janelaPaiId: number, janelaFilhaId: number): void {
    if (!usuariosPorJanela.has(janelaPaiId) && !janelaPaiPorJanela.has(janelaPaiId)) {
      throw new Error('Faça login novamente para acessar este painel.');
    }
    if (janelaPaiId === janelaFilhaId) throw new Error('Janela filha inválida.');
    janelaPaiPorJanela.set(janelaFilhaId, janelaPaiId);
  },
  aoIniciarNavegacao(janelaId: number, detalhes: { isMainFrame: boolean; isSameDocument: boolean }): void {
    if (detalhes.isMainFrame && !detalhes.isSameDocument) this.encerrar(janelaId);
  },
  obterUsuarios(): string[] {
    return [...new Set(usuariosPorJanela.values())];
  },
  exigir(janelaId: number): string {
    const usuarioId = obterUsuarioDaJanela(janelaId);
    if (!usuarioId) throw new Error('Faça login novamente para acessar o backup.');
    return usuarioId;
  },
};
