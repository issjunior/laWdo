interface EtapaEncerramento {
  nome: string;
  executar: () => void | Promise<void>;
}

interface DependenciasEncerramento {
  grupos: EtapaEncerramento[][];
  fecharBanco: () => Promise<void>;
  registrarFalha: (etapa: string, erro: unknown) => void;
  registrarEtapa?: (etapa: string, estado: 'iniciada' | 'concluida') => void;
  registrarEspera?: (etapa: string) => void;
  sair: () => void;
}

export class EncerramentoAplicativoService {
  private execucao: Promise<void> | null = null;
  private concluido = false;

  constructor(private dependencias: DependenciasEncerramento) {}

  solicitar(evento: { preventDefault: () => void }): void {
    if (this.concluido) return;
    evento.preventDefault();
    if (this.execucao) return;
    // Sem janelas, o Electron pode deixar pendente a continuação assíncrona da limpeza.
    const manterAtivo = setInterval(() => undefined, 1_000);
    this.execucao = this.encerrar().then(() => {
      clearInterval(manterAtivo);
      this.concluido = true;
      this.dependencias.sair();
    });
  }

  private async encerrar(): Promise<void> {
    for (const grupo of this.dependencias.grupos) {
      await this.executarGrupo(grupo);
    }
    await this.executarGrupo([{ nome: 'banco de dados', executar: this.dependencias.fecharBanco }]);
  }

  private async executarGrupo(grupo: EtapaEncerramento[]): Promise<void> {
    const resultados = await Promise.allSettled(grupo.map(async etapa => {
      this.dependencias.registrarEtapa?.(etapa.nome, 'iniciada');
      const aviso = setTimeout(() => this.dependencias.registrarEspera?.(etapa.nome), 3_000);
      try {
        await etapa.executar();
        this.dependencias.registrarEtapa?.(etapa.nome, 'concluida');
      } finally {
        clearTimeout(aviso);
      }
    }));
    resultados.forEach((resultado, indice) => {
      if (resultado.status === 'rejected') this.dependencias.registrarFalha(grupo[indice].nome, resultado.reason);
    });
  }
}
