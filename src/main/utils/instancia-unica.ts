interface AplicativoInstanciaUnica {
  requestSingleInstanceLock(): boolean;
  on(evento: 'second-instance', acao: () => void): unknown;
  exit(codigo: number): void;
}

let ativador: (() => void) | null = null;
let ativacaoPendente = false;

export function iniciarInstanciaUnica(aplicativo: AplicativoInstanciaUnica): boolean {
  if (!aplicativo.requestSingleInstanceLock()) {
    aplicativo.exit(0);
    return false;
  }

  aplicativo.on('second-instance', () => {
    if (ativador) ativador();
    else ativacaoPendente = true;
  });
  return true;
}

export function definirAtivadorInstancia(acao: () => void): void {
  ativador = acao;
  if (ativacaoPendente) {
    ativacaoPendente = false;
    acao();
  }
}
