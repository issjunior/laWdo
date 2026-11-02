import type { ImagemTransformada, TransformacaoImagem } from './contratos.js';

interface Consumidor {
  contexto: string;
  resolver: (resultado: ImagemTransformada) => void;
  rejeitar: (erro: Error) => void;
}
interface Tarefa {
  chave: string;
  entrada: TransformacaoImagem;
  prioridade: number;
  consumidores: Consumidor[];
}

export class FilaImagens {
  private pendentes: Tarefa[] = [];
  private ativa: Tarefa | null = null;
  private encerrada = false;
  constructor(private executar: (entrada: TransformacaoImagem) => Promise<ImagemTransformada>,
    private interromper: () => void, private limite = 30, private timeout = 30_000) {}

  solicitar(chave: string, entrada: TransformacaoImagem, contexto: string, prioridade: number): Promise<ImagemTransformada> {
    if (this.encerrada) return Promise.reject(new Error('Processador de imagens encerrado.'));
    const existente = [this.ativa, ...this.pendentes].find(tarefa => tarefa?.chave === chave);
    if (!existente && this.ativa && this.pendentes.length >= this.limite) return Promise.reject(new Error('A fila de imagens está cheia. Tente novamente.'));
    const bytesRetidos = [this.ativa, ...this.pendentes].reduce((total, tarefa) => total + (tarefa?.entrada.bytes.byteLength ?? 0), 0);
    if (!existente && bytesRetidos + entrada.bytes.byteLength > 256 * 1024 * 1024) return Promise.reject(new Error('A fila de imagens atingiu o limite de memória. Tente novamente.'));
    return new Promise((resolver, rejeitar) => {
      const consumidor = { contexto, resolver, rejeitar };
      if (existente) {
        existente.consumidores.push(consumidor);
        existente.prioridade = Math.min(existente.prioridade, prioridade);
      } else this.pendentes.push({ chave, entrada, prioridade, consumidores: [consumidor] });
      this.iniciarProxima();
    });
  }

  cancelar(contexto: string): void {
    for (const tarefa of [this.ativa, ...this.pendentes]) {
      if (!tarefa) continue;
      const cancelados = tarefa.consumidores.filter(item => item.contexto === contexto);
      tarefa.consumidores = tarefa.consumidores.filter(item => item.contexto !== contexto);
      for (const consumidor of cancelados) consumidor.rejeitar(new Error('Processamento de imagem cancelado.'));
    }
    this.pendentes = this.pendentes.filter(item => item.consumidores.length > 0);
    if (this.ativa && this.ativa.consumidores.length === 0) this.interromper();
  }

  encerrar(): void {
    this.encerrada = true;
    for (const tarefa of [this.ativa, ...this.pendentes]) {
      for (const item of tarefa?.consumidores ?? []) item.rejeitar(new Error('Processador de imagens encerrado.'));
      if (tarefa) tarefa.consumidores = [];
    }
    this.pendentes = [];
    this.interromper();
  }

  private iniciarProxima(): void {
    if (this.ativa || this.encerrada) return;
    this.pendentes.sort((a, b) => a.prioridade - b.prioridade);
    const tarefa = this.pendentes.shift();
    if (!tarefa) return;
    this.ativa = tarefa;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const limite = new Promise<never>((_resolve, reject) => {
      temporizador = setTimeout(() => {
        this.interromper();
        reject(new Error('Processamento da imagem excedeu 30 segundos. Tente novamente.'));
      }, this.timeout);
    });
    void Promise.race([Promise.resolve().then(() => this.executar(tarefa.entrada)), limite]).then(resultado => {
      for (const consumidor of tarefa.consumidores) consumidor.resolver(resultado);
    }, (erro: unknown) => {
      const falha = erro instanceof Error ? erro : new Error('Falha no processador de imagens.');
      for (const consumidor of tarefa.consumidores) consumidor.rejeitar(falha);
    }).finally(() => {
      clearTimeout(temporizador);
      this.ativa = null;
      this.iniciarProxima();
    });
  }
}
