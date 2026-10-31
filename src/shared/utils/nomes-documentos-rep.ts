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

export function obterIdentificacaoBkpLaudo(numeroRep: string): { nomeArquivo: string; numeroFormatado: string } {
  const original = numeroRep.trim();
  const interno = original.match(/^(\d{4})\/(\d+)$/);
  const exibido = original.match(/^([\d.]+)[/-](\d{2}|\d{4})$/);
  const numero = interno?.[2] ?? exibido?.[1].replace(/\./g, '');
  const ano = interno?.[1] ?? exibido?.[2];
  if (numero && ano) {
    const semZeros = removerZerosEsquerda(numero);
    const anoCurto = ano.slice(-2);
    return {
      nomeArquivo: `laudo-${semZeros}-${anoCurto}.bkp`,
      numeroFormatado: `${semZeros.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${anoCurto}`,
    };
  }
  const identificador = original.replace(/\./g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'sem-numero';
  return { nomeArquivo: `laudo-${identificador}.bkp`, numeroFormatado: original };
}
