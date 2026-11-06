interface EtapaEncerramento {
  nome: string;
  executar: () => void | Promise<void>;
}

interface DependenciasEncerramento {
  grupos: EtapaEncerramento[][];
  fecharBanco: () => Promise<void>;
  registrarFalha: (etapa: string, erro: unknown) => void;
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
    this.execucao = this.encerrar().then(() => {
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
    const resultados = await Promise.allSettled(grupo.map(etapa => Promise.resolve().then(etapa.executar)));
    resultados.forEach((resultado, indice) => {
      if (resultado.status === 'rejected') this.dependencias.registrarFalha(grupo[indice].nome, resultado.reason);
    });
  }
}
