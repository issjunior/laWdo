import type { ComparacaoMedida, ConsultaProjetil, ProjetilReferencia, ResultadoProjetil } from '../types/projetil.types.js';

function comparar(observado: number | null, minimo: number | null, maximo: number | null, confiavel: boolean): ComparacaoMedida {
  const diferenca = observado === null || minimo === null || maximo === null
    ? null : observado < minimo ? minimo - observado : observado > maximo ? maximo - observado : 0;
  return { observado, referenciaMin: minimo, referenciaMax: maximo, diferenca, confiavel };
}

function distancia(comparacao: ComparacaoMedida): number {
  if (!comparacao.confiavel || comparacao.observado === null) return 0;
  return comparacao.diferenca === null ? Number.POSITIVE_INFINITY : Math.abs(comparacao.diferenca);
}

export function consultarProjeteis(referencias: ProjetilReferencia[], consulta: ConsultaProjetil): ResultadoProjetil[] {
  return referencias.filter(item => !consulta.sigla || item.sigla === consulta.sigla).map(projetil => {
    const calibreReal = comparar(consulta.calibreRealMm, projetil.calibreRealMinMm, projetil.calibreRealMaxMm, consulta.medidasConfiaveis.calibreRealMm);
    const altura = comparar(consulta.alturaMaximaMm, projetil.alturaMinMm, projetil.alturaMaxMm, consulta.medidasConfiaveis.alturaMaximaMm);
    const massaConfiavel = consulta.estado !== 'perda_massa' && consulta.medidasConfiaveis.massaGramas;
    const massa = comparar(consulta.massaGramas, projetil.massaGramas, projetil.massaGramas, massaConfiavel);
    const dadosAusentes = [calibreReal, altura, massa].filter(medida => medida.confiavel && medida.observado !== null && medida.diferenca === null).length;
    const grupoMassa = consulta.estado !== 'perda_massa' || consulta.massaGramas === null ? 0
      : projetil.massaGramas === null ? 1 : projetil.massaGramas >= consulta.massaGramas ? 0 : 2;
    return { projetil, calibreReal, altura, massa, dadosAusentes, grupoMassa };
  }).sort((a, b) => {
    if (a.grupoMassa !== b.grupoMassa) return a.grupoMassa - b.grupoMassa;
    if (a.dadosAusentes !== b.dadosAusentes) return a.dadosAusentes - b.dadosAusentes;
    for (const chave of ['calibreReal', 'massa', 'altura'] as const) {
      const diferenca = distancia(a[chave]) - distancia(b[chave]);
      if (diferenca !== 0 && !Number.isNaN(diferenca)) return diferenca;
    }
    return a.projetil.calibre.localeCompare(b.projetil.calibre, 'pt-BR')
      || a.projetil.tipo.localeCompare(b.projetil.tipo, 'pt-BR')
      || a.projetil.id.localeCompare(b.projetil.id, 'pt-BR');
  });
}
