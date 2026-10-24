import { AsyncLocalStorage } from 'node:async_hooks';

export const OCIOSIDADE_GDL_MS = 15_000;
interface ContextoAtividadeGdl {
  automatica: boolean;
  sinal?: AbortSignal;
  validar?: () => Promise<void>;
}

export class AtividadeGdlService {
  private contexto = new AsyncLocalStorage<ContextoAtividadeGdl>();
  private consultasAtivas = 0;
  private ultimaAtividade = Date.now();

  async consultar<T>(consulta: () => Promise<T>): Promise<T> {
    if (this.contexto.getStore()) return consulta();
    this.consultasAtivas += 1;
    this.ultimaAtividade = Date.now();
    try {
      return await this.contexto.run({ automatica: false }, consulta);
    } finally {
      this.consultasAtivas -= 1;
      this.ultimaAtividade = Date.now();
    }
  }

  automatizar<T>(sinal: AbortSignal, validar: () => Promise<void>, consulta: () => Promise<T>): Promise<T> {
    return this.contexto.run({ automatica: true, sinal, validar }, consulta);
  }

  async antesDaRequisicao(): Promise<void> {
    const contexto = this.contexto.getStore();
    if (!contexto?.automatica) return;
    for (;;) {
      contexto.sinal?.throwIfAborted();
      await contexto.validar?.();
      contexto.sinal?.throwIfAborted();
      const restante = this.ultimaAtividade + OCIOSIDADE_GDL_MS - Date.now();
      if (this.consultasAtivas === 0 && restante <= 0) return;
      await new Promise<void>((resolver, rejeitar) => {
        const cancelar = () => {
          clearTimeout(temporizador);
          contexto.sinal?.removeEventListener('abort', cancelar);
          rejeitar(new Error('Atualização automática do GDL cancelada.'));
        };
        const temporizador = setTimeout(() => {
          contexto.sinal?.removeEventListener('abort', cancelar);
          resolver();
        }, this.consultasAtivas ? OCIOSIDADE_GDL_MS : Math.max(1, restante));
        contexto.sinal?.addEventListener('abort', cancelar, { once: true });
        if (contexto.sinal?.aborted) cancelar();
      });
    }
  }
}

export const atividadeGdlService = new AtividadeGdlService();
