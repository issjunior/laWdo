interface SecaoParaNumeracao {
  nivel: 2 | 3;
  ocultarTitulo?: boolean;
  contarNaNumeracao?: boolean;
}

export function calcularNumeracaoSecoes(secoes: readonly SecaoParaNumeracao[]): string[] {
  let indicePrincipal = 0;
  let indiceSubsecao = 0;
  let paiNumerado = true;

  return secoes.map(secao => {
    const contar = !secao.ocultarTitulo || secao.contarNaNumeracao !== false;
    if (secao.nivel === 2) {
      indiceSubsecao = 0;
      paiNumerado = contar;
      if (!contar) return '';
      indicePrincipal += 1;
      return `${indicePrincipal}.`;
    }
    if (!paiNumerado || !contar) return '';
    indiceSubsecao += 1;
    return `${indicePrincipal}.${indiceSubsecao}`;
  });
}
