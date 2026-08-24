function removerZerosEsquerda(numero: string): string {
  return numero.replace(/^0+/, '') || '0';
}

function obterIdentificadorRepParaArquivo(numeroRep: string): string {
  const partes = numeroRep.split('/');
  const numero = partes.length > 1 ? removerZerosEsquerda(partes[1]) : removerZerosEsquerda(partes[0]);
  const ano = partes.length > 1 ? partes[0] : '';

  return ano ? `${numero}-${ano}` : numero;
}

export function obterNomeArquivoLaudo(numeroRep: string, formato: string): string {
  return `${obterIdentificadorRepParaArquivo(numeroRep)}.${formato}`;
}

export function obterNomeArquivoRep(numeroRep: string, formato: string): string {
  return `REP-${obterIdentificadorRepParaArquivo(numeroRep)}.${formato}`;
}
