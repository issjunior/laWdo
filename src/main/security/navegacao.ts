export function urlExternaPermitida(valor: string): boolean {
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
}

export function navegacaoAplicacaoPermitida(destino: string, enderecoAplicacao: string): boolean {
  try {
    const urlDestino = new URL(destino);
    const urlAplicacao = new URL(enderecoAplicacao);
    if (urlAplicacao.protocol === 'file:') {
      return urlDestino.protocol === 'file:' && urlDestino.pathname === urlAplicacao.pathname;
    }
    return urlDestino.origin === urlAplicacao.origin;
  } catch {
    return false;
  }
}
